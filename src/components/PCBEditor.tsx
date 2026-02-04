import React, { useEffect, useRef } from 'react';
import { PCBRenderer } from '../engine/PCBRenderer';
import { BoardConfig, PCBComponent } from '../types';

const INITIAL_BOARD: BoardConfig = {
  width: 100,
  height: 80,
  thickness: 1.6
};

const generateDemoPCB = (): PCBComponent[] => {
  const components: PCBComponent[] = [];
  let idCounter = 0;
  const nextId = () => `cmp_${idCounter++}`;

  // 1. MCU - QFP-32 (Center)
  const mcuX = 0;
  const mcuZ = 0;
  const mcuPitch = 1.0;
  const mcuOffset = 6; 

  for (let i = 0; i < 8; i++) {
    const offset = (i - 3.5) * mcuPitch;
    // Top Row
    components.push({ id: nextId(), type: 'smd_rect', pos: [mcuX + offset, 0, mcuZ - mcuOffset], size: [0.6, 1.5], layer: 'top' });
    // Bottom Row
    components.push({ id: nextId(), type: 'smd_rect', pos: [mcuX + offset, 0, mcuZ + mcuOffset], size: [0.6, 1.5], layer: 'top' });
    // Left Row
    components.push({ id: nextId(), type: 'smd_rect', pos: [mcuX - mcuOffset, 0, mcuZ + offset], size: [1.5, 0.6], layer: 'top' });
    // Right Row
    components.push({ id: nextId(), type: 'smd_rect', pos: [mcuX + mcuOffset, 0, mcuZ + offset], size: [1.5, 0.6], layer: 'top' });
  }

  // 2. Memory - SOP-16 (Right side)
  const memX = 25;
  const memZ = 0;
  const memOffset = 4;
  for(let i=0; i<8; i++) {
      const offset = (i - 3.5) * 1.27;
      components.push({ id: nextId(), type: 'smd_rect', pos: [memX - memOffset, 0, memZ + offset], size: [1.5, 0.6], layer: 'top' });
      components.push({ id: nextId(), type: 'smd_rect', pos: [memX + memOffset, 0, memZ + offset], size: [1.5, 0.6], layer: 'top' });
  }
  
  // 3. Power Regulator (Top Left)
  const pwrX = -30;
  const pwrZ = -15;
  components.push({ id: nextId(), type: 'smd_rect', pos: [pwrX, 0, pwrZ], size: [4, 6], layer: 'top' }); // Tab
  components.push({ id: nextId(), type: 'smd_rect', pos: [pwrX - 3, 0, pwrZ + 5], size: [1.5, 2], layer: 'top' }); // Pin 1
  components.push({ id: nextId(), type: 'smd_rect', pos: [pwrX + 3, 0, pwrZ + 5], size: [1.5, 2], layer: 'top' }); // Pin 3

  // 4. Connector - Bottom Edge
  for(let i=0; i<20; i++) {
      const x = -38 + i * 4;
      components.push({ id: nextId(), type: 'hole', pos: [x, 30], radius: 0.8 });
      components.push({ id: nextId(), type: 'smd_round', pos: [x, 0, 30], size: [2.2, 2.2], layer: 'top' });
      components.push({ id: nextId(), type: 'smd_round', pos: [x, 0, 30], size: [2.2, 2.2], layer: 'bottom' });
  }

  // 5. Decoupling Caps (Around MCU)
  for(let i=0; i<16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const radius = 9;
      // Skip areas where traces need to go out (Right side)
      if (Math.abs(angle) < 0.5) continue; 
      
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      
      const dx = Math.cos(angle) * 1.0; // spacing delta
      const dz = Math.sin(angle) * 1.0;
      
      // 2 Pads per cap
      components.push({ id: nextId(), type: 'smd_rect', pos: [cx - dx, 0, cz - dz], size: [0.8, 1.2], layer: 'top' });
      components.push({ id: nextId(), type: 'smd_rect', pos: [cx + dx, 0, cz + dz], size: [0.8, 1.2], layer: 'top' });
  }

  // 6. Traces
  // Bus: MCU Right -> Memory Left
  for(let i=0; i<8; i++) {
     const startZ = (i - 3.5) * mcuPitch;
     const endZ = (i - 3.5) * 1.27;
     const p1: [number, number] = [mcuOffset, startZ];
     const p2: [number, number] = [mcuOffset + 3 + Math.abs(startZ)*0.5, startZ]; // Fanout slightly
     const p3: [number, number] = [memX - memOffset - 3 - Math.abs(endZ)*0.5, endZ];
     const p4: [number, number] = [memX - memOffset, endZ];
     
     components.push({ id: nextId(), type: 'trace', points: [p1, p2, p3, p4], width: 0.25, layer: 'top' });
  }
  
  // Power Fanout
  components.push({ id: nextId(), type: 'trace', points: [[pwrX, pwrZ+3], [pwrX, 0], [mcuX - mcuOffset, 0]], width: 1.0, layer: 'top' });
  
  // Connector Fanout (to MCU Bottom)
  for(let i=0; i<8; i++) {
      const padX = (i - 3.5) * mcuPitch;
      const connX = -4 + i * 2; // Arbitrary pins on connector
      
      components.push({ id: nextId(), type: 'trace', points: [[padX, mcuOffset], [padX, mcuOffset + 5], [connX, 25], [connX, 30]], width: 0.3, layer: 'top' });
  }
  
  // Perimeter Ground Ring
  components.push({ id: nextId(), type: 'trace', points: [[-45, -35], [45, -35], [45, 35], [-45, 35], [-45, -35]], width: 0.5, layer: 'bottom' });
  
  // Mounting Holes
  components.push({ id: nextId(), type: 'hole', pos: [-45, -35], radius: 1.6 });
  components.push({ id: nextId(), type: 'hole', pos: [45, -35], radius: 1.6 });
  components.push({ id: nextId(), type: 'hole', pos: [45, 35], radius: 1.6 });
  components.push({ id: nextId(), type: 'hole', pos: [-45, 35], radius: 1.6 });

  return components;
};

