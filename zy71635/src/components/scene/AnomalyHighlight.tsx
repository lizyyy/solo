import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AnomalyHighlightProps {
  targetPosition: [number, number, number];
  active: boolean;
}

export function AnomalyHighlight({ targetPosition, active }: AnomalyHighlightProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (active) {
      const scale = 1 + 0.3 * Math.sin(state.clock.elapsedTime * 2);
      if (ringRef.current) {
        ringRef.current.scale.setScalar(scale);
      }
      if (sphereRef.current) {
        sphereRef.current.scale.setScalar(scale);
      }
    }
  });

  if (!active) return null;

  return (
    <group position={targetPosition}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.05, 16, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.7} />
      </mesh>
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
