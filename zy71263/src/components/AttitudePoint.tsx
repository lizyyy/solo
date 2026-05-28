import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Mesh } from 'three';

interface AttitudePointProps {
  position: { x: number; y: number; z: number };
  color: string;
  label: string;
  isCurrent: boolean;
}

export default function AttitudePoint({ position, color, label, isCurrent }: AttitudePointProps) {
  const meshRef = useRef<Mesh>(null);
  const radius = isCurrent ? 0.06 : 0.04;
  const glowIntensity = isCurrent ? 2 : 1;

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      const offset = isCurrent ? 0 : Math.PI;
      meshRef.current.position.y = position.y + Math.sin(t * 1.5 + offset) * 0.015;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[position.x, position.y, position.z]}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={glowIntensity}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[position.x, position.y + 0.15, position.z]}
        fontSize={0.08}
        color={color}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.005}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}
