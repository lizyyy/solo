import { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { DamModel } from './DamModel';
import { CrackRenderer } from './CrackRenderer';
import { SensorPoints } from './SensorPoints';
import { StressCloud } from './StressCloud';
import { useAppStore } from '../../store/useAppStore';

function CameraController() {
  const { camera } = useThree();
  const viewMode = useAppStore((state) => state.view.viewMode);

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = viewMode === 'perspective' ? 50 : 1;
    camera.updateProjectionMatrix();
  }

  return null;
}

function SceneContent() {
  const visibleLayers = useAppStore((state) => state.view.visibleLayers);
  const getFilteredCracks = useAppStore((state) => state.getFilteredCracks);
  const getFilteredSensors = useAppStore((state) => state.getFilteredSensors);
  const getFilteredStressPoints = useAppStore((state) => state.getFilteredStressPoints);

  const cracks = getFilteredCracks();
  const sensors = getFilteredSensors();
  const stressPoints = getFilteredStressPoints();

  const selectObject = useAppStore((state) => state.selectObject);

  return (
    <>
      <CameraController />

      <ambientLight intensity={0.3} />
      <directionalLight
        position={[50, 50, 50]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-30, 20, -30]} intensity={0.4} color="#ffd4a3" />
      <pointLight position={[0, 30, 0]} intensity={0.5} color="#87ceeb" />

      <group onClick={() => selectObject(null)}>
        {visibleLayers.dam && <DamModel />}
        {visibleLayers.cracks && <CrackRenderer cracks={cracks} />}
        {visibleLayers.sensors && <SensorPoints sensors={sensors} />}
        {visibleLayers.stress && <StressCloud stressPoints={stressPoints} />}
      </group>

      <Grid
        position={[0, 0, 0]}
        args={[100, 100]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#2d3748"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#4a5568"
        fadeDistance={100}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2.1}
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export function Scene3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <Canvas
      ref={canvasRef}
      camera={{ position: [60, 50, 60], fov: 50 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
      shadows
      onPointerMissed={() => useAppStore.getState().selectObject(null)}
    >
      <Environment preset="city" />
      <SceneContent />
    </Canvas>
  );
}
