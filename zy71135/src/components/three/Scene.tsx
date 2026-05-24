import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { ShipHull } from './ShipHull';
import { Bay3D } from './Bay3D';
import { Cargo3D } from './Cargo3D';
import { GravityIndicator } from './GravityIndicator';
import { useStore } from '../../store/useStore';
import { BAY_SCALE } from '../../types';

const cameraPositions = {
  overview: { x: BAY_SCALE * 6, y: BAY_SCALE * 6, z: BAY_SCALE * 6 },
  bow: { x: BAY_SCALE * 8, y: BAY_SCALE * 3, z: 0 },
  stern: { x: -BAY_SCALE * 8, y: BAY_SCALE * 3, z: 0 },
  side: { x: 0, y: BAY_SCALE * 4, z: BAY_SCALE * 8 },
};

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const cameraView = useStore((state) => state.cameraView);

  useEffect(() => {
    const targetPosition = cameraPositions[cameraView];
    if (targetPosition) {
      camera.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, BAY_SCALE, 0);
        controlsRef.current.update();
      }
    }
  }, [cameraView, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, BAY_SCALE, 0]}
      minDistance={BAY_SCALE * 3}
      maxDistance={BAY_SCALE * 15}
      enablePan={true}
      enableDamping
      dampingFactor={0.05}
    />
  );
}

function SceneContent() {
  const bays = useStore((state) => state.bays);
  const cargoList = useStore((state) => state.cargoList);

  const loadedCargos = bays
    .filter((bay) => bay.occupiedBy)
    .map((bay) => {
      const cargo = cargoList.find((c) => c.id === bay.occupiedBy);
      return { cargo, bayId: bay.id };
    })
    .filter((item) => item.cargo);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#3E92CC" />

      <CameraController />

      <Grid
        position={[0, -0.1, 0]}
        args={[BAY_SCALE * 20, BAY_SCALE * 20]}
        cellSize={BAY_SCALE}
        cellThickness={0.5}
        cellColor="#1a365d"
        sectionSize={BAY_SCALE * 2}
        sectionThickness={1}
        sectionColor="#3E92CC"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
      />

      <ShipHull />

      {bays.map((bay) => (
        <Bay3D key={bay.id} bay={bay} />
      ))}

      {loadedCargos.map(
        ({ cargo, bayId }) =>
          cargo && <Cargo3D key={`${bayId}-${cargo.id}`} cargo={cargo} bayId={bayId} />
      )}

      <GravityIndicator />

      <axesHelper args={[BAY_SCALE * 2]} position={[-BAY_SCALE * 4, 0.1, -BAY_SCALE * 4]} />
    </>
  );
}

export function ThreeScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [BAY_SCALE * 6, BAY_SCALE * 6, BAY_SCALE * 6], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0a1929');
      }}
    >
      <fog attach="fog" args={['#0a1929', 20, 60]} />
      <SceneContent />
    </Canvas>
  );
}
