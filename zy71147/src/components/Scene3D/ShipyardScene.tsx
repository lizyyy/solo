
import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store/appStore';
import { getBlockPositionAtProgress } from '../../utils/collision';
import { Block3D } from './Block3D';
import { Pier3D } from './Pier3D';
import { Rail3D } from './Rail3D';
import { LiftingPath3D } from './LiftingPath3D';
import { CollisionMarker } from './CollisionMarker';

const SceneContent: React.FC = () => {
  const {
    sceneData,
    visibility,
    timelineProgress,
    isPlaying,
    selectedBlockId,
    collisions,
    setTimelineProgress,
    setSelectedBlockId,
  } = useAppStore();

  useFrame((_, delta) => {
    if (isPlaying) {
      setTimelineProgress(timelineProgress + delta * 0.05);
      if (timelineProgress >= 1) {
        useAppStore.getState().setIsPlaying(false);
      }
    }
  });

  const handleSceneClick = (e: any) => {
    if (e.object === e.eventObject) {
      setSelectedBlockId(null);
    }
  };

  return (
    <group onClick={handleSceneClick}>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 80, 50]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <directionalLight position={[-30, 40, -30]} intensity={0.3} />

      <Sky sunPosition={[100, 50, 100]} turbidity={0.5} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />

      <Grid
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#3a3a4a"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#5a5a6a"
        fadeDistance={100}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
        position={[0, 0.01, 0]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2a2a35" transparent opacity={0.8} />
      </mesh>

      {visibility.rails && sceneData.rails.map((rail) => (
        <Rail3D key={rail.id} rail={rail} />
      ))}

      {visibility.piers && sceneData.piers.map((pier) => (
        <Pier3D key={pier.id} pier={pier} />
      ))}

      {visibility.liftingPaths && sceneData.liftingPaths.map((path) => (
        <LiftingPath3D
          key={path.id}
          path={path}
          progress={timelineProgress}
          color="#165DFF"
        />
      ))}

      {visibility.blocks && sceneData.blocks.map((block) => {
        const currentPos = getBlockPositionAtProgress(
          block,
          sceneData.liftingPaths,
          timelineProgress
        );
        return (
          <Block3D
            key={block.id}
            block={block}
            isSelected={selectedBlockId === block.id}
            currentPosition={currentPos}
            onSelect={setSelectedBlockId}
            showLiftingPoints={visibility.liftingPoints}
          />
        );
      })}

      {visibility.collisionMarkers && collisions.map((collision) => (
        <CollisionMarker key={collision.id} collision={collision} />
      ))}
    </group>
  );
};

interface ShipyardSceneProps {
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const ShipyardScene: React.FC<ShipyardSceneProps> = ({ containerRef }) => {
  const { cameraView } = useAppStore();

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <PerspectiveCamera
        makeDefault
        position={[cameraView.position.x, cameraView.position.y, cameraView.position.z]}
        fov={50}
        near={0.1}
        far={1000}
      />
      <OrbitControls
        makeDefault
        target={[cameraView.target.x, cameraView.target.y, cameraView.target.z]}
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2.1}
      />
      <SceneContent />
    </Canvas>
  );
};

