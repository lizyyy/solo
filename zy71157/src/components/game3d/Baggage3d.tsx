import { useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Baggage } from '@/types/game';
import { useGameStore } from '@/store/useGameStore';

interface Baggage3dProps {
  baggage: Baggage;
}

export const Baggage3d = ({ baggage }: Baggage3dProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const selectBaggage = useGameStore(state => state.selectBaggage);
  const selectedBaggageId = useGameStore(state => state.selectedBaggageId);

  const isSelected = selectedBaggageId === baggage.id;
  const isMoving = baggage.status === 'moving' || baggage.status === 'waiting';
  const isError = baggage.status === 'error';
  const isDelivered = baggage.status === 'delivered';

  const scale = baggage.isOversize ? 1.3 : 1;
  const height = baggage.isOversize ? 0.7 : 0.5;
  const width = baggage.isOversize ? 0.7 : 0.5;
  const depth = baggage.isOversize ? 0.9 : 0.7;

  useFrame((_, delta) => {
    if (groupRef.current && isMoving) {
      groupRef.current.rotation.y += delta * 0.5;
      groupRef.current.position.y = 0.35 + Math.sin(Date.now() * 0.003) * 0.02;
    }
    if (groupRef.current && isError) {
      groupRef.current.position.y = 0.35 + Math.sin(Date.now() * 0.01) * 0.1;
    }
  });

  const getColor = () => {
    if (isError) return '#EF4444';
    if (isDelivered) return '#10B981';
    if (hovered || isSelected) return '#60A5FA';
    return baggage.color;
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    selectBaggage(isSelected ? undefined : baggage.id);
  };

  if (isDelivered) return null;

  return (
    <group
      ref={groupRef}
      position={[baggage.position.x, 0.35, baggage.position.z]}
      scale={[scale, scale, scale]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={getColor()}
          metalness={0.1}
          roughness={0.7}
          emissive={isSelected || hovered ? getColor() : '#000000'}
          emissiveIntensity={isSelected || hovered ? 0.3 : 0}
        />
      </mesh>

      <mesh position={[0, height / 2 + 0.05, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        <meshStandardMaterial color="#1F2937" />
      </mesh>

      <mesh position={[0, height / 2 + 0.08, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 8]} />
        <meshStandardMaterial color="#6B7280" />
      </mesh>

      <mesh position={[width / 2 - 0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshBasicMaterial color="#FEF3C7" />
      </mesh>

      {baggage.type === 'transfer' && (
        <mesh position={[0, height / 2 + 0.15, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#F97316" emissive="#F97316" emissiveIntensity={0.5} />
        </mesh>
      )}

      {baggage.isOversize && (
        <mesh position={[0, height / 2 + 0.15, 0]}>
          <octahedronGeometry args={[0.15, 0]} />
          <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.5} />
        </mesh>
      )}

      {isSelected && (
        <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 16]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.6} side={2} />
        </mesh>
      )}
    </group>
  );
};
