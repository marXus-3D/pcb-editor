import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BoardConfig, PCBComponent } from '../types';
import { PadSystem } from './primitives/PadSystem';
import { TraceSystem } from './primitives/TraceSystem';
import { HoleSystem } from './primitives/HoleSystem';

export class PCBRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private transformControls: TransformControls;
  private container: HTMLElement;
  private frameId: number | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  // Interaction State
  private hoveredObject: { object: THREE.Object3D, instanceId?: number } | null = null;
  private selectedObject: { object: THREE.Object3D, instanceId?: number } | null = null;
  private dummyHelper: THREE.Object3D; // For transforming instances
  
  public onSelectionChange: ((data: any) => void) | null = null;
  
  // Scene Objects
  private boardMesh: THREE.Mesh | null = null;
  private group: THREE.Group;
  private boardConfig: BoardConfig | null = null;
  private components: PCBComponent[] = [];
  
  // Systems
  private padSystem: PadSystem;
  private traceSystem: TraceSystem;
  private holeSystem: HoleSystem;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Initialize Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);
    
    // Initialize Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 50, 50);
    this.camera.lookAt(0, 0, 0);

    // Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // TransformControls
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.showY = false; // Constraint to XZ plane
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
    });
    this.transformControls.addEventListener('change', this.onTransformChange.bind(this));
    this.scene.add(this.transformControls);

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dummyHelper = new THREE.Object3D();
    this.scene.add(this.dummyHelper); // Helper doesn't need to be visible, just in scene graph? Actually keep it detached or attached to scene?
    // TransformControls needs to attach to something in the scene usually.


    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    // Group for PCB elements
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.initLayers();

    // Initialize Systems
    this.padSystem = new PadSystem(this);
    this.traceSystem = new TraceSystem(this);
    this.holeSystem = new HoleSystem(this);

    // Bind methods
    this.animate = this.animate.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);

    // Event Listeners
    window.addEventListener('resize', this.onWindowResize);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    // Start Loop
    this.animate();
  }

  // Layer Groups
  private layers: { [key: string]: THREE.Group } = {};

  private initLayers() {
    this.layers['top'] = new THREE.Group();
    this.layers['bottom'] = new THREE.Group();
    this.layers['board'] = new THREE.Group();

    this.group.add(this.layers['board']);
    this.group.add(this.layers['top']);
    this.group.add(this.layers['bottom']);
  }

  public getLayerGroup(layer: 'top' | 'bottom' | 'board'): THREE.Group {
    return this.layers[layer];
  }

  public initBoard(config: BoardConfig) {
    this.boardConfig = config;
    // Dipose old board if exists
    if (this.boardMesh) {
      this.scene.remove(this.boardMesh);
      if (this.boardMesh.geometry) this.boardMesh.geometry.dispose();
      if (Array.isArray(this.boardMesh.material)) {
        this.boardMesh.material.forEach((m) => m.dispose());
      } else {
        (this.boardMesh.material as THREE.Material).dispose();
      }
    }

    const geometry = new THREE.BoxGeometry(config.width, config.thickness, config.height);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x2e8b57, // FR4 Green roughly
      roughness: 0.8,
      metalness: 0.1
    });
    
    this.boardMesh = new THREE.Mesh(geometry, material);
    // Board is centered at 0,0,0 in its local space, which is the board layer
    // We want the top surface to be at +thickness/2 in World if the board layer is at 0?
    // Let's keep the board layer at 0,0,0.
    // BoxGeometry is centered. So top is at y = thickness/2.
    
    this.layers['board'].add(this.boardMesh);
    
    // Position Layer Groups
    // Top layer is slightly above the board surface
    this.layers['top'].position.y = config.thickness / 2 + 0.01;
    
    // Bottom layer is slightly below the board surface
    this.layers['bottom'].position.y = -config.thickness / 2 - 0.01;
    // We might want to rotate bottom components or just handle it in the component logic.
    // Usually bottom components are mirrored in X if looking from top, or just placed on bottom.
    // Let's just place them.

    // Grid Helper
    const gridHelper = new THREE.GridHelper(Math.max(config.width, config.height) * 1.5, 20);
    gridHelper.position.y = -config.thickness / 2 - 0.1;
    this.scene.add(gridHelper);
  }

  private onWindowResize() {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private animate() {
    this.frameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  public updateComponents(components: PCBComponent[]) {
    if (!this.boardConfig) return;
    
    // Deep copy to avoid mutating props directly if they come from React state (though we will mutate this local copy)
    this.components = JSON.parse(JSON.stringify(components));
    
    this.padSystem.update(this.components);
    this.traceSystem.update(this.components);
    this.holeSystem.update(this.components, this.boardConfig.thickness);
  }

  public save(): { board: BoardConfig, components: PCBComponent[] } | null {
    if (!this.boardConfig) return null;
    return {
      board: this.boardConfig,
      components: this.components
    };
  }

  private onTransformChange() {
    if (!this.selectedObject || !this.transformControls.object) return;
    
    // Update the object/instance
    const { object, instanceId } = this.selectedObject;
    
    const pos = new THREE.Vector3();
    const targetObj = this.transformControls.object;
    targetObj.updateMatrix();
    targetObj.matrix.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());

    if (object instanceof THREE.InstancedMesh && typeof instanceId === 'number') {
      const mesh = object as THREE.InstancedMesh;
      mesh.setMatrixAt(instanceId, targetObj.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      
      // Update internal component state
      if (object.userData.componentIds) {
        const id = object.userData.componentIds[instanceId];
        const component = this.components.find(c => c.id === id);
        if (component && 'pos' in component) {
             if (component.type === 'smd_rect' || component.type === 'smd_round') {
                 component.pos[0] = pos.x;
                 component.pos[2] = pos.z;
             }
        }
      }

      if (this.onSelectionChange) {
         const id = object.userData.componentIds ? object.userData.componentIds[instanceId] : object.userData.id;
         const component = this.components.find(c => c.id === id);

        this.onSelectionChange({
          id: id, 
          pos: [pos.x, pos.y, pos.z],
          type: component?.type,
          size: (component as any)?.size
        });
      }
    } else if (object instanceof THREE.Mesh) {
      // Regular mesh (like a Trace)
      // If we are moving a trace, we should update its internal points? 
      // That's more complex. For now just update visual position and metadata.
      if (this.onSelectionChange) {
        this.onSelectionChange({
          id: object.userData.id,
          pos: [pos.x, pos.y, pos.z],
          type: object.userData.type
        });
      }
    }
  }

  private onPointerMove(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkIntersection();
  }
  
  private onPointerDown(_event: PointerEvent) {
    // If clicking on TransformControls gizmo, ignore
    if ((this.transformControls as any).axis) return;

    if (this.hoveredObject) {
      this.selectObject(this.hoveredObject);
    } else {
      this.deselect();
    }
  }

  private checkIntersection() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Intersect pads and traces (which are in 'top' and 'bottom' layers)
    const objectsToTest: THREE.Object3D[] = [];
    this.layers['top'].children.forEach(c => objectsToTest.push(c));
    this.layers['bottom'].children.forEach(c => objectsToTest.push(c));
    
    const intersects = this.raycaster.intersectObjects(objectsToTest, false);
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      const object = hit.object;
      const instanceId = hit.instanceId;
      
      // Update Hover State
      if (this.hoveredObject?.object !== object || this.hoveredObject?.instanceId !== instanceId) {
        // Clear previous
        if (this.hoveredObject) this.setHover(this.hoveredObject, false);
        
        this.hoveredObject = { object, instanceId };
        this.setHover(this.hoveredObject, true);
        
        this.container.style.cursor = 'pointer';
      }
    } else {
      if (this.hoveredObject) {
        this.setHover(this.hoveredObject, false);
        this.hoveredObject = null;
        this.container.style.cursor = 'default';
      }
    }
  }
  
  private setHover(state: { object: THREE.Object3D, instanceId?: number }, isHovered: boolean) {
    const { object, instanceId } = state;
    if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) {
      // Check uniforms
      const uniforms = object.material.uniforms;
      
      if (typeof instanceId === 'number' && uniforms.uHoveredInstance) {
         uniforms.uHoveredInstance.value = isHovered ? instanceId : -1;
      } else if (uniforms.uIsHovered) {
         uniforms.uIsHovered.value = isHovered;
      }
    }
  }

  private selectObject(state: { object: THREE.Object3D, instanceId?: number }) {
    this.deselect(); // Clear previous selection
    
    this.selectedObject = state;
    const { object, instanceId } = state;
    
    // Highlight in shader
    if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) {
      const uniforms = object.material.uniforms;
      if (typeof instanceId === 'number' && uniforms.uSelectedInstance) {
         uniforms.uSelectedInstance.value = instanceId;
      } else if (uniforms.uIsSelected) {
         uniforms.uIsSelected.value = true;
      }
    }
    
    // Attach TransformControls
    this.transformControls.detach();
    
    if (object instanceof THREE.InstancedMesh && typeof instanceId === 'number') {
       // Position dummy at instance matrix relative to its parent
       const matrix = new THREE.Matrix4();
       object.getMatrixAt(instanceId, matrix);
       
       // Add dummy to same parent to keep coordinate spaces aligned
       if (object.parent) {
         object.parent.add(this.dummyHelper);
       }
       
       matrix.decompose(this.dummyHelper.position, this.dummyHelper.quaternion, this.dummyHelper.scale);
       this.dummyHelper.updateMatrix();
       
       this.transformControls.attach(this.dummyHelper);
    } else {
       this.transformControls.attach(object);
    }
    
    if (this.onSelectionChange) {
      // Get Data
      let data: any = { type: 'unknown' };
      // How to get ID?
      // For InstancedMesh, we don't have ID unless mapped.
      // For Mesh (Trace), userData has ID.
      if (object.userData && object.userData.id) {
         data = { ...object.userData };
      }
      
      // Calculate Surface Area?
      // For Rect: width * height.
      // For Trace: length * width.
      
      this.onSelectionChange(data);
    }
  }
  
  private deselect() {
    if (this.selectedObject) {
      const { object, instanceId } = this.selectedObject;
      if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) {
        const uniforms = object.material.uniforms;
        if (typeof instanceId === 'number' && uniforms.uSelectedInstance) {
           uniforms.uSelectedInstance.value = -1;
        } else if (uniforms.uIsSelected) {
           uniforms.uIsSelected.value = false;
        }
      }
    }
    this.selectedObject = null;
    this.transformControls.detach();
    if (this.onSelectionChange) this.onSelectionChange(null);
  }

  public dispose() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    
    this.padSystem.dispose();
    this.traceSystem.dispose();
    this.holeSystem.dispose();
    
    this.renderer.dispose();
    this.controls.dispose();
    this.transformControls.dispose();
    
    // Dispose scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
