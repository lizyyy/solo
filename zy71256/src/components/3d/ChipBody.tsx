import { useMemo } from 'react';
import { Edges, Text } from '@react-three/drei';
import * as THREE from 'three';

export default function ChipBody() {
  const args = useMemo<[number, number, number]>(() => [4, 4, 0.3], []);

  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <boxGeometry args={args} />
        <meshStandardMaterial
          color="#1a1f2e"
          transparent
          opacity={0.7}
          metalness={0.3}
          roughness={0.7}
        />
        <Edges
          threshold={15}
          color={new THREE.Color('#00ffd5')}
          lineWidth={1}
          opacity={0.3}
          transparent
        />
      </mesh>
      <Text
        position={[0, 0, 0.16]}
        fontSize={0.25}
        color="#00ffd5"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        MCU-QFP64-REV3
      </Text>
    </group>
  );
}