const INITIAL_COMPONENTS: PCBComponent[] = generateDemoPCB();

export const PCBEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PCBRenderer | null>(null);
  const [selectedData, setSelectedData] = React.useState<any>(null);
  const [boardConfig, setBoardConfig] = React.useState<BoardConfig>(INITIAL_BOARD);
  const [components, setComponents] = React.useState<PCBComponent[]>(INITIAL_COMPONENTS);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new PCBRenderer(containerRef.current);
    rendererRef.current = renderer;
    
    renderer.onSelectionChange = (data) => setSelectedData(data);
    renderer.initBoard(boardConfig);
    renderer.updateComponents(components);

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Sync state with renderer
  useEffect(() => {
     if (rendererRef.current) rendererRef.current.initBoard(boardConfig);
  }, [boardConfig]);

  useEffect(() => {
     if (rendererRef.current) rendererRef.current.updateComponents(components);
  }, [components]);

  const handleDownload = () => {
    const data = { board: boardConfig, components };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pcb-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (json.board && json.components) {
            setBoardConfig(json.board);
            setComponents(json.components);
          } else {
            alert('Invalid PCB JSON format');
          }
        } catch (err) {
          console.error(err);
          alert('Failed to parse JSON');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    }
  };

  const addComponent = (type: string) => {
    const id = `new_${Date.now()}`;
    let newComp: PCBComponent;
    
    switch(type) {
        case 'smd_rect':
            newComp = { id, type: 'smd_rect', pos: [0, 0, 0], size: [2, 1], layer: 'top' };
            break;
        case 'smd_round':
            newComp = { id, type: 'smd_round', pos: [5, 0, 0], size: [1, 1], layer: 'top' };
            break;
        case 'hole':
            newComp = { id, type: 'hole', pos: [0, 0], radius: 1 };
            break;
        case 'trace':
            newComp = { id, type: 'trace', points: [[-5, -5], [5, 5]], width: 0.5, layer: 'top' };
            break;
        default: return;
    }
    setComponents([...components, newComp]);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
      
      {/* Top Bar: Tools */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: 10, background: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 8 }}>
        <button onClick={handleDownload} style={btnStyle}>Save JSON</button>
        <label style={btnStyle}>
          Load JSON
          <input type="file" accept=".json" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
        <div style={{ width: 1, background: '#666', margin: '0 5px' }} />
        <button onClick={() => addComponent('smd_rect')} style={btnStyle}>+ Rect Pad</button>
        <button onClick={() => addComponent('smd_round')} style={btnStyle}>+ Round Pad</button>
        <button onClick={() => addComponent('hole')} style={btnStyle}>+ Hole</button>
        <button onClick={() => addComponent('trace')} style={btnStyle}>+ Trace</button>
      </div>

      {/* Right Panel: Board Config */}
      <div style={{ 
          position: 'absolute', top: 20, right: 20, width: 250, 
          background: 'rgba(30,30,30,0.9)', color: 'white', padding: 20, borderRadius: 8 
      }}>
          <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: 10 }}>PCB Configuration</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label>
                  Width (mm)
                  <input 
                      type="number" 
                      value={boardConfig.width}
                      onChange={e => setBoardConfig({...boardConfig, width: parseFloat(e.target.value)})}
                      style={inputStyle}
                  />
              </label>
              <label>
                  Height (mm)
                  <input 
                      type="number" 
                      value={boardConfig.height}
                      onChange={e => setBoardConfig({...boardConfig, height: parseFloat(e.target.value)})}
                      style={inputStyle}
                  />
              </label>
              <label>
                  Thickness (mm)
                  <input 
                      type="number" 
                      value={boardConfig.thickness}
                      onChange={e => setBoardConfig({...boardConfig, thickness: parseFloat(e.target.value)})}
                      style={inputStyle}
                  />
              </label>
          </div>

          <div style={{ marginTop: 20, fontSize: 12, color: '#aaa' }}>
              Components: {components.length} <br/>
              Selected ID: {selectedData?.object?.userData?.id || 'None'}
          </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: '#444',
    color: 'white',
    border: '1px solid #666',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 6,
    marginTop: 4,
    background: '#222',
    border: '1px solid #444',
    color: 'white',
    borderRadius: 4
};
