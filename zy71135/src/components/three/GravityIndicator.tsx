import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { BAY_SCALE } from '../../types';
import { useStore } from '../../store/useStore';

export function GravityIndicator() {
  const centerOfGravity = useStore((state) => state.centerOfGravity);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (sphereRef.current) {
      sphereRef.current.position.y = centerOfGravity.y + BAY_SCALE * 1.5 + Math.sin(Date.now() * 0.002) * 0.1;
    }
  });

  const verticalLinePoints = useMemo(() => {
    return [
      new THREE.Vector3(centerOfGravity.x, 0, centerOfGravity.z),
      new THREE.Vector3(centerOfGravity.x, centerOfGravity.y + BAY_SCALE * 1.5, centerOfGravity.z),
    ];
  }, [centerOfGravity.x, centerOfGravity.y, centerOfGravity.z]);

  const color = centerOfGravity.isWarning ? '#D8315B' : '#2EC4B6';

  return (
    <group>
      <Line
        points={verticalLinePoints}
        color={color}
        lineWidth={2}
        transparent
        opacity={0.7}
        dashed={false}
      />

      <Sphere ref={sphereRef} args={[0.3, 16, 16]} position={[centerOfGravity.x, centerOfGravity.y + BAY_SCALE * 1.5, centerOfGravity.z]}>
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </Sphere>

      <mesh position={[centerOfGravity.x, 0.01, centerOfGravity.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.7, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[BAY_SCALE * 3, BAY_SCALE * 3.2, 64]} />
        <meshBasicMaterial color="#3E92CC" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
