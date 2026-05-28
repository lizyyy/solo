import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Quaternion as ThreeQuaternion } from 'three';
import type { Quaternion } from '@/types';

interface SatelliteModelProps {
  quaternion: Quaternion;
}

export default function SatelliteModel({ quaternion }: SatelliteModelProps) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      const q = new ThreeQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
      groupRef.current.quaternion.copy(q);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[0.12, 0.08, 0.08]} />
        <meshStandardMaterial color="#8899aa" metalness={0.6} roughness={0.3} />
      </mesh>

      <mesh position={[-0.16, 0, 0]}>
        <boxGeometry args={[0.2, 0.005, 0.08]} />
        <meshStandardMaterial color="#2244aa" metalness={0.4} roughness={0.5} />
      </mesh>

      <mesh position={[0.16, 0, 0]}>
        <boxGeometry args={[0.2, 0.005, 0.08]} />
        <meshStandardMaterial color="#2244aa" metalness={0.4} roughness={0.5} />
      </mesh>

      <mesh position={[0, 0.06, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.04, 8]} />
        <meshStandardMaterial color="#cccccc" metalness={0.7} roughness={0.2} />
      </mesh>
    </group>
  );
}
