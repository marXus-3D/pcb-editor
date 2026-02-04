import React, { useEffect, useRef } from 'react';
import { PCBRenderer } from '../engine/PCBRenderer';
import { BoardConfig, PCBComponent } from '../types';

const INITIAL_BOARD: BoardConfig = {
  width: 100,
  height: 80,
  thickness: 1.6
};

const INITIAL_COMPONENTS: PCBComponent[] = [
  // Pads
  { id: 'pad_1', type: 'smd_rect', pos: [10, 0, 5], size: [3, 5], layer: 'top' },
  { id: 'pad_2', type: 'smd_rect', pos: [10, 0, -5], size: [3, 5], layer: 'top' },
  { id: 'pad_3', type: 'smd_round', pos: [-10, 0, 5], size: [2, 2], layer: 'top' },
  { id: 'pad_4', type: 'smd_round', pos: [-10, 0, -5], size: [2, 2], layer: 'top' },
  
  // Through-holes (larger for visibility)
  { id: 'hole_1', type: 'hole', pos: [0, 10], radius: 1.5 },
  { id: 'hole_2', type: 'hole', pos: [0, -10], radius: 1.5 },
  { id: 'hole_3', type: 'hole', pos: [20, 0], radius: 2 },
  
  // Traces (wider for visibility)
  { id: 'trace_1', type: 'trace', points: [[-10, 5], [0, 5], [0, 10]], width: 1.5, layer: 'top' },
  { id: 'trace_2', type: 'trace', points: [[10, 5], [20, 5], [20, 15], [30, 15]], width: 1, layer: 'top' },
  { id: 'trace_3', type: 'trace', points: [[-10, -5], [10, -5]], width: 2, layer: 'top' }
];

export const PCBEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PCBRenderer | null>(null);
  const [selectedData, setSelectedData] = React.useState<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Renderer
    const renderer = new PCBRenderer(containerRef.current);
    rendererRef.current = renderer;
    
    // Bind Interaction Callback
    renderer.onSelectionChange = (data) => {
      setSelectedData(data);
    };

    // Initialize Board
    renderer.initBoard(INITIAL_BOARD);
    
    // Add Components
    renderer.updateComponents(INITIAL_COMPONENTS);

    // Cleanup
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  const handleDownload = () => {
    const data = rendererRef.current?.save();
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pcb-layout.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && rendererRef.current) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (json.board && json.components) {
            rendererRef.current?.initBoard(json.board);
            rendererRef.current?.updateComponents(json.components);
          } else {
            alert('Invalid PCB JSON format');
          }
        } catch (err) {
          console.error(err);
          alert('Failed to parse JSON');
        }
      };
      reader.readAsText(file);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
      
      {/* Toolbar */}
      <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          display: 'flex',
          gap: 10
      }}>
        <button 
          onClick={handleDownload}
          style={{ padding: '8px 16px', background: '#2e8b57', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Save / Export JSON
        </button>
        <label style={{ padding: '8px 16px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: 4, cursor: 'pointer' }}>
          Load JSON
          <input type="file" accept=".json" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      </div>
      
      {/* Sidebar */}
      {selectedData && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 250,
          background: 'rgba(32, 32, 32, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #444',
          borderRadius: 8,
          padding: 20,
          color: 'white',
          fontFamily: 'monospace'
        }}>
          <h3>Component Data</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <strong>ID:</strong> {selectedData.id || 'N/A'}
            </div>
            <div>
              <strong>Type:</strong> {selectedData.type || 'Unknown'}
            </div>
            {selectedData.pos && (
              <div>
                <strong>Position:</strong>
                <div style={{ paddingLeft: 10 }}>
                  X: {selectedData.pos[0]?.toFixed(2)}<br/>
                  Y: {selectedData.pos[1]?.toFixed(2)}<br/>
                  Z: {selectedData.pos[2]?.toFixed(2)}
                </div>
              </div>
            )}
            {/* Surface Area Calculation Mockup */}
            {selectedData.size && (
              <div>
                 <strong>Area:</strong> {(selectedData.size[0] * (selectedData.size[1] || selectedData.size[0])).toFixed(2)} units²
              </div>
            )}
          </div>
        </div>
      )}
      
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        color: '#888',
        pointerEvents: 'none'
      }}>
        Left Click to Select • Drag Gizmo to Move • Right Click to Rotate Camera
      </div>
    </div>
  );
};
