import { useRef } from 'react';
import { Mesh, MeshStandardMaterial } from 'three';

export const AirportEnvironment = () => {
  const floorRef = useRef<Mesh>(null);

  return (
    <group>
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1F2937" roughness={0.8} />
      </mesh>

      <gridHelper args={[30, 30, '#374151', '#1F2937']} position={[0, 0.01, 0]} />

      {Array.from({ length: 30 }).map((_, i) => (
        <mesh key={`line-x-${i}`} position={[i - 15, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.02, 30]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.3} />
        </mesh>
      ))}

      {Array.from({ length: 30 }).map((_, i) => (
        <mesh key={`line-z-${i}`} position={[0, 0.02, i - 15]} rotation={[-Math.PI / 2, Math.PI / 2, 0]}>
          <planeGeometry args={[0.02, 30]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.2} />
        </mesh>
      ))}

      <mesh position={[0, 2, -15]}>
        <boxGeometry args={[30, 4, 0.5]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh position={[0, 2.5, -14.7]}>
        <boxGeometry args={[28, 3, 0.1]} />
        <meshStandardMaterial color="#1E3A8A" emissive="#1E3A8A" emissiveIntensity={0.2} />
      </mesh>

      {[[-12, 3], [-6, 3], [0, 3], [6, 3], [12, 3]].map(([x, y], i) => (
        <group key={`light-${i}`} position={[x, y, -14]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 8]} />
            <meshStandardMaterial color="#FCD34D" emissive="#FCD34D" emissiveIntensity={1} />
          </mesh>
          <pointLight color="#FFFBEB" intensity={0.5} distance={8} />
        </group>
      ))}

      {[[-14, -14], [14, -14], [-14, 14], [14, 14]].map(([x, z], i) => (
        <mesh key={`pillar-${i}`} position={[x, 2, z]}>
          <cylinderGeometry args={[0.5, 0.6, 4, 8]} />
          <meshStandardMaterial color="#374151" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
};
