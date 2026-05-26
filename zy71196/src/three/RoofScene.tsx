import { useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { RoofMap, LeakPoint } from '../game/types';
import { Drain } from './Drain';
import { Water } from './Water';
import { Obstacle } from './Obstacle';
import { RainEffect } from './RainEffect';

interface RoofSceneContentProps {
  roofMap: RoofMap;
  leakPoints: LeakPoint[];
  rainfallIntensity: number;
  onDrainClick: (drainId: string) => void;
  onLowAreaClick: (lowAreaId: string) => void;
  selectedId: string | null;
}

function RoofSceneContent({
  roofMap,
  leakPoints,
  rainfallIntensity,
  onDrainClick,
  onLowAreaClick,
  selectedId,
}: RoofSceneContentProps) {
  const { camera } = useThree();

  const centerX = roofMap.width / 2;
  const centerZ = roofMap.height / 2;
  const maxDim = Math.max(roofMap.width, roofMap.height);
  const cameraDistance = maxDim * 1.2;

  camera.position.set(centerX + cameraDistance, cameraDistance * 0.8, centerZ + cameraDistance);
  camera.lookAt(centerX, 0, centerZ);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[roofMap.width / 2, 0, roofMap.height / 2]}
        receiveShadow
      >
        <planeGeometry args={[roofMap.width, roofMap.height]} />
        <meshStandardMaterial color="#333333" roughness={0.9} />
      </mesh>

      <mesh
        position={[roofMap.width / 2, 0.25, roofMap.height / 2]}
        receiveShadow
      >
        <boxGeometry args={[roofMap.width + 0.5, 0.5, 0.2]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      <mesh
        position={[roofMap.width / 2, 0.25, 0.1]}
        receiveShadow
      >
        <boxGeometry args={[roofMap.width + 0.5, 0.5, 0.2]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      <mesh
        position={[0.1, 0.25, roofMap.height / 2]}
        receiveShadow
      >
        <boxGeometry args={[0.2, 0.5, roofMap.height]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      <mesh
        position={[roofMap.width - 0.1, 0.25, roofMap.height / 2]}
        receiveShadow
      >
        <boxGeometry args={[0.2, 0.5, roofMap.height]} />
        <meshStandardMaterial color="#444444" />
      </mesh>

      {roofMap.drains.map((drain) => (
        <Drain
          key={drain.id}
          drain={drain}
          onClick={() => onDrainClick(drain.id)}
          isSelected={selectedId === drain.id}
        />
      ))}

      {roofMap.lowAreas.map((lowArea) => (
        <Water
          key={lowArea.id}
          lowArea={lowArea}
          onClick={() => onLowAreaClick(lowArea.id)}
          isSelected={selectedId === lowArea.id}
        />
      ))}

      {roofMap.obstacles.map((obstacle) => (
        <Obstacle key={obstacle.id} obstacle={obstacle} />
      ))}

      {leakPoints.map((leak) => (
        <mesh
          key={leak.id}
          position={[leak.position.x, 0.5, leak.position.y]}
        >
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color="#FF0000" transparent opacity={0.8} />
        </mesh>
      ))}

      <RainEffect
        intensity={rainfallIntensity}
        width={roofMap.width + 4}
        height={roofMap.height + 4}
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2.1}
        target={[centerX, 0, centerZ]}
      />
    </>
  );
}

interface RoofSceneProps {
  roofMap: RoofMap;
  leakPoints: LeakPoint[];
  rainfallIntensity: number;
  onDrainClick: (drainId: string) => void;
  onLowAreaClick: (lowAreaId: string) => void;
}

export function RoofScene({
  roofMap,
  leakPoints,
  rainfallIntensity,
  onDrainClick,
  onLowAreaClick,
}: RoofSceneProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleDrainClick = (drainId: string) => {
    setSelectedId(drainId);
    onDrainClick(drainId);
  };

  const handleLowAreaClick = (lowAreaId: string) => {
    setSelectedId(lowAreaId);
    onLowAreaClick(lowAreaId);
  };

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ fov: 60 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#1a1a2e']} />
        <fog attach="fog" args={['#1a1a2e', 20, 50]} />
        <RoofSceneContent
          roofMap={roofMap}
          leakPoints={leakPoints}
          rainfallIntensity={rainfallIntensity}
          onDrainClick={handleDrainClick}
          onLowAreaClick={handleLowAreaClick}
          selectedId={selectedId}
        />
      </Canvas>
    </div>
  );
}
