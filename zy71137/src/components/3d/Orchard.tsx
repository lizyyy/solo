import { useMemo } from 'react';
import { Orchard as OrchardType } from '@/types';
import { COLORS } from '@/data/constants';
import * as THREE from 'three';

interface OrchardProps {
  data: OrchardType;
}

export function Orchard({ data }: OrchardProps) {
  const { position, size, treeRows, treesPerRow } = data;
  const [width, depth] = size;

  const treePositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    const startX = position[0] - width / 2 + 2;
    const startZ = position[2] - depth / 2 + 2;
    const spacingX = (width - 4) / (treesPerRow - 1 || 1);
    const spacingZ = (depth - 4) / (treeRows - 1 || 1);

    for (let row = 0; row < treeRows; row++) {
      for (let col = 0; col < treesPerRow; col++) {
        positions.push([
          startX + col * spacingX,
          position[1],
          startZ + row * spacingZ,
        ]);
      }
    }
    return positions;
  }, [position, size, treeRows, treesPerRow]);

  const gridGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(width, depth, 10, 10);
  }, [width, depth]);

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={COLORS.orchard} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <primitive object={gridGeometry} attach="geometry" />
        <meshBasicMaterial
          color={COLORS.orchardGrid}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {treePositions.map((pos, i) => (
        <group key={i} position={[pos[0] - position[0], 0, pos[2] - position[2]]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.15, 1, 8]} />
            <meshStandardMaterial color={COLORS.treeTrunk} />
          </mesh>
          <mesh position={[0, 1.8, 0]} castShadow>
            <coneGeometry args={[0.8, 2, 8]} />
            <meshStandardMaterial color={COLORS.tree} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[width + 0.2, 0.2, depth + 0.2]} />
        <meshBasicMaterial
          color={COLORS.orchardGrid}
          wireframe
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}