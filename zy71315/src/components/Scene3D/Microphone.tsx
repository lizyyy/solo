import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MicrophoneProps {
  position: [number, number, number];
  isActive?: boolean;
}

export function Microphone({ position, isActive = true }: MicrophoneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (isActive && glowRef.current) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.1;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const micBodyMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.3,
    });
  }, []);

  const micGridMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.9,
      roughness: 0.2,
    });
  }, []);

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0, 0]} material={micBodyMaterial} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.15, 16]} />
      </mesh>

      <mesh position={[0, 0.12, 0]} material={micGridMaterial} castShadow>
        <sphereGeometry args={[0.06, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      <mesh position={[0, -0.12, 0]} material={micBodyMaterial} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.08, 8]} />
      </mesh>

      {isActive && (
        <mesh ref={glowRef} position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={0x00f5d4} transparent opacity={0.3} />
        </mesh>
      )}

      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.085, 32]} />
        <meshBasicMaterial color={0x00f5d4} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
