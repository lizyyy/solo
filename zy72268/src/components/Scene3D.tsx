import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Obstacle } from '../types';
import { Tag, AlertTriangle } from 'lucide-react';

interface ObstacleMeshProps {
  obstacle: Obstacle;
  isSelected: boolean;
  onClick: () => void;
}

const ObstacleMesh: React.FC<ObstacleMeshProps> = ({ obstacle, isSelected, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && obstacle.isConflicted) {
      const glow = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
    }
  });

  const color = useMemo(() => {
    if (obstacle.status === 'merged') return '#374151';
    if (obstacle.isConflicted) return '#EF4444';
    if (obstacle.source === 'sketch') return '#3B82F6';
    if (obstacle.source === 'point-cloud') return '#F97316';
    return '#6B7280';
  }, [obstacle]);

  const position: [number, number, number] = [
    obstacle.position.x,
    obstacle.position.y,
    obstacle.position.z,
  ];

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry
          args={[
            obstacle.dimensions.width,
            obstacle.dimensions.height,
            obstacle.dimensions.depth,
          ]}
        />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={obstacle.status === 'merged' ? 0.3 : 0.8}
          emissive={isSelected ? '#60A5FA' : obstacle.isConflicted ? '#EF4444' : '#000000'}
          emissiveIntensity={isSelected ? 0.5 : 0}
        />
      </mesh>

      {obstacle.isConflicted && (
        <mesh ref={glowRef}>
          <boxGeometry
            args={[
              obstacle.dimensions.width * 1.1,
              obstacle.dimensions.height * 1.1,
              obstacle.dimensions.depth * 1.1,
            ]}
          />
          <meshStandardMaterial
            color="#EF4444"
            transparent
            opacity={0.1}
            emissive="#EF4444"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      <Html
        position={[0, obstacle.dimensions.height / 2 + 0.5, 0]}
        center
        distanceFactor={10}
        zIndexRange={[100, 0]}
      >
        <div
          className={`
            px-2 py-1 rounded text-xs font-medium whitespace-nowrap
            ${obstacle.isConflicted
              ? 'bg-red-500 text-white'
              : isSelected
              ? 'bg-blue-500 text-white'
              : 'bg-zinc-800/90 text-zinc-200 border border-zinc-700'
            }
          `}
        >
          <div className="flex items-center gap-1">
            {obstacle.isConflicted && <AlertTriangle size={12} />}
            <Tag size={12} />
            <span>{obstacle.currentName}</span>
          </div>
          {obstacle.nameHistory.length > 1 && (
            <div className="text-[10px] opacity-70 mt-0.5">
              曾用名: {obstacle.nameHistory.length - 1} 个
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};

interface FloorGridProps {
  size?: number;
}

const FloorGrid: React.FC<FloorGridProps> = ({ size = 50 }) => {
  return (
    <gridHelper
      args={[size, size, '#1F2937', '#111827']}
      position={[0, -0.01, 0]}
    />
  );
};

interface Scene3DProps {
  obstacles: Obstacle[];
  selectedObstacleId: string | null;
  onSelectObstacle: (id: string | null) => void;
}

export const Scene3D: React.FC<Scene3DProps> = ({
  obstacles,
  selectedObstacleId,
  onSelectObstacle,
}) => {
  const activeObstacles = obstacles.filter(o => o.status !== 'merged');

  return (
    <Canvas
      camera={{ position: [20, 20, 20], fov: 50 }}
      onClick={() => onSelectObstacle(null)}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0A0A0A' }}
    >
      <color attach="background" args={['#0A0A0A']} />
      <fog attach="fog" args={['#0A0A0A', 30, 80]} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />

      <FloorGrid size={60} />

      {activeObstacles.map((obstacle) => (
        <ObstacleMesh
          key={obstacle.id}
          obstacle={obstacle}
          isSelected={selectedObstacleId === obstacle.id}
          onClick={() => onSelectObstacle(obstacle.id)}
        />
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
};
