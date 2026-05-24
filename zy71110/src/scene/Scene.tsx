import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { Field } from './Field';
import { Sprinkler } from './Sprinkler';
import { CoverageHeatmap } from './CoverageHeatmap';
import { MissedZones } from './MissedZones';
import { WindIndicator } from './WindIndicator';

interface SceneControllerProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

function SceneController({ onCanvasReady }: SceneControllerProps) {
  const { gl } = useThree();
  const viewMode = useStore((state) => state.viewMode);
  const field = useStore((state) => state.field);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    onCanvasReady(gl.domElement);
  }, [gl, onCanvasReady]);

  useEffect(() => {
    if (!controlsRef.current) return;

    const center = new THREE.Vector3(0, 0, 0);
    const distance = Math.max(field.width, field.height) * 1.2;

    let position: [number, number, number];

    switch (viewMode) {
      case 'top':
        position = [0, distance, 0.01];
        break;
      case 'front':
        position = [0, distance * 0.5, distance * 0.8];
        break;
      case 'side':
        position = [distance * 0.8, distance * 0.5, 0];
        break;
      default:
        position = [distance * 0.7, distance * 0.7, distance * 0.7];
    }

    controlsRef.current.object.position.set(...position);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, [viewMode, field.width, field.height]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={100}
      maxPolarAngle={Math.PI / 2 - 0.1}
    />
  );
}

interface SceneProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export function Scene({ onCanvasReady }: SceneProps) {
  const sprinklers = useStore((state) => state.sprinklers);
  const selectedSprinkler = useStore((state) => state.selectedSprinkler);
  const calculateCoverage = useStore((state) => state.calculateCoverage);

  useEffect(() => {
    calculateCoverage();
  }, []);

  return (
    <Canvas
      shadows
      camera={{ position: [30, 30, 30], fov: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => useStore.getState().setSelectedSprinkler(null)}
    >
      <color attach="background" args={['#87ceeb']} />
      <fog attach="fog" args={['#87ceeb', 50, 150]} />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[30, 50, 30]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <SceneController onCanvasReady={onCanvasReady} />

      <Field />
      <CoverageHeatmap />
      <MissedZones />
      <WindIndicator />

      {sprinklers.map((sprinkler) => (
        <Sprinkler
          key={sprinkler.id}
          sprinkler={sprinkler}
          isSelected={selectedSprinkler === sprinkler.id}
        />
      ))}
    </Canvas>
  );
}
