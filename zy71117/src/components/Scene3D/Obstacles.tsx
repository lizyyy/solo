import { Obstacle } from '../../types';

interface ObstaclesProps {
  obstacles: Obstacle[];
}

export function Obstacles({ obstacles }: ObstaclesProps) {
  return (
    <group>
      {obstacles.map((obstacle) => (
        <mesh
          key={obstacle.id}
          position={[obstacle.position.x, obstacle.size.y / 2, obstacle.position.z]}
        >
          <boxGeometry args={[obstacle.size.x, obstacle.size.y, obstacle.size.z]} />
          <meshStandardMaterial
            color={obstacle.color || '#8B4513'}
            metalness={0.2}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}
