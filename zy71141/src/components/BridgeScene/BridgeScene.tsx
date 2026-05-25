import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BridgeModel } from './BridgeModel';
import { CrackPoints } from './CrackPoints';
import { PhotoPoints } from './PhotoPoints';
import { CameraView } from '../../types';
import { useInspectionStore } from '../../store/inspectionStore';

interface SceneControllerProps {
  cameraView: CameraView;
}

const SceneController: React.FC<SceneControllerProps> = ({ cameraView }) => {
  const { camera } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    camera.position.set(
      cameraView.position.x,
      cameraView.position.y,
      cameraView.position.z
    );
    if (controlsRef.current) {
      controlsRef.current.target.set(
        cameraView.target.x,
        cameraView.target.y,
        cameraView.target.z
      );
      controlsRef.current.update();
    }
  }, [camera, cameraView]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2}
    />
  );
};

interface BridgeSceneProps {
  onSceneReady?: (gl: THREE.WebGLRenderer) => void;
}

export const BridgeScene: React.FC<BridgeSceneProps> = ({ onSceneReady }) => {
  const {
    cameraView,
    selectedCrackId,
    setSelectedCrackId,
    updateCrackPosition,
    getCracksWithBatchStatus,
    getPhotosForCurrentBatch,
  } = useInspectionStore();

  const filteredCracks = getCracksWithBatchStatus().filter((crack) => {
    const { filters } = useInspectionStore.getState();
    if (filters.status.length > 0 && !filters.status.includes(crack.status)) {
      return false;
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!crack.description.toLowerCase().includes(query) && 
          !crack.id.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const currentPhotos = getPhotosForCurrentBatch();
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    glRef.current = gl;
    if (onSceneReady) {
      onSceneReady(gl);
    }
  };

  const handleCrackSelect = (crackId: string | null) => {
    setSelectedCrackId(crackId);
  };

  const handlePositionChange = (crackId: string, position: { x: number; y: number; z: number }) => {
    updateCrackPosition(crackId, position);
  };

  const handleCanvasClick = () => {
    setSelectedCrackId(null);
  };

  return (
    <Canvas
      shadows
      camera={{ position: [10, 8, 10], fov: 50 }}
      onCreated={handleCreated}
      onClick={handleCanvasClick}
      style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}
    >
      <fog attach="fog" args={['#0F172A', 15, 40]} />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-8, 5, -8]} intensity={0.5} color="#60A5FA" />
      <pointLight position={[8, 5, 8]} intensity={0.3} color="#34D399" />

      <SceneController cameraView={cameraView} />
      <BridgeModel />
      <CrackPoints
        cracks={filteredCracks}
        selectedCrackId={selectedCrackId}
        onCrackSelect={handleCrackSelect}
        onPositionChange={handlePositionChange}
      />
      <PhotoPoints photos={currentPhotos} />
    </Canvas>
  );
};
