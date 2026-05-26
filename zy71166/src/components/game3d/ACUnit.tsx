import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Group } from 'three';
import type { ACUnit as ACUnitType } from '../../engine/types';
import { useUISTore } from '../../store/useUISTore';

interface ACUnitProps {
  ac: ACUnitType;
  isSelected: boolean;
  onClick: () => void;
}

export function ACUnit({ ac, isSelected, onClick }: ACUnitProps) {
  const groupRef = useRef<Group>(null);
  const fanRef = useRef<Mesh>(null);
  const { cameraView } = useUISTore();

  const height = 2.2;
  const width = 1.5;
  const depth = 0.8;

  const statusColor = useMemo(() => {
    if (!ac.isOn || ac.status === 'fault' || ac.status === 'off') return '#64748b';
    if (ac.status === 'overload') return '#f97316';
    return '#22d3ee';
  }, [ac.isOn, ac.status]);

  useFrame((state, delta) => {
    if (fanRef.current && ac.isOn && ac.status !== 'fault') {
      fanRef.current.rotation.z += delta * (ac.status === 'overload' ? 8 : 5);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[ac.position.x, height / 2, ac.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color="#334155"
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 0, -depth / 2 - 0.01]}>
        <boxGeometry args={[width * 0.9, height * 0.85, 0.02]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={ac.isOn ? 0.4 : 0.1}
          transparent
          opacity={0.8}
        />
      </mesh>

      <mesh position={[0, 0.3, -depth / 2 - 0.02]} ref={fanRef}>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 5]} />
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, 0.3, -depth / 2 - 0.01]}>
        <ringGeometry args={[0.32, 0.38, 16]} />
        <meshBasicMaterial
          color={statusColor}
          transparent
          opacity={ac.isOn ? 0.6 : 0.3}
          side={2}
        />
      </mesh>

      <mesh position={[0, -height / 2 + 0.2, -depth / 2 - 0.02]}>
        <boxGeometry args={[width * 0.7, 0.1, 0.02]} />
        <meshStandardMaterial
          color={ac.isOn ? '#22d3ee' : '#475569'}
          emissive={ac.isOn ? '#22d3ee' : '#000'}
          emissiveIntensity={ac.isOn ? 0.5 : 0}
        />
      </mesh>

      <mesh position={[0, height / 2 + 0.05, 0]}>
        <boxGeometry args={[0.8, 0.1, 0.5]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, height / 2 + 0.12, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.4]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={ac.isOn ? 0.3 : 0}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1, 1.2, 32]} />
          <meshBasicMaterial
            color="#0ea5e9"
            transparent
            opacity={0.6}
            side={2}
          />
        </mesh>
      )}
    </group>
  );
}
