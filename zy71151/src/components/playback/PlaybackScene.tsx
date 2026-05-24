import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { Suspense } from 'react';
import { ShipModel } from '../../scenes/ShipModel';
import { TugModel } from '../../scenes/TugModel';
import { BerthModel } from '../../scenes/BerthModel';
import { Water } from '../../scenes/Water';
import { GameState } from '../../types';

interface PlaybackSceneProps {
  state: GameState;
}

export function PlaybackScene({ state }: PlaybackSceneProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [0, 40, 50], fov: 50 }}
        gl={{ antialias: true }}
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
            position={[50, 80, 50]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />

          <Water tideLevel={state.tide.currentLevel} />

          <mesh position={[0, -1, 35]} receiveShadow>
            <boxGeometry args={[120, 2, 30]} />
            <meshStandardMaterial color="#374151" />
          </mesh>

          <mesh position={[-45, -0.8, 25]} receiveShadow>
            <boxGeometry args={[10, 0.5, 50]} />
            <meshStandardMaterial color="#4b5563" />
          </mesh>

          <mesh position={[45, -0.8, 25]} receiveShadow>
            <boxGeometry args={[10, 0.5, 50]} />
            <meshStandardMaterial color="#4b5563" />
          </mesh>

          {state.berths.map((berth) => (
            <BerthModel key={berth.id} berth={berth} />
          ))}

          {state.ships.map((ship) => (
            <ShipModel key={ship.id} ship={ship} isSelected={false} />
          ))}

          {state.tugs.map((tug) => (
            <TugModel key={tug.id} tug={tug} isSelected={false} />
          ))}

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={20}
            maxDistance={100}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, 0]}
          />

          <gridHelper args={[200, 40, '#1e3a5f', '#1e3a5f']} position={[0, -0.9, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
}
