import { useMemo } from 'react';
import * as THREE from 'three';

interface GroundGridProps {
  visible: boolean;
  size?: number;
  divisions?: number;
}

export function GroundGrid({ visible, size = 10, divisions = 20 }: GroundGridProps) {
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(size, divisions, 0x2A3547, 0x1E2736);
    grid.position.y = -0.01;
    return grid;
  }, [size, divisions]);
  
  const axisHelper = useMemo(() => {
    const axis = new THREE.AxesHelper(2);
    axis.position.y = 0.001;
    return axis;
  }, []);
  
  if (!visible) return null;
  
  return (
    <group>
      <primitive object={gridHelper} />
      <primitive object={axisHelper} />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial 
          color="#0B0F17" 
          transparent 
          opacity={0.9}
          roughness={0.8}
        />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0001, 0]}>
        <ringGeometry args={[0.9, 1.1, 64]} />
        <meshBasicMaterial color="#00AAFF" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0002, 0]}>
        <ringGeometry args={[1.4, 1.6, 64]} />
        <meshBasicMaterial color="#00FF88" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      
      <group position={[0, 0.001, -1]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.08, 1.5]} />
          <meshBasicMaterial color="#FF8800" transparent opacity={0.5} />
        </mesh>
      </group>
      
      <group position={[-1, 0.001, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[0.08, 1.5]} />
          <meshBasicMaterial color="#FF3366" transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  );
}
