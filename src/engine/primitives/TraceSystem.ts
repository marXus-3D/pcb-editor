import * as THREE from 'three';
import { PCBComponent, TraceComponent } from '../../types';
import { PCBRenderer } from '../PCBRenderer';
import { createCopperMaterial } from '../../shaders/CopperMaterial';

export class TraceSystem {
  private renderer: PCBRenderer;
  private meshes: Map<string, THREE.Mesh> = new Map();
  private material: THREE.ShaderMaterial;

  constructor(renderer: PCBRenderer) {
    this.renderer = renderer;
    this.material = createCopperMaterial('trace', false);
  }

  public update(components: PCBComponent[]) {
    this.disposeMeshes();

    const traces = components.filter(c => c.type === 'trace') as TraceComponent[];
    
    traces.forEach(trace => {
      const geometry = this.createTraceGeometry(trace);
      const mesh = new THREE.Mesh(geometry, this.material);
      
      mesh.userData = { id: trace.id, type: 'trace' };
      
      const layer = trace.layer || 'top';
      this.renderer.getLayerGroup(layer).add(mesh);
      this.meshes.set(trace.id, mesh);
    });
  }

  private createTraceGeometry(trace: TraceComponent): THREE.BufferGeometry {
    const points = trace.points;
    const width = trace.width;
    const halfWidth = width / 2;

    if (points.length < 2) return new THREE.BufferGeometry();

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertIndex = 0;
    let totalDistance = 0;

    // Helper to get normal 2D
    const getNormal = (p1: number[], p2: number[]) => {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len === 0) return [0, 0];
      return [-dy/len, dx/len]; // Normal (-y, x)
    };

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i+1];
      
      const segDx = p2[0] - p1[0];
      const segDy = p2[1] - p1[1];
      const segLen = Math.sqrt(segDx*segDx + segDy*segDy);

      const [nx, ny] = getNormal(p1, p2);
      const wx = nx * halfWidth;
      const wy = ny * halfWidth;
      
      // Project to XZ plane (Input Y becomes Z)
      
      // v0: P1 + N -> U=1
      vertices.push(p1[0] + wx, 0, p1[1] + wy);
      uvs.push(1, totalDistance);
      
      // v1: P1 - N -> U=0
      vertices.push(p1[0] - wx, 0, p1[1] - wy);
      uvs.push(0, totalDistance);
      
      // v2: P2 - N -> U=0
      vertices.push(p2[0] - wx, 0, p2[1] - wy);
      uvs.push(0, totalDistance + segLen);
      
      // v3: P2 + N -> U=1
      vertices.push(p2[0] + wx, 0, p2[1] + wy);
      uvs.push(1, totalDistance + segLen);

      // Indices for 2 triangles
      // Ensure Counter-Clockwise winding for Up-facing normals
      // v0 (Right-Back), v1 (Left-Back), v2 (Left-Front), v3 (Right-Front)
      // Triangle 1: 0, 1, 2
      // Triangle 2: 0, 2, 3
      indices.push(vertIndex, vertIndex + 1, vertIndex + 2);
      indices.push(vertIndex, vertIndex + 2, vertIndex + 3);
      
      vertIndex += 4;
      totalDistance += segLen;
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    
    return geo;
  }

  private disposeMeshes() {
    this.meshes.forEach(mesh => {
      if (mesh.parent) mesh.parent.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      // Material is shared
    });
    this.meshes.clear();
  }

  public dispose() {
    this.disposeMeshes();
    this.material.dispose();
  }
}
