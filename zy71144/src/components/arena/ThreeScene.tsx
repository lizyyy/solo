import { useEffect, useRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, FirstPersonControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl, FirstPersonControls as FirstPersonControlsImpl } from 'three-stdlib';
import { BuildingWalls } from './BuildingWalls';
import { Hydrant } from './Hydrant';
import { Staircase } from './Staircase';
import { HosePath } from './HosePath';
import { GroundPlane } from './GroundPlane';
import { useTrainingStore } from '../../store/useTrainingStore';
import { useSceneStore } from '../../store/useSceneStore';
import { calculateAll } from '../../utils/pressureCalculator';
import type { BuildingModel, Point3D } from '../../types';

interface CameraControllerProps {
  viewMode: 'top' | 'firstPerson' | 'free';
  target: Point3D;
  path: Point3D[];
}

function CameraController({ viewMode, target, path }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const firstPersonRef = useRef<FirstPersonControlsImpl>(null);

  useEffect(() => {
    if (viewMode === 'top') {
      camera.position.set(target.x, 50, target.z + 0.1);
      camera.lookAt(target.x, 0, target.z);
    } else if (viewMode === 'free') {
      camera.position.set(30, 25, 30);
      camera.lookAt(0, 0, 0);
    } else if (viewMode === 'firstPerson') {
      if (path.length > 0) {
        const lastPoint = path[path.length - 1];
        camera.position.set(lastPoint.x, lastPoint.y + 1.6, lastPoint.z);
        camera.lookAt(lastPoint.x + 5, lastPoint.y + 1.6, lastPoint.z);
      } else {
        camera.position.set(0, 1.6, 10);
        camera.lookAt(0, 1.6, 0);
      }
    }
  }, [viewMode, camera, target, path]);

  if (viewMode === 'firstPerson') {
    return (
      <FirstPersonControls
        ref={firstPersonRef}
        movementSpeed={50}
        lookSpeed={0.15}
        activeLook={true}
        heightCoef={0.5}
      />
    );
  }

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={100}
      maxPolarAngle={Math.PI / 2 - 0.1}
      makeDefault
    />
  );
}

interface SceneContentProps {
  building: BuildingModel;
}

function SceneContent({ building }: SceneContentProps) {
  const {
    path,
    selectedNodeId,
    addNode,
    removeNode,
    updateNodePosition,
    selectNode,
    setResult,
    params,
    mode,
    playbackIndex,
    result,
  } = useTrainingStore();
  const { settings, viewMode, setHoveredPosition } = useSceneStore();

  useEffect(() => {
    if (path.length >= 2) {
      const initialPressure = building.hydrants[0]?.pressure || 0.6;
      const calcResult = calculateAll(path, params, initialPressure);
      setResult(calcResult);
    } else {
      setResult(null);
    }
  }, [path, params, building.hydrants, setResult]);

  const handleGroundClick = (position: Point3D) => {
    if (mode === 'edit') {
      addNode(position);
    }
  };

  const handleHydrantClick = (position: Point3D) => {
    if (mode === 'edit') {
      addNode(position, path.length === 0 ? 'start' : 'corner');
    }
  };

  const handleStairClick = (position: Point3D) => {
    if (mode === 'edit') {
      addNode(position, 'stairs');
    }
  };

  const handleNodeDrag = (nodeId: string, position: Point3D) => {
    updateNodePosition(nodeId, position);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete' && selectedNodeId && path.length > 1) {
      removeNode(selectedNodeId);
    }
    if (e.key === 'Escape') {
      selectNode(null);
    }
  }, [selectedNodeId, path.length, removeNode, selectNode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[30, 25, 30]} fov={50} />
      <CameraController
        viewMode={viewMode}
        target={{ x: 0, y: 0, z: 0 }}
        path={path.map(n => n.position)}
      />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 40, 20]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <pointLight position={[0, 15, 0]} intensity={0.5} color="#ff6b6b" />
      <pointLight position={[-20, 10, 20]} intensity={0.3} color="#4ecdc4" />

      <fog attach="fog" args={['#0f172a', 30, 100]} />

      <GroundPlane
        size={building.groundSize}
        onClick={handleGroundClick}
        onHover={setHoveredPosition}
        visible={settings.showGrid}
      />

      <BuildingWalls walls={building.walls} visible={settings.showWalls} />

      {settings.showHydrants &&
        building.hydrants.map((hydrant) => (
          <Hydrant
            key={hydrant.id}
            hydrant={hydrant}
            onClick={handleHydrantClick}
            visible={settings.showHydrants}
          />
        ))}

      {settings.showStairs &&
        building.staircases.map((staircase) => (
          <Staircase
            key={staircase.id}
            staircase={staircase}
            onClick={handleStairClick}
            visible={settings.showStairs}
          />
        ))}

      <HosePath
        nodes={path}
        onNodeClick={selectNode}
        onNodeDrag={handleNodeDrag}
        selectedNodeId={selectedNodeId}
        playbackIndex={mode === 'playback' ? playbackIndex : -1}
        isValid={result?.isValid ?? true}
      />
    </>
  );
}

interface ThreeSceneProps {
  building: BuildingModel;
}

export function ThreeScene({ building }: ThreeSceneProps) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0f172a' }}
    >
      <SceneContent building={building} />
    </Canvas>
  );
}
