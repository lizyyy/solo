import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Truck } from '@/types';
import { useYardStore } from '@/store/useYardStore';
import * as THREE from 'three';

interface Truck3DProps {
  truck: Truck;
  isInConflict: boolean;
}

export function Truck3D({ truck, isInConflict }: Truck3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { selectedObjectId, setSelectedObject, currentTime } = useYardStore();
  const isSelected = selectedObjectId === truck.id;

  useFrame((state) => {
    if (groupRef.current && truck.currentRoute && truck.status === 'moving') {
      const route = truck.currentRoute;
      const totalDuration = route.endTime.getTime() - route.startTime.getTime();
      const elapsed = currentTime.getTime() - route.startTime.getTime();
      const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);

      const waypoints = route.waypoints;
      if (waypoints.length >= 2) {
        const segmentIndex = Math.min(Math.floor(progress * (waypoints.length - 1)), waypoints.length - 2);
        const segmentProgress = (progress * (waypoints.length - 1)) % 1;

        const start = waypoints[segmentIndex];
        const end = waypoints[segmentIndex + 1];

        groupRef.current.position.x = start.x + (end.x - start.x) * segmentProgress;
        groupRef.current.position.z = start.z + (end.z - start.z) * segmentProgress;

        const angle = Math.atan2(end.x - start.x, end.z - start.z);
        groupRef.current.rotation.y = angle;
      }
    }

    if (groupRef.current && (isInConflict || isSelected)) {
      groupRef.current.position.y = truck.position.y + Math.sin(state.clock.elapsedTime * 3) * 0.05;
    }
  });

  const getColor = () => {
    if (isInConflict) return '#FF6B35';
    if (isSelected) return '#FFD700';
    switch (truck.status) {
      case 'moving':
        return '#3498DB';
      case 'loading':
        return '#F39C12';
      case 'waiting':
        return '#95A5A6';
      default:
        return '#7F8C8D';
    }
  };

  return (
    <group
      ref={groupRef}
      position={[truck.position.x, truck.position.y, truck.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedObject(truck.id, 'truck');
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.2, 0.5, 2.5]} />
        <meshStandardMaterial color="#2C3E50" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh position={[0, 0.8, 0.8]} castShadow>
        <boxGeometry args={[1.1, 0.6, 1]} />
        <meshStandardMaterial color={getColor()} metalness={0.3} roughness={0.7} />
      </mesh>

      <mesh position={[0, 1.3, 1]} castShadow>
        <boxGeometry args={[0.9, 0.4, 0.5]} />
        <meshStandardMaterial color="#F5F5F5" metalness={0.3} roughness={0.7} />
      </mesh>

      <mesh position={[-0.45, 0.15, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[0.45, 0.15, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[-0.45, 0.15, -1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[0.45, 0.15, -1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>

      {(isInConflict || isSelected) && (
        <mesh position={[0, 2, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color={isInConflict ? '#FF0000' : '#FFD700'} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
