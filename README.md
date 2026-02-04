# 3D PCB Viewer & Editor

A high-performance 3D PCB Viewer & Editor built with React and Vanilla Three.js.

## Features

- **Performance**: Renders 100+ components efficiently using `InstancedMesh`.
- **Manifold Traces**: Renders traces as manifold geometry using triangulation.
- **Layers**: Distinguishes Top and Bottom layers with Z-spacing to avoid Z-fighting.
- **Visuals**: Custom ShaderMaterial for Brushed Copper effect and Edge highlighting.
- **Interaction**: Raycasting for picking, hover effects, and TransformControls for movement.
- **Persistence**: Save and Load PCB layouts via JSON.

## Technical Implementation

### Performance Strategy (`InstancedMesh`)
To handle many small pads efficiently, we use `THREE.InstancedMesh`. This allows rendering thousands of identical geometries (e.g., SMD pads) in a single draw call.
- **PadSystem**: Manages `InstancedMesh` for different pad types (Rectangular, Circular).
- **Updates**: When a pad moves, we update only the specific instance matrix and set `instanceMatrix.needsUpdate = true`.

### Z-Fighting Mitigation
To prevent visual artifacts where copper elements flickr against the board substrate:
- **Layer Groups**: We distinguish `Top` and `Bottom` layers.
- **Physical Offset**: The `Top` layer group is offset by `+0.005` units from the board surface, and `Bottom` by `-0.005`. This ensures distinct depth for the depth buffer while appearing flat to the user.

### Shaders & Materials
- **CopperMaterial**: A custom `ShaderMaterial` that implements:
  - **Procedural Brushed Metal**: using noise in the fragment shader. 
  - **Edge Highlighting**: Uses UV coordinates to draw borders on pads and traces without extra geometry.
  - **Instanced Highlighting**: Uses `gl_InstanceID` in the vertex shader to highlight specific instances when hovered or selected.

## Interaction
- **Raycasting**: Implemented in `PCBRenderer` to detect hits on both InstancedMeshes and regular Meshes.
- **Selection**: Clicking a component attaches `TransformControls` (constrained to XZ plane).
- **UI**: A sidebar displays the properties of the selected component in real-time.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```
