import { useMemo } from 'react';
import * as THREE from 'three';

export default function Ground() {
  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(200, 50, '#334155', '#1e293b');
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      
      <primitive object={gridHelper} position={[0, 0.01, 0]} />
      
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[80, 64]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      <group position={[0, 0.1, 0]}>
        <mesh position={[0, 0, -90]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[2, 5, 4]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[90, 0, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
          <coneGeometry args={[2, 5, 4]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>
    </group>
  );
}
