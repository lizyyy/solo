import type { Wall } from '@/types';

interface GalleryWallsProps {
  walls: Wall[];
}

export default function GalleryWalls({ walls }: GalleryWallsProps) {
  const renderWall = (wall: Wall) => {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);

    const centerX = (wall.start.x + wall.end.x) / 2;
    const centerY = wall.height / 2;
    const centerZ = (wall.start.z + wall.end.z) / 2;

    return (
      <mesh
        key={wall.id}
        position={[centerX, centerY, centerZ]}
        rotation={[0, -angle, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, wall.height, wall.thickness]} />
        <meshStandardMaterial
          color="#2a2d33"
          roughness={0.85}
          metalness={0.05}
          transparent={wall.opacity < 1}
          opacity={wall.opacity}
        />
      </mesh>
    );
  };

  return <group>{walls.map(renderWall)}</group>;
}
