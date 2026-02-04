import * as THREE from 'three';
import { PCBComponent, HoleComponent } from '../../types';
import { PCBRenderer } from '../PCBRenderer';

export class HoleSystem {
  private renderer: PCBRenderer;
  private mesh: THREE.InstancedMesh | null = null;
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshStandardMaterial;

  constructor(renderer: PCBRenderer) {
    this.renderer = renderer;
    // Cylinder geometry for holes - slightly dark to simulate depth
    this.geometry = new THREE.CylinderGeometry(1, 1, 1, 32);
    this.material = new THREE.MeshStandardMaterial({ 
      color: 0x111111, // Very dark gray
      metalness: 0.8,
      roughness: 0.3
    });
  }

  public update(components: PCBComponent[], boardThickness: number) {
    this.disposeMesh();

    const holes = components.filter(c => c.type === 'hole') as HoleComponent[];
    if (holes.length === 0) return;

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, holes.length);
    const dummy = new THREE.Object3D();

    holes.forEach((hole, i) => {
      // Position: hole.pos is [x, y] in 2D PCB space.
      // Map to 3D: X -> X, Y -> Z, and center the hole at Y=0 (middle of board).
      // The board geometry is centered at Y=0, ranging from -thickness/2 to +thickness/2.
      // So holes centered at Y=0 will "drill through" the middle of the board.
      dummy.position.set(hole.pos[0], 0, hole.pos[1]);
      
      // Scale: radius for X and Z, board thickness for Y (height of cylinder)
      dummy.scale.set(hole.radius, boardThickness * 1.1, hole.radius); // Slightly longer than thickness
      dummy.updateMatrix();
      this.mesh!.setMatrixAt(i, dummy.matrix);
    });

    this.mesh.instanceMatrix.needsUpdate = true;
    
    // Add to 'board' layer
    this.renderer.getLayerGroup('board').add(this.mesh);
  }

  private disposeMesh() {
    if (this.mesh) {
      if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = null;
    }
  }

  public dispose() {
    this.disposeMesh();
    this.geometry.dispose();
    this.material.dispose();
  }
}
