import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import { PowerGrid } from './PowerGrid';
import { useGameStore } from '../../store/useGameStore';

export function GameCanvas() {
  const { weather } = useGameStore();

  const getSkyConfig = () => {
    switch (weather.type) {
      case 'clear':
        return { sunPosition: [100, 50, 100] as [number, number, number], turbidity: 2, rayleigh: 1 };
      case 'rain':
        return { sunPosition: [50, 20, 50] as [number, number, number], turbidity: 8, rayleigh: 0.5 };
      case 'storm':
        return { sunPosition: [30, 10, 30] as [number, number, number], turbidity: 10, rayleigh: 0.3 };
      case 'heavy_storm':
        return { sunPosition: [10, 5, 10] as [number, number, number], turbidity: 15, rayleigh: 0.1 };
      default:
        return { sunPosition: [100, 50, 100] as [number, number, number], turbidity: 2, rayleigh: 1 };
    }
  };

  const skyConfig = getSkyConfig();
  const ambientIntensity = weather.type === 'clear' ? 0.6 : weather.type === 'rain' ? 0.4 : 0.2;

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 20, 25], fov: 50 }}
        shadows
      >
        <color attach="background" args={['#0f172a']} />
        <fog attach="fog" args={['#0f172a', 30, 80]} />

        <ambientLight intensity={ambientIntensity} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={0.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {weather.type !== 'heavy_storm' && (
          <Sky
            distance={450000}
            sunPosition={skyConfig.sunPosition}
            turbidity={skyConfig.turbidity}
            rayleigh={skyConfig.rayleigh}
          />
        )}

        {weather.type === 'clear' && <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />}

        <PowerGrid />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
    </div>
  );
}
