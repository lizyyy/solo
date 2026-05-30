import { useBridgeStore } from '@/store/useBridgeStore';
import { useMemo } from 'react';
import * as THREE from 'three';

export function LoadIndicator() {
  const load = useBridgeStore(state => state.load);
  const model = useBridgeStore(state => state.model);
  
  const position = useMemo(() => {
    if (!model) return [0, 10.5, 0];
    const x = (load.position / 100) * (model.length / 2) * 2 - model.length / 2;
    const z = (load.lane - 0.5) * 4;
    return [x, 10.5, z];
  }, [load.position, load.lane, model]);
  
  const height = useMemo(() => {
    return 2 + (load.magnitude / 100) * 5;
  }, [load.magnitude]);

  if (!load.isVisible || !model) return null;

  return (
    <group position={position as [number, number, number]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[1.5, height, 1.5]} />
        <meshStandardMaterial 
          color="#ef4444" 
          transparent 
          opacity={0.7}
          emissive="#ef4444"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      <mesh position={[0, height + 0.5, 0]}>
        <coneGeometry args={[1, 1.5, 8]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      
      <group position={[0, height + 2.5, 0]}>
        <mesh>
          <cylinderGeometry args={[0.4, 0.6, 0.8, 12]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[2, 0.8, 1.2]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <mesh position={[-0.7, -0.2, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0.7, -0.2, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[-0.7, -0.2, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0.7, -0.2, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.3, 12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      </group>
      
      <arrowHelper
        args={[new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), height + 2, 0xef4444, 0.5, 0.3]}
      />
    </group>
  );
}
