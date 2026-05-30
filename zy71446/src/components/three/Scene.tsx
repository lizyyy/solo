import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing';
import { useEffect, useRef, Suspense } from 'react';
import * as THREE from 'three';
import { StationHall } from './StationHall';
import { EscalatorGroup } from './Escalator';
import { TurnstileGroup } from './Turnstile';
import { PlatformGroup } from './Platform';
import { CrowdParticles } from './CrowdParticles';
import { HighlightEffect } from './HighlightEffect';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useUILayoutStore } from '../../store/useUILayoutStore';

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const cameraPosition = useUILayoutStore((state) => state.cameraPosition);
  const cameraTarget = useUILayoutStore((state) => state.cameraTarget);
  const targetRef = useRef(new THREE.Vector3(...cameraTarget));
  const positionRef = useRef(new THREE.Vector3(...cameraPosition));

  useEffect(() => {
    targetRef.current.set(...cameraTarget);
    positionRef.current.set(...cameraPosition);
  }, [cameraPosition, cameraTarget]);

  useFrame((_, delta) => {
    camera.position.lerp(positionRef.current, delta * 3);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetRef.current, delta * 3);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={60}
      maxPolarAngle={Math.PI / 2.1}
      minPolarAngle={Math.PI / 6}
    />
  );
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#1a1a2e', 0.4]} />
      <ambientLight intensity={0.3} />

      <rectAreaLight
        position={[0, 5, 0]}
        args={['#ffffff', 1.5, 20, 15]}
        lookAt={(...args: [THREE.Vector3] | [number, number, number]) => {
          if (args.length === 1) {
            args[0].set(0, 0, 0);
          }
        }}
      />
      <rectAreaLight
        position={[0, 2, 25]}
        args={['#f0f8ff', 1.2, 20, 8]}
        lookAt={(...args: [THREE.Vector3] | [number, number, number]) => {
          if (args.length === 1) {
            args[0].set(0, -3, 25);
          }
        }}
      />
      <rectAreaLight
        position={[0, -1, -25]}
        args={['#f0f8ff', 1.2, 20, 8]}
        lookAt={(...args: [THREE.Vector3] | [number, number, number]) => {
          if (args.length === 1) {
            args[0].set(0, -6, -25);
          }
        }}
      />

      <pointLight position={[-8, -1, 15]} color="#00ff88" intensity={0.5} distance={10} />
      <pointLight position={[8, -4, -15]} color="#00ff88" intensity={0.5} distance={10} />
      <pointLight position={[15, 0.5, 0]} color="#00ff00" intensity={0.3} distance={8} />
    </>
  );
}

function SimulationLoop() {
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const tick = useSimulationStore((state) => state.tick);
  const loadMockData = useSimulationStore((state) => state.loadMockData);
  const lastTickRef = useRef(0);

  useEffect(() => {
    loadMockData();
  }, [loadMockData]);

  useFrame((_, delta) => {
    if (isPlaying) {
      lastTickRef.current += delta;
      if (lastTickRef.current >= 0.5) {
        tick();
        lastTickRef.current = 0;
      }
    }
  });

  return null;
}

function SceneContent() {
  return (
    <>
      <CameraController />
      <Lighting />
      <fog attach="fog" args={['#0A1628', 30, 80]} />

      <StationHall />
      <EscalatorGroup />
      <TurnstileGroup />
      <PlatformGroup />
      <CrowdParticles />
      <HighlightEffect />

      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <SMAA />
      </EffectComposer>

      <SimulationLoop />
    </>
  );
}

export function ThreeScene() {
  return (
    <Canvas
      camera={{ position: [30, 25, 30], fov: 50, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      style={{ background: 'linear-gradient(180deg, #0A1628 0%, #0F172A 100%)' }}
    >
      <Suspense fallback={
        <Html center>
          <div className="text-cyan-400 font-mono text-lg animate-pulse">
            加载3D沙盘...
          </div>
        </Html>
      }>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
