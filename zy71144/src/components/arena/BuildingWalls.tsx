import { useMemo } from 'react';
import type { Wall } from '../../types';

interface BuildingWallsProps {
  walls: Wall[];
  visible?: boolean;
}

export function BuildingWalls({ walls, visible = true }: BuildingWallsProps) {
  const wallData = useMemo(() => {
    return walls.map((wall) => {
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.z - wall.start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const centerX = (wall.start.x + wall.end.x) / 2;
      const centerZ = (wall.start.z + wall.end.z) / 2;
      const rotationY = Math.atan2(dz, dx);
      return {
        ...wall,
        length,
        centerX,
        centerZ,
        rotationY,
      };
    });
  }, [walls]);

  if (!visible) return null;

  return (
    <group>
      {wallData.map((wall) => (
        <mesh
          key={wall.id}
          position={[wall.centerX, wall.height / 2, wall.centerZ]}
          rotation={[0, -wall.rotationY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wall.length, wall.height, 0.3]} />
          <meshStandardMaterial
            color="#4a5568"
            transparent
            opacity={0.85}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}
