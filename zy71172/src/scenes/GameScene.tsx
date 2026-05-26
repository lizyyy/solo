
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { Suspense } from 'react';
import { TrashBin3D } from './TrashBin3D';
import { Ground3D } from './Ground3D';
import { AppointmentStation3D } from './AppointmentStation3D';
import { useGameStore } from '@/store/useGameStore';
import { TargetType } from '@/types';
import { getCurrentAppointmentSlot } from '@/engine/rules';

interface GameSceneProps {
  onBinClick?: (target: TargetType) => void;
}

export function GameScene({ onBinClick }: GameSceneProps) {
  const gameState = useGameStore();
  const { highlightedBin, levelConfig } = gameState;
  const hasAppointment = levelConfig?.hasAppointmentMechanic ?? false;

  const appointmentStatus = levelConfig
    ? getCurrentAppointmentSlot(gameState, levelConfig)
    : { available: true };

  const binPositions: Record<string, [number, number, number]> = {
    recyclable: [-3, 0, -1],
    wet: [-1, 0, -1],
    dry: [1, 0, -1],
    hazardous: [3, 0, -1],
  };

  const categories: Array<'recyclable' | 'wet' | 'dry' | 'hazardous'> = ['recyclable', 'wet', 'dry', 'hazardous'];

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [0, 8, 10], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Sky
            distance={450000}
            sunPosition={[100, 50, 100]}
            inclination={0.5}
            azimuth={0.25}
          />

          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 15, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
          />

          <Ground3D />

          {categories.map((category) => (
            <TrashBin3D
              key={category}
              category={category}
              position={binPositions[category]}
              isHighlighted={highlightedBin === category}
              onClick={() => onBinClick?.(category)}
            />
          ))}

          {hasAppointment && (
            <AppointmentStation3D
              position={[0, 0, 2.5]}
              isAvailable={appointmentStatus.available}
              isHighlighted={highlightedBin === 'appointment'}
              onClick={() => onBinClick?.('appointment')}
            />
          )}

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2.2}
            minAzimuthAngle={-Math.PI / 6}
            maxAzimuthAngle={Math.PI / 6}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default GameScene;
