import { useMemo } from 'react';
import { CONFIG } from '../engine/config';
import { GridCell } from '../engine/types';

interface WaterEffectProps {
  grid: GridCell[][];
}

export function WaterEffect({ grid }: WaterEffectProps) {
  const waterCells = useMemo(() => {
    const cells: { x: number; z: number; depth: number }[] = [];
    
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        const cell = grid[y]?.[x];
        if (cell && cell.waterDepth > 0.1 && cell.type !== 'building') {
          cells.push({
            x: x * CONFIG.CELL_SIZE - (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2 + CONFIG.CELL_SIZE / 2,
            z: y * CONFIG.CELL_SIZE - (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2 + CONFIG.CELL_SIZE / 2,
            depth: cell.waterDepth,
          });
        }
      }
    }
    return cells;
  }, [grid]);

  return (
    <group>
      {waterCells.map((cell, index) => {
        const waterHeight = Math.min(cell.depth * 0.15, 2);
        const opacity = Math.min(0.3 + cell.depth * 0.08, 0.8);
        
        return (
          <mesh key={index} position={[cell.x, waterHeight / 2 + 0.1, cell.z]}>
            <boxGeometry args={[CONFIG.CELL_SIZE * 0.85, waterHeight, CONFIG.CELL_SIZE * 0.85]} />
            <meshStandardMaterial
              color="#165DFF"
              transparent
              opacity={opacity}
              metalness={0.3}
              roughness={0.1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
