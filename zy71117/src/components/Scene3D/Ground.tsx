import { Boundaries } from '../../types';

interface GroundProps {
  width: number;
  depth: number;
  boundaries: Boundaries;
}

export function Ground({ width, depth, boundaries }: GroundProps) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1A202C" metalness={0.1} roughness={0.9} />
      </mesh>

      <gridHelper args={[Math.max(width, depth), 50, '#2D3748', '#1E293B']} position={[0, 0.01, 0]} />

      <group>
        <mesh position={[boundaries.minX, 0.02, (boundaries.minZ + boundaries.maxZ) / 2]}>
          <boxGeometry args={[0.1, 0.04, boundaries.maxZ - boundaries.minZ]} />
          <meshStandardMaterial color="#F53F3F" emissive="#F53F3F" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[boundaries.maxX, 0.02, (boundaries.minZ + boundaries.maxZ) / 2]}>
          <boxGeometry args={[0.1, 0.04, boundaries.maxZ - boundaries.minZ]} />
          <meshStandardMaterial color="#F53F3F" emissive="#F53F3F" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[(boundaries.minX + boundaries.maxX) / 2, 0.02, boundaries.minZ]}>
          <boxGeometry args={[boundaries.maxX - boundaries.minX, 0.04, 0.1]} />
          <meshStandardMaterial color="#F53F3F" emissive="#F53F3F" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[(boundaries.minX + boundaries.maxX) / 2, 0.02, boundaries.maxZ]}>
          <boxGeometry args={[boundaries.maxX - boundaries.minX, 0.04, 0.1]} />
          <meshStandardMaterial color="#F53F3F" emissive="#F53F3F" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {Array.from({ length: Math.floor(width / 5) }).map((_, i) => (
        <group key={`arrow-${i}`} position={[-width / 2 + i * 5 + 2.5, 0.02, 8]}>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <coneGeometry args={[0.3, 0.8, 8]} />
            <meshStandardMaterial color="#48BB78" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
