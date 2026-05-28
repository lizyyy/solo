import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ChipPackageMesh } from './ChipPackageMesh';
import { HeatSinkMesh } from './HeatSinkMesh';
import { AirFlowArrows } from './AirFlowArrows';
import { TempSensorMarker } from './TempSensorMarker';
import { SectionPlane } from './SectionPlane';
import { useView3DStore } from '@/store/useView3DStore';
import { useAnomalyStore } from '@/store/useAnomalyStore';

const CameraController = () => {
  const { camera } = useThree();
  const { cameraPosition, targetPosition, setCameraPosition } = useView3DStore();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    if (controlsRef.current) {
      controlsRef.current.target.set(targetPosition.x, targetPosition.y, targetPosition.z);
      controlsRef.current.update();
    }
  }, [cameraPosition, targetPosition, camera]);

  const handleChange = () => {
    if (controlsRef.current) {
      setCameraPosition(
        { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        { x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z }
      );
    }
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={15}
      onChange={handleChange}
    />
  );
};

const LightingSetup = () => {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 3, -5]} intensity={0.5} />
      <directionalLight position={[0, 5, -5]} intensity={0.3} />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#ff6b35" />
    </>
  );
};

const SceneContent = () => {
  return (
    <>
      <ChipPackageMesh />
      <HeatSinkMesh />
      <AirFlowArrows />
      <TempSensorMarker />
      <SectionPlane />
      
      <Grid
        position={[0, -0.5, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#374151"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#4b5563"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
    </>
  );
};

export const Scene3D = () => {
  const runDetection = useAnomalyStore((state) => state.runDetection);

  useEffect(() => {
    const timer = setTimeout(() => {
      runDetection();
    }, 500);
    return () => clearTimeout(timer);
  }, [runDetection]);

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
    >
      <PerspectiveCamera makeDefault position={[6, 6, 6]} fov={50} />
      <CameraController />
      <LightingSetup />
      <fog attach="fog" args={['#0f172a', 10, 25]} />
      
      <SceneContent />
      
      <Environment preset="city" />
      <EffectComposer>
        <Bloom 
          luminanceThreshold={0.2} 
          luminanceSmoothing={0.9} 
          intensity={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
};
