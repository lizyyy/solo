import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Greenhouse } from './Greenhouse';
import { Plants } from './Plants';
import { RobotPath } from './RobotPath';
import { Heatmap } from './Heatmap';
import { useSimulationStore } from '../../store/useSimulationStore';
import { ViewPreset } from '../../types';

const viewPresets: Record<ViewPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  overview: { position: [15, 12, 15], target: [0, 0, 0] },
  side: { position: [20, 5, 0], target: [0, 0, 0] },
  top: { position: [0, 25, 0.01], target: [0, 0, 0] },
  front: { position: [0, 8, 20], target: [0, 0, 0] },
};

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { currentView, setCamera, camera: storedCamera } = useSimulationStore();
  
  useEffect(() => {
    const preset = viewPresets[currentView];
    if (preset && controlsRef.current) {
      controlsRef.current.target.set(...preset.target);
      camera.position.set(...preset.position);
      controlsRef.current.update();
    }
  }, [currentView, camera]);
  
  useFrame(() => {
    if (controlsRef.current) {
      const pos = camera.position;
      const target = controlsRef.current.target;
      setCamera(
        [pos.x, pos.y, pos.z],
        [target.x, target.y, target.z]
      );
    }
  });
  
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2}
    />
  );
}

function Lighting() {
  const { light } = useSimulationStore();
  
  const sunAngleRad = (light.sunAngle * Math.PI) / 180;
  const sunX = Math.sin(sunAngleRad) * 20;
  const sunY = Math.cos(sunAngleRad) * 20;
  
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[sunX, sunY, 10]}
        intensity={light.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <hemisphereLight intensity={0.3} groundColor="#4a5568" />
    </>
  );
}

export function Scene3D() {
  return (
    <Canvas
      shadows
      camera={{ fov: 50, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'linear-gradient(180deg, #e2e8f0 0%, #f1f5f9 100%)' }}
    >
      <CameraController />
      <Lighting />
      <Greenhouse />
      <Plants />
      <RobotPath />
      <Heatmap />
      <gridHelper args={[50, 50, '#cbd5e1', '#e2e8f0']} position={[0, 0.001, 0]} />
    </Canvas>
  );
}
