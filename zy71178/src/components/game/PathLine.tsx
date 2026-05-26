import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Position } from '../../types/game';

interface PathLineProps {
  path: Position[];
  startPosition: Position;
  color: string;
  cellSize?: number;
  gridWidth: number;
  gridHeight: number;
  isPreview?: boolean;
}

export function PathLine({ 
  path, 
  startPosition, 
  color, 
  cellSize = 1, 
  gridWidth, 
  gridHeight,
  isPreview = false 
}: PathLineProps) {
  const points = useMemo(() => {
    if (path.length === 0) return [];
    
    const offsetX = -gridWidth * cellSize / 2;
    const offsetZ = -gridHeight * cellSize / 2;
    
    const result: [number, number, number][] = [];
    
    result.push([
      startPosition.x * cellSize + cellSize / 2 + offsetX,
      0.1,
      startPosition.y * cellSize + cellSize / 2 + offsetZ,
    ]);
    
    path.forEach((pos) => {
      result.push([
        pos.x * cellSize + cellSize / 2 + offsetX,
        0.1,
        pos.y * cellSize + cellSize / 2 + offsetZ,
      ]);
    });
    
    return result;
  }, [path, startPosition, cellSize, gridWidth, gridHeight]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={isPreview ? 2 : 3}
      dashed={isPreview}
      dashSize={0.2}
      gapSize={0.1}
      transparent
      opacity={isPreview ? 0.6 : 0.8}
    />
  );
}
