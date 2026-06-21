import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

export function TidalStationTower({ position = [0, 0, 0] as [number, number, number] }) {
  const rotorRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (rotorRef.current) {
      rotorRef.current.rotation.z = state.clock.elapsedTime * 0.6;
    }
  });

  const bladeGeo = useMemo(() => new THREE.BoxGeometry(0.18, 5.2, 0.5), []);

  return (
    <group position={position}>
      {/* Caisson base */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.7, 2.4, 24]} />
        <meshStandardMaterial color="#0e2a3a" metalness={0.7} roughness={0.3} emissive="#0c5e63" emissiveIntensity={0.25} />
      </mesh>
      {/* Tower */}
      <mesh position={[0, 4.2, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.9, 5.6, 20]} />
        <meshStandardMaterial color="#133447" metalness={0.8} roughness={0.25} emissive="#1f7a78" emissiveIntensity={0.3} />
      </mesh>
      {/* Nacelle */}
      <mesh position={[0, 7.2, 0]} castShadow>
        <boxGeometry args={[1.1, 1.1, 2.4]} />
        <meshStandardMaterial color="#38e1d6" metalness={0.6} roughness={0.3} emissive="#38e1d6" emissiveIntensity={0.45} />
      </mesh>
      {/* Rotor blades */}
      <group ref={rotorRef} position={[0, 7.2, 1.3]}>
        <mesh geometry={bladeGeo} position={[0, 2.6, 0]} castShadow>
          <meshStandardMaterial color="#e6f4f1" metalness={0.4} roughness={0.4} emissive="#38e1d6" emissiveIntensity={0.2} />
        </mesh>
        <mesh geometry={bladeGeo} position={[2.25, 1.3, 0]} rotation={[0, 0, -2.094]} castShadow>
          <meshStandardMaterial color="#e6f4f1" metalness={0.4} roughness={0.4} emissive="#38e1d6" emissiveIntensity={0.2} />
        </mesh>
        <mesh geometry={bladeGeo} position={[-2.25, 1.3, 0]} rotation={[0, 0, 2.094]} castShadow>
          <meshStandardMaterial color="#e6f4f1" metalness={0.4} roughness={0.4} emissive="#38e1d6" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshStandardMaterial color="#38e1d6" emissive="#38e1d6" emissiveIntensity={0.8} />
        </mesh>
      </group>
      {/* Beacons */}
      <pointLight position={[0, 8.4, 0]} color="#38e1d6" intensity={6} distance={20} />
      <mesh position={[0, 8.6, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#38e1d6" emissive="#38e1d6" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}
