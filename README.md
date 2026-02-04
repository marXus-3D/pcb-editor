# 3D PCB Viewer & Editor

A high-performance 3D PCB Viewer & Editor built with React and Vanilla Three.js.

## Features

- **Performance**: Renders a lot of components efficiently using `InstancedMesh`.
- **Manifold Traces**: Renders traces as manifold geometry using triangulation.
- **Layers**: Distinguishes Top and Bottom layers with Z-spacing to avoid Z-fighting.
- **Visuals**: Custom ShaderMaterial for Brushed Copper effect and Edge highlighting.
- **Interaction**: Raycasting for picking, hover effects, and TransformControls for movement.
- **Persistence**: Save and Load PCB layouts via JSON.

## Project Structure

```
src/
├── components/         # React components (UI, Canvas wrapper)
│   └── PCBEditor.tsx   # Main editor component
├── engine/             # Core 3D Engine (Three.js)
│   ├── primitives/     # Sub-systems for rendering board elements
│   │   ├── PadSystem.ts
│   │   ├── TraceSystem.ts
│   │   └── HoleSystem.ts
│   └── PCBRenderer.ts  # Main Renderer class
├── shaders/            # Custom GLSL Shaders
│   └── CopperMaterial.ts
└── types/              # TypeScript definitions
```

## Technical Implementation

### Performance Strategy: Instanced Rendering
Rendering a realistic PCB involves drawing potentially thousands of small, repetitive elements like SMD pads. Using standard `THREE.Mesh` object for each pad would result in thousands of draw calls, which is a significant bottleneck for the GPU and CPU communication.

To solve this, we utilize **`THREE.InstancedMesh`** within the `PadSystem` and `HoleSystem`.

*   **Single Draw Call**: All pads of the same type (e.g., all 0603 Rectangular Pads) are rendered in a single draw call, regardless of count.
*   **Matrix Management**: Each pad's position, rotation, and scale are encoded in a 4x4 matrix. This data is uploaded to the GPU as a texture or attribute buffer.
*   **Dynamic Updates**: When a component is moved by the user, we calculate its new matrix and update only that specific index in the `instanceMatrix` buffer, flagging it for re-upload. This ensures interaction remains silky smooth (60fps) even with high component counts.
*   **Shader Integration**: Our custom `CopperMaterial` shader is instance-aware (`uIsInstanced`), allowing us to pass per-instance state (like Hover and Selection status) via uniforms or attributes, preventing the need to clone materials for highlighting.

### Z-Fighting Mitigation Strategy
Z-fighting occurs when two coplanar polygons share the exact same depth value, causing the depth buffer to flicker between them. In a PCB viewer, this is a critical issue because traces, pads, and the board substrate often theoretically occupy the same 2D plane.

We employ a multi-layered physical offset strategy to eliminate this artifact robustly:

1.  **Layer Separation**: 
    *   The **Board Substrate** is centered at Y=0 with a defined thickness.
    *   The **Top Copper Layer** group is physically elevated by `+0.01` units above the board surface (`thickness/2`).
    *   The **Bottom Copper Layer** group is depressed by `-0.01` units below the board surface.
    
2.  **Component Stacking**:
    *   **Traces**: Rendered at the base level of their respective copper layer (local Y=0).
    *   **Pads**: Rendered with an additional small physical offset (`+0.01` on top, `-0.01` on bottom) relative to the copper layer. This ensures that pads always render *visually on top* of traces where they connect, mirroring physical PCB manufacturing (where plating adds thickness).

3.  **Material Configuration**:
    *   We disabled `polygonOffset` in the shader materials in favor of these deterministic physical offsets, as `polygonOffset` can behave inconsistently across different viewing angles and drivers.
    *   This approach ensures stable rendering from any camera distance or angle.

### Shaders & Materials
- **CopperMaterial**: A custom `ShaderMaterial` that implements:
  - **Procedural Brushed Metal**: Blinn-Phong lighting model combined with noise for a realistic shiny copper look.
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
