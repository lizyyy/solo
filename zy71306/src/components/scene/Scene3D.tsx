import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { ReactNode } from 'react';
import { useCalibrationStore } from '../../store/calibrationStore';
import Turntable from './Turntable';
import VinylRecord from './VinylRecord';
import Tonearm from './Tonearm';
import Stylus from './Stylus';
import WearIndicator from './WearIndicator';

interface Scene3DProps {
  children?: ReactNode;
}

export default function Scene3D({ children }: Scene3DProps) {
  const {
    stylusPressure,
    antiSkating,
    antiSkatingDirection,
    tonearmLength,
    wearLevel,
  } = useCalibrationStore();

  const rotationSpeed = 0.5;

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#1a1a2e']} />
        <fog attach="fog" args={['#1a1a2e', 5, 15]} />

        <ambientLight intensity={0.3} />

        <directionalLight
          position={[5, 5, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <directionalLight
          position={[-5, 3, -5]}
          intensity={0.6}
          color="#87ceeb"
        />

        <pointLight
          position={[0, 5, 0]}
          intensity={0.4}
          color="#ffd700"
        />

        <Environment preset="city" />

        <Turntable>
          <VinylRecord rotationSpeed={rotationSpeed}>
            <WearIndicator wearLevel={wearLevel} />
          </VinylRecord>
          <Tonearm
            stylusPressure={stylusPressure}
            antiSkating={antiSkating}
            antiSkatingDirection={antiSkatingDirection}
            tonearmLength={tonearmLength}
          >
            <Stylus stylusPressure={stylusPressure} />
          </Tonearm>
        </Turntable>

        {children}

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={10}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
