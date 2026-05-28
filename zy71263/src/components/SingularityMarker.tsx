import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Group } from 'three';

interface SingularityMarkerProps {
  position: { x: number; y: number; z: number };
  visible: boolean;
}

export default function SingularityMarker({ position, visible }: SingularityMarkerProps) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (groupRef.current && visible) {
      const t = state.clock.elapsedTime;
      const scale = 1 + Math.sin(t * 3) * 0.3;
      groupRef.current.scale.set(scale, scale, scale);
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.01, 8, 32]} />
        <meshStandardMaterial
          color="red"
          emissive="red"
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 0.14, 0]}
        fontSize={0.06}
        color="red"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.004}
        outlineColor="#000000"
      >
        ⚠ GIMBAL LOCK
      </Text>
    </group>
  );
}
