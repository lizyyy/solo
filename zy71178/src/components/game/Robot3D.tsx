import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Robot } from '../../types/game';

interface Robot3DProps {
  robot: Robot;
  isSelected: boolean;
  cellSize?: number;
  gridWidth: number;
  gridHeight: number;
}

export function Robot3D({ robot, isSelected, cellSize = 1, gridWidth, gridHeight }: Robot3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    const offsetX = -gridWidth * cellSize / 2;
    const offsetZ = -gridHeight * cellSize / 2;

    let targetX = robot.position.x * cellSize + cellSize / 2 + offsetX;
    let targetZ = robot.position.y * cellSize + cellSize / 2 + offsetZ;

    if (robot.status === 'moving' && robot.path.length > 0 && robot.pathIndex < robot.path.length) {
      const nextPos = robot.path[robot.pathIndex];
      const prevPos = robot.pathIndex > 0 ? robot.path[robot.pathIndex - 1] : robot.position;
      
      const progress = robot.moveProgress;
      targetX = (prevPos.x + (nextPos.x - prevPos.x) * progress) * cellSize + cellSize / 2 + offsetX;
      targetZ = (prevPos.y + (nextPos.y - prevPos.y) * progress) * cellSize + cellSize / 2 + offsetZ;
    }

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.2);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.2);

    if (glowRef.current && isSelected) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      glowRef.current.scale.setScalar(scale);
    }
  });

  const isDead = robot.status === 'dead';
  const isCharging = robot.status === 'charging';

  return (
    <group ref={groupRef} position={[0, cellSize * 0.3, 0]}>
      {isSelected && (
        <mesh ref={glowRef} position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.6, 32]} />
          <meshBasicMaterial color={robot.color} transparent opacity={0.3} />
        </mesh>
      )}

      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.7, 0.3, 0.7]} />
        <meshStandardMaterial color={isDead ? '#666666' : robot.color} metalness={0.5} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.2, 16]} />
        <meshStandardMaterial color={isDead ? '#555555' : '#333333'} metalness={0.8} roughness={0.2} />
      </mesh>

      {isCharging && (
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.8} />
        </mesh>
      )}

      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial 
          color={isDead ? '#ff0000' : isCharging ? '#00ffff' : '#00ff00'} 
          emissive={isDead ? '#ff0000' : isCharging ? '#00ffff' : '#00ff00'}
          emissiveIntensity={0.5}
        />
      </mesh>

      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  );
}
