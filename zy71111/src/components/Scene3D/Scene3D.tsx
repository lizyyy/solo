
import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Blade } from './Blade';
import { Annotations } from './Annotations';
import { FlightPath } from './FlightPath';

function CameraController() {
  const controlsRef = useRef<any>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={3}
      maxDistance={30}
      maxPolarAngle={Math.PI * 0.9}
      minPolarAngle={Math.PI * 0.1}
    />
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} />
      <hemisphereLight args={['#87ceeb', '#1a1a2e', 0.3]} />

      <Blade />
      <Annotations />
      <FlightPath />

      <gridHelper args={[20, 20, '#334155', '#1e293b']} position={[0, -4, 0]} />

      <CameraController />
    </>
  );
}

export function Scene3D() {
  return (
    <Canvas
      camera={{
        position: [0, 0, 12],
        fov: 50,
        near: 0.1,
        far: 1000,
      }}
      shadows
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
    >
      <fog attach="fog" args={['#0f172a', 15, 40]} />
      <SceneContent />
    </Canvas>
  );
}
