import { useMemo, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useNetworkStore } from '@/store/useNetworkStore';
import { PipeRenderer } from './PipeRenderer';
import { ValveRenderer } from './ValveRenderer';
import { NodeRenderer } from './NodeRenderer';
import { ZoneRenderer } from './ZoneRenderer';
import { RepairPointRenderer } from './RepairPoint';

interface CameraControllerProps {
  viewMode: '3d' | '2d-top' | '2d-front';
}

function CameraController({ viewMode }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    switch (viewMode) {
      case '2d-top':
        camera.position.set(0, 50, 0.1);
        camera.lookAt(0, 0, 0);
        if (controlsRef.current) {
          controlsRef.current.maxPolarAngle = 0.1;
          controlsRef.current.minPolarAngle = 0.1;
        }
        break;
      case '2d-front':
        camera.position.set(0, 10, 50);
        camera.lookAt(0, 0, 0);
        if (controlsRef.current) {
          controlsRef.current.maxPolarAngle = Math.PI / 2;
          controlsRef.current.minPolarAngle = Math.PI / 2;
        }
        break;
      default:
        camera.position.set(30, 25, 30);
        camera.lookAt(0, 0, 0);
        if (controlsRef.current) {
          controlsRef.current.maxPolarAngle = Math.PI;
          controlsRef.current.minPolarAngle = 0;
        }
    }
  }, [viewMode, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={100}
    />
  );
}

function SceneContent() {
  const { network, impactAnalysis } = useNetworkStore();

  const isolatedPipeIds = useMemo(() => {
    return new Set(impactAnalysis.isolatedPipes);
  }, [impactAnalysis.isolatedPipes]);

  const isolatedNodeIds = useMemo(() => {
    return new Set(impactAnalysis.isolatedNodes);
  }, [impactAnalysis.isolatedNodes]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1}
        castShadow
      />
      <pointLight position={[-20, 20, -20]} intensity={0.5} color="#00D4FF" />

      <Grid
        args={[100, 100]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#1a2a3a"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#2a4a6a"
        fadeDistance={80}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <PipeRenderer network={network} isolatedPipeIds={isolatedPipeIds} />
      <NodeRenderer network={network} isolatedNodeIds={isolatedNodeIds} />
      <ValveRenderer network={network} />
      <ZoneRenderer network={network} affectedZoneIds={impactAnalysis.affectedZoneIds} />
      <RepairPointRenderer network={network} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          height={300}
          intensity={1.5}
        />
        <Vignette darkness={0.5} offset={0.3} />
      </EffectComposer>
    </>
  );
}

export function NetworkCanvas() {
  const { viewMode } = useNetworkStore();

  return (
    <Canvas
      camera={{ position: [30, 25, 30], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'linear-gradient(180deg, #0A1628 0%, #0D1F35 50%, #0A1628 100%)' }}
    >
      <CameraController viewMode={viewMode} />
      <SceneContent />
    </Canvas>
  );
}
