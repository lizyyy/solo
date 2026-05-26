import { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG, COLORS } from '../engine/config';
import { GridCell } from '../engine/types';

interface CityGridProps {
  grid: GridCell[][];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
}

export function CityGrid({ grid, selectedCell, onCellClick }: CityGridProps) {
  const { cellPositions, cellColors, cellHeights } = useMemo(() => {
    const positions: [number, number, number][] = [];
    const colors: string[] = [];
    const heights: number[] = [];

    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
      for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
        const cell = grid[y]?.[x];
        if (!cell) continue;

        positions.push([
          x * CONFIG.CELL_SIZE - (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2 + CONFIG.CELL_SIZE / 2,
          0,
          y * CONFIG.CELL_SIZE - (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2 + CONFIG.CELL_SIZE / 2,
        ]);

        let color = COLORS.road;
        if (cell.type === 'building') color = COLORS.building;
        if (cell.type === 'lowland') color = COLORS.lowland;
        if (cell.type === 'drain') color = COLORS.primary;
        if (cell.type === 'pump') color = COLORS.warning;

        colors.push(color);
        heights.push(cell.type === 'building' ? 4 : cell.elevation * 0.2);
      }
    }

    return { cellPositions: positions, cellColors: colors, cellHeights: heights };
  }, [grid]);

  const handleClick = (event: ThreeEvent<MouseEvent>, x: number, y: number) => {
    event.stopPropagation();
    onCellClick(x, y);
  };

  return (
    <group>
      {cellPositions.map((pos, index) => {
        const x = index % CONFIG.GRID_SIZE;
        const y = Math.floor(index / CONFIG.GRID_SIZE);
        const isSelected = selectedCell?.x === x && selectedCell?.y === y;
        const height = cellHeights[index];

        return (
          <group key={index}>
            <mesh
              position={[pos[0], height / 2, pos[2]]}
              onClick={(e) => handleClick(e, x, y)}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[CONFIG.CELL_SIZE * 0.9, height, CONFIG.CELL_SIZE * 0.9]} />
              <meshStandardMaterial
                color={isSelected ? '#FFD700' : cellColors[index]}
                emissive={isSelected ? '#FFD700' : '#000000'}
                emissiveIntensity={isSelected ? 0.3 : 0}
                metalness={0.1}
                roughness={0.8}
              />
            </mesh>
            {isSelected && (
              <mesh position={[pos[0], 0.05, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[CONFIG.CELL_SIZE * 0.4, CONFIG.CELL_SIZE * 0.48, 32]} />
                <meshBasicMaterial color="#FFD700" side={THREE.DoubleSide} transparent opacity={0.8} />
              </mesh>
            )}
          </group>
        );
      })}
      <gridHelper
        args={[
          CONFIG.GRID_SIZE * CONFIG.CELL_SIZE + 5,
          CONFIG.GRID_SIZE,
          COLORS.gridLine,
          COLORS.gridLine,
        ]}
        position={[0, 0.02, 0]}
      />
    </group>
  );
}
