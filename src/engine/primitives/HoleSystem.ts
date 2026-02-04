import * as THREE from 'three';
import { PCBComponent, HoleComponent } from '../../types';
import { PCBRenderer } from '../PCBRenderer';

export class HoleSystem {
  private renderer: PCBRenderer;
  private mesh: THREE.InstancedMesh | null = null;
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshBasicMaterial;

  constructor(renderer: PCBRenderer) {
    this.renderer = renderer;
    // Simple black cylinder to simulate hole
    this.geometry = new THREE.CylinderGeometry(1, 1, 1, 32);
    this.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  }

  public update(components: PCBComponent[], boardThickness: number) {
    this.disposeMesh();

    const holes = components.filter(c => c.type === 'hole') as HoleComponent[];
    if (holes.length === 0) return;

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, holes.length);
    const dummy = new THREE.Object3D();

    holes.forEach((hole, i) => {
      // Position: x, y (2D). Z needs to be center of board?
      // Board is at y = 0 relative to 'board' layer? No, board layer is at 0.
      // Board mesh is at y = -thickness/2?
      // Wait, in PCBRenderer:
      // this.boardMesh.position.y = -config.thickness / 2; // Top surface at y=0 ??
      // Actually if BoxGeometry height (thickness) is T.
      // Center is 0. So ranges from -T/2 to T/2.
      // If position.y = -T/2.
      // Then range is [-T, 0].
      // So Top surface IS at 0.
      
      // So holes should be centered at -T/2, with height T.
      // Actually height T+epsilon.
      
      dummy.position.set(hole.pos[0], -boardThickness / 2, hole.pos[1]); // x, z maps to x, z in 3D?
      // Wait, standard mapping:
      // PCB X -> 3D X
      // PCB Y -> 3D Z?
      // My PadSystem used `dummy.position.set(pad.pos[0], 0, pad.pos[2])`.
      // Spec: pos: [10, 0, 5]. x=10, y=0, z=5.
      // So PCB space IS 3D space?
      // Or is "pos" just an array and Schema says `pos: [10, 0, 5]`.
      // Usually PCB is 2D. But simple viewer might use 3D coords for everything.
      // Let's assume input `pos` corresponds to World `x, y, z`.
      // But for Holes, we usually only have x,y (2D).
      // `HoleComponent` interface says `pos: [number, number]`.
      // So x, y.
      // We map this to 3D X, Z.
      
      // Rotation: Cylinder default is along Y axis. Correct.
      
      dummy.scale.set(hole.radius, boardThickness * 1.05, hole.radius); // Slightly longer than thickness
      dummy.updateMatrix();
      this.mesh!.setMatrixAt(i, dummy.matrix);
    });

    this.mesh.instanceMatrix.needsUpdate = true;
    
    // Add to 'board' layer or 'drills' layer?
    // 'board' layer is a Group.
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
