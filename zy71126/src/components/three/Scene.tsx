import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Classroom, Lighting } from './Classroom';
import { Seats } from './Seats';
import { Obstacles } from './Obstacles';
import { LineOfSightLines } from './LineOfSightLines';
import { useLineOfSight } from '@/hooks/useLineOfSight';
import { useAppStore } from '@/store/appStore';
import { ViewMode } from '@/types';

interface CameraControllerProps {
  viewMode: ViewMode;
}

function CameraController({ viewMode }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const positions: Record<ViewMode, THREE.Vector3> = {
      perspective: new THREE.Vector3(15, 12, 15),
      top: new THREE.Vector3(0, 20, 0.01),
      front: new THREE.Vector3(0, 3, 18),
      side: new THREE.Vector3(18, 3, 0),
    };

    const targetPosition = positions[viewMode];
    camera.position.copy(targetPosition);
    
    if (viewMode === 'top') {
      camera.lookAt(0, 0, 0);
    } else {
      camera.lookAt(0, 0, 0);
    }
    
    controlsRef.current?.update();
  }, [viewMode, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2 + 0.1}
    />
  );
}

function SceneContent() {
  const viewMode = useAppStore((state) => state.viewMode);
  useLineOfSight();

  return (
    <>
      <CameraController viewMode={viewMode} />
      <Lighting />
      <Classroom />
      <Obstacles />
      <Seats />
      <LineOfSightLines />
    </>
  );
}

export function ThreeScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [15, 12, 15], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0f172a' }}
    >
      <SceneContent />
    </Canvas>
  );
}
