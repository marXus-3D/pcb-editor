import * as THREE from 'three';

export type CopperShapeType = 'rect' | 'circle' | 'trace';

export const CopperVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vIsHovered;
  varying float vIsSelected;
  
  uniform float uHoveredInstance;
  uniform float uSelectedInstance;
  uniform bool uIsHovered; // Global override for non-instanced
  uniform bool uIsSelected; // Global override for non-instanced
  uniform bool uIsInstanced;

  void main() {
    vUv = uv;
    vPosition = position;
    
    float instanceID = float(gl_InstanceID);
    
    // Check if this instance is hovered/selected
    bool instanceHovered = uIsInstanced && abs(instanceID - uHoveredInstance) < 0.5;
    bool instanceSelected = uIsInstanced && abs(instanceID - uSelectedInstance) < 0.5;
    
    vIsHovered = (instanceHovered || (!uIsInstanced && uIsHovered)) ? 1.0 : 0.0;
    vIsSelected = (instanceSelected || (!uIsInstanced && uIsSelected)) ? 1.0 : 0.0;

    // For instanced meshes, use instanceMatrix. For regular meshes, just use modelViewMatrix.
    #ifdef USE_INSTANCING
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    #else
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #endif
  }
`;

export const CopperFragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying float vIsHovered;
  varying float vIsSelected;
  
  uniform vec3 uColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uSelectedColor;
  
  uniform float uEdgeWidth;
  uniform int uShapeType; // 0: rect, 1: circle, 2: trace

  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    // Edge Logic
    float edge = 0.0;
    
    if (uShapeType == 0) { // Rect
        // UVs 0..1
        vec2 d = step(vec2(uEdgeWidth), vUv) * step(vec2(uEdgeWidth), 1.0 - vUv);
        edge = 1.0 - (d.x * d.y);
    } else if (uShapeType == 1) { // Circle
        // Center 0.5, Radius 0.5
        float dist = distance(vUv, vec2(0.5));
        // Edge if dist > 0.5 - edgeWidth
        edge = step(0.5 - uEdgeWidth, dist);
        // Crop outside circle (optional, but circle geom usually handles it)
        if (dist > 0.5) discard;
    } else if (uShapeType == 2) { // Trace
        // Edge only on sides (uEdgeWidth on V, or U? usually U is width)
        // Assume UV mapping: U [0..1] across width
        float d = step(uEdgeWidth * 2.0, vUv.x) * step(uEdgeWidth * 2.0, 1.0 - vUv.x); 
        // * 2.0 because trace width might be mapped differently or we want thicker edge
        edge = 1.0 - d;
    }

    // Brushed metal effect
    float noise = random(vec2(vUv.x, vUv.y * 100.0));
    vec3 baseColor = uColor * (0.8 + 0.2 * noise);
    
    // Mix Colors
    vec3 finalColor = baseColor;
    
    if (vIsSelected > 0.5) {
        finalColor = mix(finalColor, uSelectedColor, 0.5);
    } else if (vIsHovered > 0.5) {
        finalColor = mix(finalColor, uHighlightColor, 0.3);
    }
    
    // Apply Edge
    if (edge > 0.5) {
        vec3 edgeCol = uEdgeColor;
        if (vIsSelected > 0.5) edgeCol = uSelectedColor;
        else if (vIsHovered > 0.5) edgeCol = uHighlightColor;
        
        finalColor = edgeCol;
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const createCopperMaterial = (shapeType: CopperShapeType, isInstanced: boolean = true, color: number = 0xb87333) => {
  let typeInt = 0;
  if (shapeType === 'circle') typeInt = 1;
  if (shapeType === 'trace') typeInt = 2;

  return new THREE.ShaderMaterial({
    vertexShader: CopperVertexShader,
    fragmentShader: CopperFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uEdgeColor: { value: new THREE.Color(0x333333) },
      uHighlightColor: { value: new THREE.Color(0xffff00) },
      uSelectedColor: { value: new THREE.Color(0x00ff00) },
      
      uHoveredInstance: { value: -1 },
      uSelectedInstance: { value: -1 },
      uIsHovered: { value: false },
      uIsSelected: { value: false },
      uIsInstanced: { value: isInstanced },
      
      uEdgeWidth: { value: 0.05 }, // UV space width
      uShapeType: { value: typeInt }
    },
    side: THREE.DoubleSide,
    // Use polygonOffset for traces to prevent Z-fighting with pads
    // Disabled: Handled via physical offset in geometry
    polygonOffset: false,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: 0
  });
};
