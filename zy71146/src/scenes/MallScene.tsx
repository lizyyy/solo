import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '@/store/sceneStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useUIStore } from '@/store/uiStore';
import { Column } from './elements/Column';
import { Signage } from './elements/Signage';
import { Store } from './elements/Store';
import { Barrier } from './elements/Barrier';
import { PathLine } from './elements/PathLine';
import { BlindSpotMarker } from './elements/BlindSpotMarker';
import { sampleScenes, sampleBlindSpots } from '@/data/sampleScenes';
import { useVisibilityCheck } from '@/hooks/useVisibilityCheck';
import { Column as ColumnType, Signage as SignageType, Store as StoreType, Barrier as BarrierType } from '@/types';

export function MallScene() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  const elements = useSceneStore(state => state.elements);
  const paths = useSceneStore(state => state.paths);
  const selectedElement = useSceneStore(state => state.selectedElement);
  const setSelectedElement = useSceneStore(state => state.setSelectedElement);
  const setCameraPosition = useSceneStore(state => state.setCameraPosition);
  const setCameraRotation = useSceneStore(state => state.setCameraRotation);
  const isPlaying = useSceneStore(state => state.isPlaying);
  const setCurrentTime = useSceneStore(state => state.setCurrentTime);
  const playbackSpeed = useSceneStore(state => state.playbackSpeed);
  const totalDuration = useSceneStore(state => state.totalDuration);
  const currentTime = useSceneStore(state => state.currentTime);
  const setCurrentScene = useSceneStore(state => state.setCurrentScene);
  const setElements = useSceneStore(state => state.setElements);
  const setPaths = useSceneStore(state => state.setPaths);
  const setTotalDuration = useSceneStore(state => state.setTotalDuration);
  
  const blindSpots = useAnalysisStore(state => state.blindSpots);
  const setBlindSpots = useAnalysisStore(state => state.setBlindSpots);
  const activeBlindSpot = useAnalysisStore(state => state.activeBlindSpot);
  const setActiveBlindSpot = useAnalysisStore(state => state.setActiveBlindSpot);
  const visibilityCheckEnabled = useAnalysisStore(state => state.visibilityCheckEnabled);
  const setVisibilityResults = useAnalysisStore(state => state.setVisibilityResults);
  const filters = useAnalysisStore(state => state.filters);
  const viewerPosition = useAnalysisStore(state => state.viewerPosition);
  
  const showStats = useUIStore(state => state.showStats);
  
  const { checkVisibility } = useVisibilityCheck();

  useEffect(() => {
    const scene = sampleScenes[0];
    setCurrentScene(scene);
    setElements(scene.elements);
    setPaths(scene.paths);
    setTotalDuration(70);
    
    const blindSpotsWithIds = sampleBlindSpots.map((spot, index) => ({
      ...spot,
      id: `blindspot-${index}`,
    }));
    setBlindSpots(blindSpotsWithIds);
  }, [setCurrentScene, setElements, setPaths, setTotalDuration, setBlindSpots]);

  useEffect(() => {
    if (visibilityCheckEnabled) {
      const signages = elements.filter(
        el => el.type === 'signage'
      ) as SignageType[];
      const columns = elements.filter(
        el => el.type === 'column' || el.type === 'barrier'
      ) as ColumnType[];
      
      const results = checkVisibility(viewerPosition, signages, columns);
      setVisibilityResults(results);
    }
  }, [visibilityCheckEnabled, elements, viewerPosition, checkVisibility, setVisibilityResults]);

  useFrame((_, delta) => {
    if (isPlaying) {
      const newTime = Math.min(currentTime + delta * playbackSpeed * 10, totalDuration);
      setCurrentTime(newTime);
    }
    
    setCameraPosition([camera.position.x, camera.position.y, camera.position.z]);
    setCameraRotation([camera.rotation.x, camera.rotation.y, camera.rotation.z]);
  });

  const handleCanvasClick = () => {
    setSelectedElement(null);
    setActiveBlindSpot(null);
  };

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 8, 0]} intensity={1} castShadow />
      <pointLight position={[-15, 8, 0]} intensity={0.6} />
      <pointLight position={[15, 8, 0]} intensity={0.6} />
      <pointLight position={[0, 8, -15]} intensity={0.6} />
      <pointLight position={[0, 8, 15]} intensity={0.6} />

      <Grid
        position={[0, 0.01, 0]}
        args={[60, 40]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#263238"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#37474f"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      <mesh position={[-30, 2, 0]}>
        <boxGeometry args={[0.5, 4, 40]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>
      <mesh position={[30, 2, 0]}>
        <boxGeometry args={[0.5, 4, 40]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>
      <mesh position={[0, 2, -20]}>
        <boxGeometry args={[60, 4, 0.5]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>
      <mesh position={[0, 2, 20]}>
        <boxGeometry args={[60, 4, 0.5]} />
        <meshStandardMaterial color="#16213e" />
      </mesh>

      <mesh position={[0, 4.1, 0]}>
        <boxGeometry args={[60, 0.2, 40]} />
        <meshStandardMaterial color="#0f0f23" metalness={0.5} roughness={0.5} />
      </mesh>

      {Array.from({ length: 12 }).map((_, i) => (
        <pointLight
          key={`ceiling-light-${i}`}
          position={[
            -25 + (i % 6) * 10,
            3.8,
            -10 + Math.floor(i / 6) * 20,
          ]}
          intensity={0.3}
          distance={8}
          color="#fff8e7"
        />
      ))}

      <mesh position={[-28, 2, 0]}>
        <boxGeometry args={[1, 4, 5]} />
        <meshStandardMaterial color="#00bcd4" emissive="#00bcd4" emissiveIntensity={0.3} />
      </mesh>

      {filters.columns && elements
        .filter(el => el.type === 'column' && el.visible)
        .map(el => (
          <Column
            key={el.id}
            data={el as ColumnType}
            onClick={() => setSelectedElement(el.id)}
          />
        ))}

      {filters.signages && elements
        .filter(el => el.type === 'signage' && el.visible)
        .map(el => (
          <Signage
            key={el.id}
            data={el as SignageType}
            onClick={() => setSelectedElement(el.id)}
          />
        ))}

      {filters.stores && elements
        .filter(el => el.type === 'store' && el.visible)
        .map(el => (
          <Store
            key={el.id}
            data={el as StoreType}
            onClick={() => setSelectedElement(el.id)}
          />
        ))}

      {filters.barriers && elements
        .filter(el => el.type === 'barrier' && el.visible)
        .map(el => (
          <Barrier
            key={el.id}
            data={el as BarrierType}
            onClick={() => setSelectedElement(el.id)}
          />
        ))}

      {filters.paths && paths.map(path => (
        <PathLine key={path.id} data={path} />
      ))}

      {blindSpots.map(spot => (
        <BlindSpotMarker
          key={spot.id}
          data={spot}
          onClick={() => setActiveBlindSpot(spot.id)}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />

      {showStats && <Stats />}

      <mesh
        position={[0, -10, 0]}
        rotation={[0, 0, 0]}
        onClick={handleCanvasClick}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}
