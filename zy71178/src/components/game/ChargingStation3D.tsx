import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ChargingStation } from '../../types/game';

interface ChargingStation3DProps {
  station: ChargingStation;
  cellSize?: number;
  gridWidth: number;
  gridHeight: number;
}

export function ChargingStation3D({ station, cellSize = 1, gridWidth, gridHeight }: ChargingStation3DProps) {
  const glowRef = useRef<THREE.Mesh>(null);

  const offsetX = -gridWidth * cellSize / 2;
  const offsetZ = -gridHeight * cellSize / 2;

  const x = station.position.x * cellSize + cellSize / 2 + offsetX;
  const z = station.position.y * cellSize + cellSize / 2 + offsetZ;

  useFrame((state) => {
    if (glowRef.current) {
      const intensity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[cellSize * 0.4, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.2} />
      </mesh>

      <mesh ref={glowRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cellSize * 0.3, cellSize * 0.4, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[cellSize * 0.35, cellSize * 0.4, 0.05, 32]} />
        <meshStandardMaterial color="#1a3a4a" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.3, 0]}>
        <torusGeometry args={[cellSize * 0.15, 0.03, 8, 32]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
