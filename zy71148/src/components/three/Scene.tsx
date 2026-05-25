import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { IceSurface } from './IceSurface';
import { GridPoints } from './GridPoints';
import { TemperatureProbes } from './TemperatureProbes';
import { RepairAreas } from './RepairAreas';
import { useAppStore } from '../../store';
import { viewPresets } from '../../constants/viewPresets';

const CameraController = () => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const selectedViewPreset = useAppStore((state) => state.selectedViewPreset);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  useEffect(() => {
    if (selectedViewPreset && controlsRef.current) {
      const preset = viewPresets.find((p) => p.id === selectedViewPreset);
      if (preset) {
        camera.position.set(...preset.position);
        controlsRef.current.target.set(...preset.target);
        useAppStore.getState().setSelectedViewPreset(null);
      }
    }
  }, [selectedViewPreset, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={150}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
};

const Lights = () => {
  return (
    <>
      <ambientLight intensity={0.4} color="#a5f3fc" />
      <directionalLight
        position={[50, 80, 50]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-30, 40, -30]} intensity={0.4} color="#7dd3fc" />
      <pointLight position={[30, 20, 15]} intensity={0.5} color="#ffffff" />
    </>
  );
};

const SceneContent = () => {
  const data = useAppStore((state) => state.data);

  if (!data) {
    return (
      <mesh position={[30, 0, 15]}>
        <boxGeometry args={[60, 0.5, 30]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
    );
  }

  return (
    <group position={[0, 0, 0]}>
      <IceSurface />
      <GridPoints />
      <TemperatureProbes />
      <RepairAreas />
    </group>
  );
};

export const Scene = () => {
  return (
    <Canvas shadows dpr={[1, 2]}>
      <PerspectiveCamera makeDefault position={[80, 50, 60]} fov={50} />
      <CameraController />
      <Lights />
      <fog attach="fog" args={['#0f172a', 80, 200]} />
      <color attach="background" args={['#0f172a']} />
      <SceneContent />
    </Canvas>
  );
};
