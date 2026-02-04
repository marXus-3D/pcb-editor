export interface BoardConfig {
  width: number;
  height: number;
  thickness: number;
}

export type Layer = 'top' | 'bottom';

export type ComponentType = 'smd_rect' | 'smd_round' | 'hole' | 'trace';

export interface BaseComponent {
  id: string;
  type: ComponentType;
  layer?: Layer;
}

export interface PadComponent extends BaseComponent {
  type: 'smd_rect' | 'smd_round';
  pos: [number, number, number]; // x, y, rotation (degrees) or just z? Let's assume x, y, rotation for now, but specs said [10, 0, 5] so maybe x, y, rotation? No, usually pos is x,y,z in 3D. But for PCB it's 2D+Layer. Let's stick to x,y,z world coords as per spec example.
  size: [number, number]; // width, height or radius, _
}

export interface TraceComponent extends BaseComponent {
  type: 'trace';
  points: [number, number][]; // Array of x,y points
  width: number;
}

export interface HoleComponent extends BaseComponent {
  type: 'hole';
  pos: [number, number]; // x, y
  radius: number;
}

export type PCBComponent = PadComponent | TraceComponent | HoleComponent;

export interface PCBState {
  board: BoardConfig;
  components: PCBComponent[];
}
