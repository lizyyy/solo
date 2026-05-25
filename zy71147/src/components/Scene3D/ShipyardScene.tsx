
import React, { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Sky } from '@react-three/drei';
import { useAppStore } from '../../store/appStore';
import { getBlockPositionAtProgress } from '../../utils/collision';
import { Block3D } from './Block3D';
import { Pier3D } from './Pier3D';
import { Rail3D } from './Rail3D';
import { LiftingPath3D } from './LiftingPath3D';
import { CollisionMarker } from './CollisionMarker';
import { SceneData, VisibilityState, CollisionResult } from '../../types';
import { checkAllCollisions } from '../../utils/collision';

interface SceneContentProps {
  sceneData: SceneData;
  visibility: VisibilityState;
  timelineProgress: number;
  isPlaying: boolean;
  selectedBlockId: string | null;
  collisions: CollisionResult[];
  onSelectBlock: (id: string | null) => void;
  onProgressChange: (progress: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onBlockDrag?: (blockId: string, position: { x: number; y: number; z: number }) => void;
}

const SceneContent: React.FC<SceneContentProps> = ({
  sceneData,
  visibility,
  timelineProgress,
  isPlaying,
  selectedBlockId,
  collisions,
  onSelectBlock,
  onProgressChange,
  onPlayingChange,
  onBlockDrag,
}) => {
  useFrame((_, delta) => {
    if (isPlaying) {
      const newProgress = timelineProgress + delta * 0.05;
      if (newProgress >= 1) {
        onPlayingChange(false);
        onProgressChange(1);
      } else {
        onProgressChange(newProgress);
      }
    }
  });

  const handleSceneClick = (e: { object: unknown; eventObject: unknown }) => {
    if (e.object === e.eventObject) {
      onSelectBlock(null);
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
            onSelect={onSelectBlock}
            showLiftingPoints={visibility.liftingPoints}
            onDrag={onBlockDrag}
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
  customSceneData?: SceneData;
  readOnly?: boolean;
}

export const ShipyardScene: React.FC<ShipyardSceneProps> = ({ 
  customSceneData,
  readOnly = false 
}) => {
  const mainStore = useAppStore();
  
  const storeData = useMemo(() => {
    if (customSceneData) {
      return {
        sceneData: customSceneData,
        visibility: mainStore.visibility,
        timelineProgress: mainStore.timelineProgress,
        isPlaying: false,
        selectedBlockId: null,
        collisions: checkAllCollisions(
          customSceneData.blocks,
          customSceneData.piers,
          customSceneData.rails,
          customSceneData.liftingPaths,
          mainStore.timelineProgress
        ),
      };
    }
    return {
      sceneData: mainStore.sceneData,
      visibility: mainStore.visibility,
      timelineProgress: mainStore.timelineProgress,
      isPlaying: mainStore.isPlaying,
      selectedBlockId: mainStore.selectedBlockId,
      collisions: mainStore.collisions,
    };
  }, [customSceneData, mainStore]);

  const handleSelectBlock = (id: string | null) => {
    if (!readOnly) {
      mainStore.setSelectedBlockId(id);
    }
  };

  const handleProgressChange = (progress: number) => {
    if (!readOnly) {
      mainStore.setTimelineProgress(progress);
    }
  };

  const handlePlayingChange = (playing: boolean) => {
    if (!readOnly) {
      mainStore.setIsPlaying(playing);
    }
  };

  const handleBlockDrag = (blockId: string, position: { x: number; y: number; z: number }) => {
    if (!readOnly) {
      mainStore.updateBlockPosition(blockId, position);
    }
  };

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <PerspectiveCamera
        makeDefault
        position={[mainStore.cameraView.position.x, mainStore.cameraView.position.y, mainStore.cameraView.position.z]}
        fov={50}
        near={0.1}
        far={1000}
      />
      <OrbitControls
        makeDefault
        target={[mainStore.cameraView.target.x, mainStore.cameraView.target.y, mainStore.cameraView.target.z]}
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2.1}
      />
      <SceneContent
        sceneData={storeData.sceneData}
        visibility={storeData.visibility}
        timelineProgress={storeData.timelineProgress}
        isPlaying={storeData.isPlaying}
        selectedBlockId={storeData.selectedBlockId}
        collisions={storeData.collisions}
        onSelectBlock={handleSelectBlock}
        onProgressChange={handleProgressChange}
        onPlayingChange={handlePlayingChange}
        onBlockDrag={handleBlockDrag}
      />
    </Canvas>
  );
};

