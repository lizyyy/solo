import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Robot } from '../types';
import { statusToColor } from '../utils/colors';
import { useViewStore } from '../store/viewStore';

interface RobotModelProps {
  robot: Robot;
}

export default function RobotModel({ robot }: RobotModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ledRef = useRef<THREE.Mesh>(null);
  const { selectedElementId, setSelectedElement } = useViewStore();

  const isSelected = selectedElementId === robot.id;
  const ledColor = useMemo(() => {
    const rgb = statusToColor(robot.status);
    return new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
  }, [robot.status]);

  const position = useMemo(() => {
    if (!robot.currentPosition) return [20, 0.3, 20] as [number, number, number];
    const z = (robot.currentFloor ?? 1) > 0 ? (robot.currentFloor! - 1) * 4 : 0;
    return [robot.currentPosition.x, z + 0.3, robot.currentPosition.y] as [number, number, number];
  }, [robot.currentPosition, robot.currentFloor]);

  useFrame(() => {
    if (!ledRef.current) return;
    const mat = ledRef.current.material as THREE.MeshBasicMaterial;
    const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
    mat.opacity = pulse;

    if (!groupRef.current) return;
    const targetScale = isSelected ? 1.15 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
  });

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation();
    setSelectedElement(robot.id, 'robot');
  };

  const batteryColor = useMemo(() => {
    if (robot.batteryLevel > 50) return '#10B981';
    if (robot.batteryLevel > 20) return '#F59E0B';
    return '#EF4444';
  }, [robot.batteryLevel]);

  return (
    <group ref={groupRef} position={position} onClick={handleClick}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.4, 0.6]} />
        <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 8]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh ref={ledRef} position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={ledColor} transparent opacity={1} />
      </mesh>

      <mesh position={[0, 0.21, 0.31]}>
        <boxGeometry args={[0.5, 0.02, 0.01]} />
        <meshBasicMaterial color={batteryColor} />
      </mesh>

      <mesh position={[0, 0.21, 0.305]}>
        <boxGeometry args={[0.5 * (robot.batteryLevel / 100), 0.02, 0.01]} />
        <meshBasicMaterial color={batteryColor} transparent opacity={0.8} />
      </mesh>

      {isSelected && (
        <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.7, 32]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
