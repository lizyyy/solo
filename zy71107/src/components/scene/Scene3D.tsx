import React, { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { CameraView } from '../../data/types';
import ExhibitionHall from './ExhibitionHall';
import Showcases from './Showcase';
import Trajectories from './TrajectoryLine';
import Heatmap from './Heatmap';
import AnomalyMarkers from './AnomalyMarkers';

const CameraController: React.FC = () => {
  const { camera } = useThree();
  const cameraView = useSceneStore((state) => state.cameraView);
  const hallData = useSceneStore((state) => state.hallData);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!hallData) return;

    const { width, depth } = hallData.dimensions;
    const maxDim = Math.max(width, depth);

    switch (cameraView) {
      case 'top':
        camera.position.set(0, maxDim, 0.1);
        camera.lookAt(0, 0, 0);
        break;
      case 'perspective':
        camera.position.set(maxDim * 0.8, maxDim * 0.6, maxDim * 0.8);
        camera.lookAt(0, 0, 0);
        break;
      case 'front':
        camera.position.set(0, maxDim * 0.4, maxDim * 0.8);
        camera.lookAt(0, 0, 0);
        break;
      case 'side':
        camera.position.set(maxDim * 0.8, maxDim * 0.4, 0);
        camera.lookAt(0, 0, 0);
        break;
    }

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [cameraView, hallData, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2 - 0.1}
    />
  );
};

const SceneContent: React.FC = () => {
  const isPlaying = useSceneStore((state) => state.isPlaying);
  const playbackSpeed = useSceneStore((state) => state.playbackSpeed);
  const currentTime = useSceneStore((state) => state.currentTime);
  const totalDuration = useSceneStore((state) => state.totalDuration);
  const setCurrentTime = useSceneStore((state) => state.setCurrentTime);
  const setPlaying = useSceneStore((state) => state.setPlaying);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 500 * playbackSpeed;
        if (next >= totalDuration) {
          setPlaying(false);
          return totalDuration;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, totalDuration, setCurrentTime, setPlaying]);

  return (
    <>
      <ExhibitionHall />
      <Showcases />
      <Trajectories />
      <Heatmap />
      <AnomalyMarkers />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={0.5} />
        <Vignette offset={0.5} darkness={0.5} />
      </EffectComposer>
    </>
  );
};

const Scene3D: React.FC = () => {
  return (
    <Canvas
      shadows
      camera={{ position: [20, 15, 20], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a1628' }}
    >
      <CameraController />
      <SceneContent />
    </Canvas>
  );
};

export default Scene3D;
