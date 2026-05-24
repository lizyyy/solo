import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/useSimulationStore';
import { StationModel } from './StationModel';
import { ParticleSystem } from './ParticleSystem';
import { BottleneckMarkers } from './BottleneckMarkers';

interface CameraControllerProps {
  viewMode: 'default' | 'top' | 'angle' | 'firstPerson';
  is2DMode: boolean;
  stationWidth: number;
  stationHeight: number;
}

const CameraController: React.FC<CameraControllerProps> = ({
  viewMode,
  is2DMode,
  stationWidth,
  stationHeight
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const maxDim = Math.max(stationWidth, stationHeight);
    
    if (is2DMode) {
      camera.position.set(0, maxDim, 0.01);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.enableRotate = false;
      }
    } else {
      switch (viewMode) {
        case 'top':
          camera.position.set(0, maxDim * 0.8, 0);
          camera.lookAt(0, 0, 0);
          break;
        case 'angle':
          camera.position.set(-maxDim * 0.6, maxDim * 0.5, -maxDim * 0.6);
          camera.lookAt(0, 0, 0);
          break;
        case 'firstPerson':
          camera.position.set(0, 1.7, stationHeight * 0.3);
          camera.lookAt(0, 1.7, 0);
          break;
        default:
          camera.position.set(0, maxDim * 0.5, maxDim * 0.6);
          camera.lookAt(0, 0, 0);
      }
      if (controlsRef.current) {
        controlsRef.current.enableRotate = true;
      }
    }
  }, [viewMode, is2DMode, camera, stationWidth, stationHeight]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={100}
    />
  );
};

interface SceneContentProps {
  stationWidth: number;
  stationHeight: number;
}

const SceneContent: React.FC<SceneContentProps> = ({ stationWidth, stationHeight }) => {
  const { selectedScene, passengers, bottlenecks, is2DMode, updateSimulation } = useSimulationStore();

  useFrame((_, delta) => {
    updateSimulation(Math.min(delta, 0.1));
  });

  if (!selectedScene) return null;

  return (
    <>
      <StationModel
        layout={selectedScene.layout}
        closedAreas={selectedScene.closedAreas}
        is2DMode={is2DMode}
      />
      <ParticleSystem
        passengers={passengers}
        stationWidth={stationWidth}
        stationHeight={stationHeight}
        is2DMode={is2DMode}
      />
      <BottleneckMarkers
        bottlenecks={bottlenecks}
        stationWidth={stationWidth}
        stationHeight={stationHeight}
        is2DMode={is2DMode}
      />
    </>
  );
};

export const SceneViewer: React.FC = () => {
  const { selectedScene, is2DMode, cameraView } = useSimulationStore();
  const stationWidth = selectedScene?.layout.width || 40;
  const stationHeight = selectedScene?.layout.height || 30;

  return (
    <div className="w-full h-full bg-slate-900 relative">
      <Canvas
        camera={{ position: [0, 30, 35], fov: 50 }}
        shadows
      >
        <color attach="background" args={['#0f172a']} />
        <fog attach="fog" args={['#0f172a', 50, 150]} />
        
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[20, 40, 20]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[0, 10, 0]} intensity={0.3} color="#93c5fd" />
        
        <CameraController
          viewMode={cameraView}
          is2DMode={is2DMode}
          stationWidth={stationWidth}
          stationHeight={stationHeight}
        />
        
        <SceneContent stationWidth={stationWidth} stationHeight={stationHeight} />
      </Canvas>

      {!selectedScene && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="text-center">
            <div className="text-6xl mb-4">🚇</div>
            <p className="text-slate-400 text-lg">请选择一个演练场景开始</p>
          </div>
        </div>
      )}
    </div>
  );
};
