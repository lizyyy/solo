import { useRef } from 'react';
import * as THREE from 'three';
import { useAppStore } from '@/store/appStore';
import { Obstacle } from '@/types';

interface ObstacleMeshProps {
  obstacle: Obstacle;
}

function PillarMesh({ obstacle }: ObstacleMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={meshRef}
      position={[obstacle.position.x, obstacle.position.y, obstacle.position.z]}
      castShadow
      receiveShadow
      userData={{ obstacleId: obstacle.id, type: 'obstacle' }}
    >
      <boxGeometry args={[obstacle.size.width, obstacle.size.height, obstacle.size.depth]} />
      <meshStandardMaterial color="#6b7280" metalness={0.3} roughness={0.7} />
    </mesh>
  );
}

function ProjectorMesh({ obstacle }: ObstacleMeshProps) {
  const meshRef = useRef<THREE.Group>(null);

  return (
    <group
      ref={meshRef}
      position={[obstacle.position.x, obstacle.position.y, obstacle.position.z]}
      userData={{ obstacleId: obstacle.id, type: 'obstacle' }}
    >
      <mesh castShadow>
        <boxGeometry args={[obstacle.size.width, obstacle.size.height, obstacle.size.depth]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.1, obstacle.size.depth / 2]} rotation={[-Math.PI / 6, 0, 0]}>
        <coneGeometry args={[0.3, 0.5, 4, 1, true]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ScreenMesh({ obstacle }: ObstacleMeshProps) {
  const meshRef = useRef<THREE.Group>(null);

  return (
    <group
      ref={meshRef}
      position={[obstacle.position.x, obstacle.position.y, obstacle.position.z]}
      userData={{ obstacleId: obstacle.id, type: 'obstacle' }}
    >
      <mesh castShadow>
        <boxGeometry args={[obstacle.size.width + 0.2, obstacle.size.height + 0.2, obstacle.size.depth]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 0, obstacle.size.depth / 2 + 0.01]}>
        <planeGeometry args={[obstacle.size.width, obstacle.size.height]} />
        <meshStandardMaterial color="#f3f4f6" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Obstacles() {
  const obstacles = useAppStore((state) => state.obstacles);

  return (
    <group>
      {obstacles.map((obstacle) => {
        switch (obstacle.type) {
          case 'pillar':
            return <PillarMesh key={obstacle.id} obstacle={obstacle} />;
          case 'projector':
            return <ProjectorMesh key={obstacle.id} obstacle={obstacle} />;
          case 'screen':
            return <ScreenMesh key={obstacle.id} obstacle={obstacle} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
