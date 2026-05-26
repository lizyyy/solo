import { useMemo } from 'react';
import { Line } from '@react-three/drei';

interface GridFloorProps {
  width: number;
  height: number;
  cellSize?: number;
}

export function GridFloor({ width, height, cellSize = 1 }: GridFloorProps) {
  const lines = useMemo(() => {
    const result: { start: [number, number, number]; end: [number, number, number] }[] = [];
    
    for (let x = 0; x <= width; x++) {
      result.push({
        start: [x * cellSize, 0, 0],
        end: [x * cellSize, 0, height * cellSize],
      });
    }
    
    for (let z = 0; z <= height; z++) {
      result.push({
        start: [0, 0, z * cellSize],
        end: [width * cellSize, 0, z * cellSize],
      });
    }
    
    return result;
  }, [width, height, cellSize]);

  return (
    <group position={[-width * cellSize / 2, 0, -height * cellSize / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width * cellSize / 2, -0.01, height * cellSize / 2]}>
        <planeGeometry args={[width * cellSize, height * cellSize]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      
      {lines.map((line, i) => (
        <Line
          key={i}
          points={[line.start, line.end]}
          color="#2d2d44"
          lineWidth={1}
        />
      ))}
    </group>
  );
}
