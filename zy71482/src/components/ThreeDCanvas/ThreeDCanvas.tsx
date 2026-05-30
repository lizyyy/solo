import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCurlingStore } from '../../store/curlingStore';
import { getPositionAtTime } from '../../physics/trajectory';
import { IceSheet } from './IceSheet';
import { CurlingStone } from './CurlingStone';
import { TrajectoryLine } from './TrajectoryLine';
import { CollisionMarker } from './CollisionMarker';
import { ICE_SHEET_LENGTH } from '../../types';

const SceneContent: React.FC = () => {
  const {
    dataSources,
    selectedStoneId,
    trajectories,
    collisions,
    simulation,
    selectStone
  } = useCurlingStore();
  
  const rotationRef = useRef<Map<string, number>>(new Map());

  useFrame((_, delta) => {
    if (!simulation.isPlaying) return;

    const newTime = Math.min(
      simulation.currentTime + delta * simulation.speed,
      simulation.maxTime
    );
    
    useCurlingStore.getState().setCurrentTime(newTime);

    if (newTime >= simulation.maxTime) {
      useCurlingStore.getState().setPlaying(false);
    }
  });

  const allStones = dataSources.flatMap(s => s.stones);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      <IceSheet />

      {allStones.map(stone => {
        const trajectory = trajectories.get(stone.id);
        if (!trajectory) return null;

        const currentPoint = getPositionAtTime(trajectory, simulation.currentTime);
        
        if (!rotationRef.current.has(stone.id)) {
          rotationRef.current.set(stone.id, 0);
        }
        
        const rotSpeed = stone.rotation.direction === 'clockwise' ? 1 : -1;
        const newRotation = rotationRef.current.get(stone.id)! + rotSpeed * 0.05;
        rotationRef.current.set(stone.id, newRotation);

        return (
          <React.Fragment key={stone.id}>
            <TrajectoryLine points={trajectory} color={stone.color} />
            <CurlingStone
              position={[currentPoint.position.x, 0, currentPoint.position.y]}
              color={stone.color}
              isSelected={selectedStoneId === stone.id}
              rotation={newRotation}
              onClick={() => selectStone(stone.id)}
            />
          </React.Fragment>
        );
      })}

      {collisions.map(collision => (
        <CollisionMarker
          key={collision.id}
          collision={collision}
          visible={simulation.currentTime >= collision.timestamp}
        />
      ))}

      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
};

export const ThreeDCanvas: React.FC = () => {
  const { runSimulation } = useCurlingStore();

  useEffect(() => {
    runSimulation();
  }, []);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 15, ICE_SHEET_LENGTH / 2 - 5], fov: 50 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a1a']} />
      <fog attach="fog" args={['#0a0a1a', 30, 80]} />
      <SceneContent />
    </Canvas>
  );
};
