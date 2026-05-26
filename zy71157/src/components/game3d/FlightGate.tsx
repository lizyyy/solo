import { useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Flight } from '@/types/game';

interface FlightGateProps {
  gateId: string;
  position: [number, number, number];
  type: 'normal' | 'oversize' | 'storage';
  flight?: Flight;
}

export const FlightGate = ({ gateId, position, type, flight }: FlightGateProps) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ringRef.current && type === 'normal' && flight?.status === 'ontime') {
      ringRef.current.rotation.z += 0.02;
    }
  });

  const getGateColor = () => {
    if (type === 'oversize') return '#EF4444';
    if (type === 'storage') return '#F59E0B';
    if (flight?.status === 'cancelled') return '#6B7280';
    if (flight?.status === 'delayed') return '#F59E0B';
    return '#3B82F6';
  };

  const getStatusText = () => {
    if (type === 'oversize') return '超规';
    if (type === 'storage') return '转存';
    if (flight?.status === 'cancelled') return '取消';
    if (flight?.status === 'delayed') return '延误';
    return '正点';
  };

  const gateColor = getGateColor();

  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.1, 16]} />
        <meshStandardMaterial
          color={gateColor}
          emissive={gateColor}
          emissiveIntensity={0.2}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.05, 8, 32]} />
        <meshStandardMaterial
          color={gateColor}
          emissive={gateColor}
          emissiveIntensity={0.5}
        />
      </mesh>

      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[2, 1.2, 0.2]} />
        <meshStandardMaterial
          color="#1F2937"
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      <Text
        position={[0, 1.5, 0.11]}
        fontSize={0.35}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
      >
        {gateId}
      </Text>

      {flight && type === 'normal' && (
        <>
          <Text
            position={[0, 1.1, 0.11]}
            fontSize={0.18}
            color="#93C5FD"
            anchorX="center"
            anchorY="middle"
          >
            {flight.number}
          </Text>
          <Text
            position={[0, 0.85, 0.11]}
            fontSize={0.15}
            color="#D1D5DB"
            anchorX="center"
            anchorY="middle"
          >
            {flight.destination}
          </Text>
        </>
      )}

      <Text
        position={[0, 0.3, 0.1]}
        fontSize={0.15}
        color={gateColor}
        anchorX="center"
        anchorY="middle"
      >
        {getStatusText()}
      </Text>

      {flight?.status === 'ontime' && type === 'normal' && (
        <mesh position={[0.8, 1.5, 0.11]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial
            color="#10B981"
            emissive="#10B981"
            emissiveIntensity={1}
          />
        </mesh>
      )}

      {flight?.status === 'delayed' && (
        <mesh position={[0.8, 1.5, 0.11]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial
            color="#F59E0B"
            emissive="#F59E0B"
            emissiveIntensity={1}
          />
        </mesh>
      )}

      {flight?.status === 'cancelled' && (
        <mesh position={[0.8, 1.5, 0.11]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial
            color="#EF4444"
            emissive="#EF4444"
            emissiveIntensity={1}
          />
        </mesh>
      )}
    </group>
  );
};
