import { BAY_SCALE } from '../../types';

export function ShipHull() {
  const shipLength = BAY_SCALE * 9;
  const shipWidth = BAY_SCALE * 5;
  const shipHeight = BAY_SCALE * 3;

  return (
    <group position={[0, -BAY_SCALE * 0.5, 0]}>
      <mesh position={[0, -shipHeight * 0.3, 0]}>
        <boxGeometry args={[shipLength, shipHeight * 0.4, shipWidth]} />
        <meshStandardMaterial
          color="#1a2744"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0, -shipHeight * 0.1, -shipWidth * 0.45]}>
        <boxGeometry args={[shipLength, shipHeight * 0.8, shipWidth * 0.1]} />
        <meshStandardMaterial
          color="#2a3f5f"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, -shipHeight * 0.1, shipWidth * 0.45]}>
        <boxGeometry args={[shipLength, shipHeight * 0.8, shipWidth * 0.1]} />
        <meshStandardMaterial
          color="#2a3f5f"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[-shipLength * 0.45, -shipHeight * 0.1, 0]}>
        <boxGeometry args={[shipLength * 0.1, shipHeight * 0.8, shipWidth]} />
        <meshStandardMaterial
          color="#2a3f5f"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[shipLength * 0.45, -shipHeight * 0.1, 0]}>
        <boxGeometry args={[shipLength * 0.1, shipHeight * 0.8, shipWidth]} />
        <meshStandardMaterial
          color="#2a3f5f"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[shipLength * 0.35, shipHeight * 0.5, 0]}>
        <boxGeometry args={[shipLength * 0.2, shipHeight * 0.6, shipWidth * 0.6]} />
        <meshStandardMaterial
          color="#1a2744"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[shipLength * 0.35, shipHeight * 0.9, 0]}>
        <boxGeometry args={[shipLength * 0.15, shipHeight * 0.2, shipWidth * 0.4]} />
        <meshStandardMaterial
          color="#2a3f5f"
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}
