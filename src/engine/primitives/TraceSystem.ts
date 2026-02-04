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
    // Filter out coincident points
    const rawPoints = trace.points;
    if (rawPoints.length < 2) return new THREE.BufferGeometry();
    
    const points: [number, number][] = [rawPoints[0]];
    for(let i=1; i<rawPoints.length; i++) {
        const prev = points[points.length-1];
        const curr = rawPoints[i];
        const distSq = (curr[0]-prev[0])**2 + (curr[1]-prev[1])**2;
        if (distSq > 0.000001) {
            points.push(curr);
        }
    }

    const width = trace.width;
    const halfWidth = width / 2;

    if (points.length < 2) return new THREE.BufferGeometry();

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let totalDistance = 0;

    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        
        // Calculate directions
        let dir1 = [0, 0];
        let dir2 = [0, 0];
        
        if (i > 0) {
          const prev = points[i-1];
          const dx = current[0] - prev[0];
          const dy = current[1] - prev[1];
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len > 0) dir1 = [dx/len, dy/len];
        }
        
        if (i < points.length - 1) {
          const next = points[i+1];
          const dx = next[0] - current[0];
          const dy = next[1] - current[1];
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len > 0) dir2 = [dx/len, dy/len];
        }
  
        // Calculate Miter Vector
        let offsetX = 0;
        let offsetY = 0;
  
        if (i === 0) {
          // Start: Normal of dir2
          // Normal (-dy, dx)
          offsetX = -dir2[1] * halfWidth;
          offsetY = dir2[0] * halfWidth;
        } else if (i === points.length - 1) {
          // End: Normal of dir1
          offsetX = -dir1[1] * halfWidth;
          offsetY = dir1[0] * halfWidth;
          
          // Update total distance
          const prev = points[i-1];
          const dx = current[0] - prev[0];
          const dy = current[1] - prev[1];
          totalDistance += Math.sqrt(dx*dx + dy*dy);
        } else {
          // Middle: Miter
          // Tangent = normalize(dir1 + dir2)
          const tx = dir1[0] + dir2[0];
          const ty = dir1[1] + dir2[1];
          const tLen = Math.sqrt(tx*tx + ty*ty);
          
          if (tLen > 0.001) {
            const tangent = [tx/tLen, ty/tLen];
            const miter = [-tangent[1], tangent[0]]; // Normal to tangent
            
            // Normal of seg1
            const n1 = [-dir1[1], dir1[0]];
            
            // Length = halfWidth / dot(miter, n1)
            const dot = miter[0]*n1[0] + miter[1]*n1[1];
            // Avoid division by zero and excessive miter length
            const miterLen = halfWidth / (Math.abs(dot) < 0.1 ? 0.1 : dot); 
            
            offsetX = miter[0] * miterLen;
            offsetY = miter[1] * miterLen;
          } else {
             // 180 degree turn or zero length segments - fallback to normal
             const n1 = [-dir1[1], dir1[0]];
             offsetX = n1[0] * halfWidth;
             offsetY = n1[1] * halfWidth;
          }

          // Update distance
          const prev = points[i-1];
          const dx = current[0] - prev[0];
          const dy = current[1] - prev[1];
          totalDistance += Math.sqrt(dx*dx + dy*dy);
        }
  
        // Vertices
        // Left: P + Offset (U=1)
        vertices.push(current[0] + offsetX, 0, current[1] + offsetY);
        uvs.push(1, totalDistance);
        
        // Right: P - Offset (U=0)
        vertices.push(current[0] - offsetX, 0, current[1] - offsetY);
        uvs.push(0, totalDistance);
        
        // Indices
        if (i < points.length - 1) {
          const base = i * 2;
          // Connect current segment to next
          // Current: base, base+1
          // Next (i+1): base+2, base+3
          
          // Triangle 1: Left(Base), Left(Next), Right(Base) -> 0, 2, 1 (CCW)
          indices.push(base, base+2, base+1);
          // Triangle 2: Right(Base), Left(Next), Right(Next) -> 1, 2, 3 (CCW)
          indices.push(base+1, base+2, base+3);
        }
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
