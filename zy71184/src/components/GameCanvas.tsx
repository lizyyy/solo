import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { CityGrid } from '../three/CityGrid';
import { Facilities } from '../three/Facilities';
import { WaterEffect } from '../three/WaterEffect';
import { RainEffect } from '../three/RainEffect';
import { CameraControls } from '../three/CameraControls';
import { useGameStore } from '../store/useGameStore';

export function GameCanvas() {
  const { state, selectCell } = useGameStore();

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [60, 60, 60], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#1a1a2e']} />
        <fog attach="fog" args={['#1a1a2e', 80, 150]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[50, 80, 30]}
          intensity={1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={200}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
        />
        <hemisphereLight args={['#87CEEB', '#362d36', 0.3]} />

        <CityGrid
          grid={state.grid}
          selectedCell={state.selectedCell}
          onCellClick={selectCell}
        />
        <Facilities facilities={state.facilities} />
        <WaterEffect grid={state.grid} />
        <RainEffect currentRain={state.currentRain} />
        <CameraControls />

        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
