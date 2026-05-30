import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Track } from './Track';
import { Coil } from './Coil';
import { Projectile } from './Projectile';

function SceneContent() {
  const {
    params,
    projectilePosition,
    projectileVelocity,
    temperatures,
    state: simState,
    focusedObjectId,
  } = useSimulationStore();

  const isRunning = simState === 'running';

  const coilPositions = useMemo(() => {
    return Array.from({ length: params.stageCount }, (_, i) => ({
      id: `coil-${i + 1}`,
      position: [(i + 0.5) * (params.trackLength / params.stageCount) - params.trackLength / 2, 0.07, 0] as [number, number, number],
      isActive: isRunning && projectilePosition >= i * (params.trackLength / params.stageCount) && projectilePosition < (i + 1) * (params.trackLength / params.stageCount),
    }));
  }, [params.stageCount, params.trackLength, isRunning, projectilePosition]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#00d4ff" />

      <Track
        length={params.trackLength}
        temperature={temperatures.track}
        isHighlighted={focusedObjectId === 'track-main'}
      />

      {coilPositions.map((coil, index) => (
        <Coil
          key={coil.id}
          position={coil.position}
          current={coil.isActive ? params.coilCurrent : params.coilCurrent * 0.1}
          maxCurrent={10000}
          temperature={temperatures.coil}
          isHighlighted={focusedObjectId === coil.id}
          isActive={coil.isActive}
        />
      ))}

      <Projectile
        position={projectilePosition}
        velocity={projectileVelocity}
        radius={params.projectileRadius}
        isRunning={isRunning}
        isHighlighted={focusedObjectId === 'projectile-1'}
        trackLength={params.trackLength}
      />

      <Grid
        position={[0, -0.1, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#4a5568"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#718096"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.5}
        maxDistance={10}
        target={[0, 0, 0]}
      />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export function ThreeScene() {
  return (
    <Canvas
      camera={{ position: [1.5, 1.2, 2], fov: 50 }}
      style={{ background: 'linear-gradient(to bottom, #0a1628, #0f1f38)' }}
      gl={{ antialias: true, alpha: true }}
    >
      <SceneContent />
    </Canvas>
  );
}
