import { useRef } from 'react';
import { Mesh, GridHelper } from 'three';
import { useFrame } from '@react-three/fiber';

interface RoomEnvironmentProps {
  dimensions: { width: number; depth: number; height: number };
}

export function RoomEnvironment({ dimensions }: RoomEnvironmentProps) {
  const floorRef = useRef<Mesh>(null);
  const gridRef = useRef<GridHelper>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (gridRef.current) {
      gridRef.current.material.opacity = 0.15 + Math.sin(time * 0.5) * 0.05;
    }
  });

  return (
    <group>
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[dimensions.width + 10, dimensions.depth + 10]} />
        <meshStandardMaterial color="#0f1419" metalness={0.8} roughness={0.4} />
      </mesh>

      <gridHelper
        ref={gridRef}
        args={[dimensions.width + 10, 30, '#00d2d3', '#1a365d']}
        position={[0, 0.01, 0]}
      />
      <primitive object={gridRef.current} />

      <mesh position={[0, dimensions.height / 2, -dimensions.depth / 2]}>
        <boxGeometry args={[dimensions.width + 2, dimensions.height, 0.2]} />
        <meshStandardMaterial color="#0a0f14" metalness={0.9} roughness={0.3} transparent opacity={0.3} />
      </mesh>

      <ambientLight intensity={0.4} color="#e0f7fa" />
      <directionalLight
        position={[10, 15, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[0, dimensions.height - 1, 0]} intensity={0.5} color="#00d2d3" distance={30} />
    </group>
  );
}
