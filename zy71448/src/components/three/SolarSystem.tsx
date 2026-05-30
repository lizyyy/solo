import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useSimulationStore } from '../../store/useSimulationStore';
import Starfield from './Starfield';
import Sun from './Sun';
import Spacecraft from './Spacecraft';
import TrajectoryLine from './TrajectoryLine';
import * as THREE from 'three';

function SimulationUpdater() {
  const { updateSimulation } = useSimulationStore();
  
  useFrame((_, delta) => {
    updateSimulation(delta);
  });
  
  return null;
}

function CameraController() {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  return null;
}

function GridHelper() {
  const gridRef = useRef<THREE.GridHelper>(null);
  
  return (
    <gridHelper
      ref={gridRef}
      args={[50, 50, 0x334155, 0x1e293b]}
      position={[0, -5, 0]}
    />
  );
}

export default function SolarSystem() {
  return (
    <Canvas
      camera={{ position: [0, 8, 15], fov: 60 }}
      style={{ background: 'linear-gradient(to bottom, #0a1628, #000510)' }}
      gl={{ antialias: true, alpha: true }}
    >
      <CameraController />
      <SimulationUpdater />
      
      <ambientLight intensity={0.1} />
      <Starfield />
      <GridHelper />
      <Sun />
      <Spacecraft />
      <TrajectoryLine />
      
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
      />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} />
      </EffectComposer>
    </Canvas>
  );
}
