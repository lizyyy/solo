import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimulationStore } from '../../store/useSimulationStore';
import { toRadians } from '../../physics/solarSailPhysics';
import * as THREE from 'three';

interface SpacecraftProps {
  onClick?: () => void;
}

export default function Spacecraft({ onClick }: SpacecraftProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sailRef = useRef<THREE.Mesh>(null);
  
  const { attitude, spacecraftPosition, radiationPressure } = useSimulationStore();

  useFrame(() => {
    if (sailRef.current) {
      const radAtt = toRadians(attitude);
      sailRef.current.rotation.set(radAtt.alpha, radAtt.beta, radAtt.gamma);
    }
    
    if (groupRef.current) {
      groupRef.current.position.copy(spacecraftPosition);
    }
  });

  return (
    <group ref={groupRef} onClick={onClick}>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#4a90d9" metalness={0.8} roughness={0.2} />
      </mesh>
      
      <mesh position={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.8, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      
      <group position={[0, 0, 0]}>
        <mesh ref={sailRef} position={[-0.5, 0, 0]}>
          <planeGeometry args={[3, 3, 1, 1]} />
          <meshStandardMaterial
            color={radiationPressure.isReversed ? '#ff4444' : '#00d4ff'}
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
        
        <mesh position={[-2, 0, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 3.2, 8]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
        <mesh position={[-0.5, 1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 3.2, 8]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      </group>
      
      <mesh position={[0, 0, 0]}>
        <arrowHelper args={[new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 0), 2, 0x00ff88, 0.3, 0.15]} />
      </mesh>
    </group>
  );
}
