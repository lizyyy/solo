import { Platform as PlatformType, LoadingDock } from '../../types';

interface PlatformProps {
  platform: PlatformType;
  loadingDocks: LoadingDock[];
}

export function Platform({ platform, loadingDocks }: PlatformProps) {
  if (platform.width === 0 || platform.depth === 0) return null;

  return (
    <group position={[platform.position.x, platform.position.y, platform.position.z]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[platform.width, platform.height, platform.depth]} />
        <meshStandardMaterial color="#4A5568" metalness={0.2} roughness={0.8} />
      </mesh>

      <mesh position={[0, platform.height / 2 + 0.05, 0]}>
        <boxGeometry args={[platform.width, 0.1, platform.depth]} />
        <meshStandardMaterial color="#718096" metalness={0.3} roughness={0.6} />
      </mesh>

      {loadingDocks.map((dock) => (
        <group key={dock.id} position={[dock.position.x - platform.position.x, 0, dock.position.z - platform.position.z]}>
          <mesh position={[0, dock.height / 2, 0]}>
            <boxGeometry args={[dock.width, dock.height, 0.3]} />
            <meshStandardMaterial color="#F6AD55" metalness={0.4} roughness={0.5} emissive="#F6AD55" emissiveIntensity={0.2} />
          </mesh>

          <mesh position={[0, dock.height / 2, 0.2]}>
            <boxGeometry args={[dock.width * 0.9, dock.height * 0.8, 0.1]} />
            <meshStandardMaterial color="#2D3748" metalness={0.3} roughness={0.7} />
          </mesh>

          <mesh position={[-dock.width / 2 + 0.5, 0.3, -platform.depth / 2 + 0.5]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
            <meshStandardMaterial color="#E53E3E" emissive="#E53E3E" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[dock.width / 2 - 0.5, 0.3, -platform.depth / 2 + 0.5]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
            <meshStandardMaterial color="#E53E3E" emissive="#E53E3E" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
