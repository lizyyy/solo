import { Obstacle } from '../../types/game';

interface Obstacle3DProps {
  obstacle: Obstacle;
  cellSize?: number;
  gridWidth: number;
  gridHeight: number;
}

export function Obstacle3D({ obstacle, cellSize = 1, gridWidth, gridHeight }: Obstacle3DProps) {
  const offsetX = -gridWidth * cellSize / 2;
  const offsetZ = -gridHeight * cellSize / 2;

  const x = obstacle.position.x * cellSize + cellSize / 2 + offsetX;
  const z = obstacle.position.y * cellSize + cellSize / 2 + offsetZ;

  if (obstacle.type === 'pillar') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[cellSize * 0.3, cellSize * 0.35, 1, 16]} />
          <meshStandardMaterial color="#4a4a4a" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[cellSize * 0.35, cellSize * 0.3, 0.1, 16]} />
          <meshStandardMaterial color="#5a5a5a" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[cellSize * 0.9, 1, cellSize * 0.9]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[cellSize * 0.95, 0.1, cellSize * 0.95]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}
