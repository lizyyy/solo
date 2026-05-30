import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Text } from '@react-three/drei';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useExperimentStore } from '../../store/useExperimentStore';
import { calculateBlockPosition } from '../../utils/physics';
import SceneLights from './SceneLights';
import InclinedPlane from './InclinedPlane';
import Block from './Block';
import ForceArrows from './ForceArrows';

export interface Scene3DHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

interface Scene3DProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const AnimationController: React.FC = () => {
  const { threshold, params, forces, isPlaying, setBlockPosition, blockPosition } = useExperimentStore();
  const timeRef = useRef(0);
  const lastTimeRef = useRef(0);

  useFrame((state, delta) => {
    if (threshold.status === 'sliding' && isPlaying) {
      timeRef.current += delta;
      const newPos = calculateBlockPosition(threshold.status, timeRef.current, params, forces);
      setBlockPosition(newPos);
    } else if (threshold.status === 'sliding' && !isPlaying) {
      timeRef.current = 0;
      setBlockPosition(0);
    } else if (threshold.status !== 'sliding') {
      timeRef.current = 0;
      if (blockPosition !== 0) {
        setBlockPosition(0);
      }
    }
  });

  return null;
};

const SceneContent: React.FC = () => {
  const { params, threshold, forces, blockPosition, setSelectedObject } = useExperimentStore();

  return (
    <>
      <SceneLights />

      <group onClick={() => setSelectedObject(null)}>
        <Grid
          position={[0, -3.1, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#334155"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#475569"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      </group>

      <InclinedPlane angle={params.angle} />
      <Block angle={params.angle} position={blockPosition} status={threshold.status} />
      <ForceArrows
        forces={forces}
        angle={params.angle}
        blockPosition={blockPosition}
        status={threshold.status}
      />

      <Text
        position={[2.5, -2.5, 1.6]}
        fontSize={0.2}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        θ = {params.angle}°
      </Text>

      <AnimationController />

      <EffectComposer>
        <FXAA />
        <Bloom
          intensity={0.3}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
};

const Scene3D = forwardRef<Scene3DHandle, Scene3DProps>(({ onCanvasReady }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'CANVAS') {
        const store = useExperimentStore.getState();
        if (store.selectedObject) {
          store.setSelectedObject(null);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="canvas-container w-full h-full">
      <Canvas
        ref={(canvas) => {
          canvasRef.current = canvas;
          if (canvas && onCanvasReady) {
            onCanvasReady(canvas);
          }
        }}
        shadows
        camera={{ position: [6, 4, 8], fov: 50 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0F172A']} />
        <fog attach="fog" args={['#0F172A', 10, 30]} />

        <SceneContent />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2 - 0.1}
          minPolarAngle={0.2}
          target={[2.5, 0, 0]}
        />
      </Canvas>
    </div>
  );
});

Scene3D.displayName = 'Scene3D';

export default Scene3D;
