import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Blade3D } from './Blade3D';
import { CrackMarker } from './CrackMarker';
import { useAppStore, useFilteredRecords, useSelectedRecord } from '../../store/useAppStore';
import type { Position3D } from '../../types';

interface CameraControllerProps {
  targetPosition: Position3D;
}

const CameraController = ({ targetPosition }: CameraControllerProps) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { setCameraState, cameraState } = useAppStore();

  useEffect(() => {
    if (targetPosition) {
      const startPos = camera.position.clone();
      const targetPos = new THREE.Vector3(
        targetPosition.x + 3,
        targetPosition.y + 1,
        targetPosition.z + 3
      );

      const duration = 500;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPos, targetPos, eased);
        controlsRef.current?.target.lerp(
          new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
          eased
        );

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }, [targetPosition, camera]);

  const handleControlsChange = () => {
    if (controlsRef.current) {
      setCameraState({
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        },
        target: {
          x: controlsRef.current.target.x,
          y: controlsRef.current.target.y,
          z: controlsRef.current.target.z
        },
        fov: 50
      });
    }
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={3}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2 + 0.2}
      target={[cameraState.target.x, cameraState.target.y, cameraState.target.z]}
      onEnd={handleControlsChange}
    />
  );
};

const SceneContent = () => {
  const records = useFilteredRecords();
  const selectedRecord = useSelectedRecord();
  const { setSelectedRecord, cameraState } = useAppStore();

  const handleSelect = (id: string) => {
    setSelectedRecord(id);
  };

  const handleDoubleClick = (id: string) => {
    setSelectedRecord(id);
  };

  return (
    <>
      <CameraController targetPosition={selectedRecord?.position3D || cameraState.target} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#60a5fa" />

      <Blade3D />

      {records.map(record => (
        <CrackMarker
          key={record.id}
          record={record}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
        />
      ))}

      <ContactShadows
        position={[0, -0.1, 0]}
        opacity={0.4}
        scale={20}
        blur={2}
        far={4}
      />

      <Grid
        position={[0, -0.1, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
    </>
  );
};

export const Scene = () => {
  const { cameraState } = useAppStore();

  return (
    <Canvas
      camera={{
        position: [cameraState.position.x, cameraState.position.y, cameraState.position.z],
        fov: cameraState.fov,
        near: 0.1,
        far: 100
      }}
      shadows
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}
    >
      <SceneContent />
    </Canvas>
  );
};
