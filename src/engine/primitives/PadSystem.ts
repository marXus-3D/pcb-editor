import * as THREE from 'three';
import { PCBComponent, PadComponent } from '../../types';
import { PCBRenderer } from '../PCBRenderer';
import { createCopperMaterial } from '../../shaders/CopperMaterial';

export class PadSystem {
  private renderer: PCBRenderer;
  private meshes: Map<string, THREE.InstancedMesh> = new Map();
  private geometries: Map<string, THREE.BufferGeometry> = new Map();
  private materials: Map<string, THREE.ShaderMaterial> = new Map();

  constructor(renderer: PCBRenderer) {
    this.renderer = renderer;
    
    // Initialize geometries
    const rectGeo = new THREE.PlaneGeometry(1, 1);
    this.geometries.set('smd_rect', rectGeo);
    
    // Create Materials
    this.materials.set('smd_rect', createCopperMaterial('rect', true));
    this.materials.set('smd_round', createCopperMaterial('circle', true));
    
    // Map geometries to match materials keys or just use same keys
    const roundGeo = new THREE.CircleGeometry(1, 32);
    this.geometries.set('smd_round', roundGeo);
  }

  public update(components: PCBComponent[]) {
    // Clear existing meshes
    this.disposeMeshes();

    const pads = components.filter(c => c.type === 'smd_rect' || c.type === 'smd_round') as PadComponent[];
    if (pads.length === 0) return;

    // Group by type and layer ?
    // Actually, we can put all 'top' pads in one mesh and 'bottom' in another?
    // Or just one mesh per type, and move instances to correct Y?
    // The Renderer has specific groups for 'top' and 'bottom' layers.
    // If we want to use those groups, we need separate meshes for top and bottom pads 
    // OR we put the single mesh in a generic group and handle Y internally.
    // However, the 'top' group has a global Z-offset.
    // If I put a mesh in 'top' group, all its instances get that offset.
    // If I have one InstancedMesh, I can't put some instances in 'top' group and some in 'bottom' group.
    // I would need one InstancedMesh for TopRects, one for BottomRects, etc.
    
    // Grouping by type and layer to create InstancedMeshes

    const uniqueKeys = new Set(pads.map(p => `${p.type}:${p.layer || 'top'}`));
    
    uniqueKeys.forEach(key => {
      const [type, layer] = key.split(':') as [string, 'top' | 'bottom'];
      const groupPads = pads.filter(p => p.type === type && (p.layer || 'top') === layer);
      const geometry = this.geometries.get(type);
      const material = this.materials.get(type);

      if (geometry && material && groupPads.length > 0) {
        const mesh = new THREE.InstancedMesh(geometry, material, groupPads.length);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // If we plan to move them?
        
        mesh.userData = { componentIds: groupPads.map(p => p.id), type: type };
        
        const dummy = new THREE.Object3D();

        const yOffset = layer === 'bottom' ? -0.01 : 0.01;

        groupPads.forEach((pad, i) => {
          dummy.position.set(pad.pos[0], yOffset, pad.pos[2]); // Force Y to offset to sit on top of traces
           
           // Rotation - we need rotation in the data? Schema doesn't show it but usually pads have rotation.
           // Let's assume default 0 for now.
           
          dummy.rotation.x = -Math.PI / 2; // PlaneGeometry is XY, we need XZ. 
           // Wait, if I rotate the component instance, I rotate the geometry.
           // Plane is XY. detailed logic essential.
           
           // If I want pad on XZ plane:
           // PlaneGeometry default is in XY plane.
           // Rotate -90 deg around X axis -> flat on XZ.
           
          dummy.rotation.x = -Math.PI / 2;
           // Add pad rotation (around new Y axis which is World Y)?
           // For now just position.

           // Scale
          if (type === 'smd_rect') {
             dummy.scale.set(pad.size[0], pad.size[1], 1);
          } else if (type === 'smd_round') {
             // Size might be [radius, _] or just number? Schema says [2, 4] for rect.
             // For round, assume size[0] is radius?
             const radius = pad.size[0];
             dummy.scale.set(radius, radius, 1);
          }

          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          
          // Store userData for picking
           // We can't really store userdata per instance easily for Raycaster on InstancedMesh.
           // We have to use instanceId from intersection.
           // We'll map instanceId -> pad data in a side array if needed.
           // Or just trust the order.
        });

        mesh.instanceMatrix.needsUpdate = true;
        
        this.meshes.set(key, mesh);
        this.renderer.getLayerGroup(layer).add(mesh);
      }
    });

  }

  private disposeMeshes() {
    this.meshes.forEach(mesh => {
      // Remove from parent
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.dispose(); // Geometry is shared, don't dispose it here!
    });
    this.meshes.clear();
  }

  public dispose() {
    this.disposeMeshes();
    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
  }
}
