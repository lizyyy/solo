import { useMemo } from 'react';
import * as THREE from 'three';

export function Ground() {
  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(100, 50, 0x3a4a5a, 0x2a3a4a);
  }, []);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={0x0a1628} />
      </mesh>
      <primitive object={gridHelper} position={[0, 0.01, 0]} />
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[100, 1, 100]} />
        <meshStandardMaterial color={0x0a0f1a} />
      </mesh>
    </>
  );
}
