import * as THREE from 'three';

export default function Stage() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[12, 0.6, 8]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </mesh>

      <mesh position={[0, 1.5, -4.2]}>
        <boxGeometry args={[12.2, 3, 0.3]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.7} />
      </mesh>

      <mesh position={[-6.2, 1.5, 0]}>
        <boxGeometry args={[0.3, 3, 8.4]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.7} />
      </mesh>

      <mesh position={[6.2, 1.5, 0]}>
        <boxGeometry args={[0.3, 3, 8.4]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.7} />
      </mesh>

      <group position={[-5, 4.5, -3.5]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
          <meshStandardMaterial color="#4a4a4e" />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#6a6a6e" emissive="#3a3a3e" />
        </mesh>
      </group>

      <group position={[5, 4.5, -3.5]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
          <meshStandardMaterial color="#4a4a4e" />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#6a6a6e" emissive="#3a3a3e" />
        </mesh>
      </group>

      <group position={[0, 4.5, -5]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
          <meshStandardMaterial color="#4a4a4e" />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#6a6a6e" emissive="#3a3a3e" />
        </mesh>
      </group>

      <mesh position={[0, 4.75, 1.65]}>
        <boxGeometry args={[6.2, 1.6, 0.1]} />
        <meshStandardMaterial
          color="#0a0a0f"
          emissive="#001133"
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0, 4.75, 1.5]}>
        <boxGeometry args={[6, 1.5, 0.05]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}
