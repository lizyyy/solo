import { useRef, useState } from 'react';
import * as THREE from 'three';
import type { Obstacle as ObstacleType } from '@/types';
import { SOURCE_COLORS } from '@/types';

interface ObstacleModelProps {
  obstacle: ObstacleType;
}

export function ObstacleModel({ obstacle }: ObstacleModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const sourceColor = SOURCE_COLORS[obstacle.source.type];
  const halfHeight = obstacle.size.y / 2;

  return (
    <group
      ref={groupRef}
      position={[obstacle.position.x, halfHeight, obstacle.position.z]}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = 'help';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh>
        <boxGeometry args={[obstacle.size.x, obstacle.size.y, obstacle.size.z]} />
        <meshBasicMaterial
          color={sourceColor}
          wireframe
          transparent
          opacity={hovered ? 0.8 : 0.4}
        />
      </mesh>

      <mesh>
        <boxGeometry args={[obstacle.size.x, obstacle.size.y, obstacle.size.z]} />
        <meshBasicMaterial
          color={sourceColor}
          transparent
          opacity={hovered ? 0.15 : 0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(obstacle.size.x, obstacle.size.y, obstacle.size.z)]} />
        <lineBasicMaterial
          color={sourceColor}
          transparent
          opacity={hovered ? 1 : 0.6}
        />
      </lineSegments>

      <mesh position={[0, obstacle.size.y / 2 + 1, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial
          color={sourceColor}
          transparent
          opacity={hovered ? 1 : 0.5}
        />
      </mesh>
    </group>
  );
}
