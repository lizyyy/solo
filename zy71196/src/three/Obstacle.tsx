import type { Obstacle as ObstacleType } from '../game/types';

interface ObstacleProps {
  obstacle: ObstacleType;
}

export function Obstacle({ obstacle }: ObstacleProps) {
  const renderObstacle = () => {
    switch (obstacle.type) {
      case 'vent':
        return (
          <group>
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[obstacle.width, 0.6, obstacle.height]} />
              <meshStandardMaterial color="#555555" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.65, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.2, 0.3, 8]} />
              <meshStandardMaterial color="#777777" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        );
      case 'ac':
        return (
          <group>
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[obstacle.width, 0.8, obstacle.height]} />
              <meshStandardMaterial color="#E0E0E0" metalness={0.3} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.9, 0]} castShadow>
              <boxGeometry args={[obstacle.width * 0.8, 0.2, obstacle.height * 0.8]} />
              <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      case 'pipe':
        return (
          <group>
            <mesh position={[0, 1, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.15, 2, 8]} />
              <meshStandardMaterial color="#8B7355" metalness={0.2} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.15, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.25, 0.3, 8]} />
              <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        );
      default:
        return null;
    }
  };

  return (
    <group position={[obstacle.position.x, 0, obstacle.position.y]}>
      {renderObstacle()}
    </group>
  );
}
