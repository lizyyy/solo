import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { Suspense } from 'react';
import { ShipModel } from './ShipModel';
import { TugModel } from './TugModel';
import { BerthModel } from './BerthModel';
import { Water } from './Water';
import { GameState } from '../types';
import { useGameActions } from '../store/gameStore';

interface PortSceneProps {
  state: GameState;
}

export function PortScene({ state }: PortSceneProps) {
  const { selectTug, selectShip, assignTug } = useGameActions();

  const handleTugClick = (tugId: string) => {
    if (state.selectedTugId === tugId) {
      selectTug(undefined);
    } else if (state.selectedShipId) {
      assignTug(tugId, state.selectedShipId);
      selectShip(undefined);
    } else {
      selectTug(tugId);
    }
  };

  const handleShipClick = (shipId: string) => {
    if (state.selectedTugId) {
      assignTug(state.selectedTugId, shipId);
      selectTug(undefined);
    } else {
      selectShip(state.selectedShipId === shipId ? undefined : shipId);
    }
  };

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
          <directionalLight position={[-30, 20, -30]} intensity={0.3} />

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
            <ShipModel
              key={ship.id}
              ship={ship}
              isSelected={state.selectedShipId === ship.id}
              onClick={() => handleShipClick(ship.id)}
            />
          ))}

          {state.tugs.map((tug) => (
            <TugModel
              key={tug.id}
              tug={tug}
              isSelected={state.selectedTugId === tug.id}
              onClick={() => handleTugClick(tug.id)}
            />
          ))}

          {state.collisionWarnings.map((warning) => (
            <mesh
              key={warning.id}
              position={[
                (state.tugs.find((t) => t.id === warning.object1Id)?.position.x || 0) / 10,
                5,
                (state.tugs.find((t) => t.id === warning.object1Id)?.position.z || 0) / 10,
              ]}
            >
              <sphereGeometry args={[warning.severity === 'critical' ? 0.8 : 0.5, 16, 16]} />
              <meshBasicMaterial
                color={warning.severity === 'critical' ? '#ef4444' : '#f59e0b'}
                transparent
                opacity={0.6}
              />
            </mesh>
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
