import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore, CameraPreset } from '@/store/sceneStore';

const PRESET_CONFIGS: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  top: {
    position: [0, 40, 0.01],
    target: [0, 0, 0],
  },
  front: {
    position: [0, 5, 35],
    target: [0, 0, 0],
  },
  default: {
    position: [0, 15, 20],
    target: [0, 0, 0],
  },
};

export function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  const cameraPreset = useSceneStore(state => state.cameraPreset);
  const clearCameraPreset = useSceneStore(state => state.clearCameraPreset);
  const setCameraPosition = useSceneStore(state => state.setCameraPosition);
  const setCameraRotation = useSceneStore(state => state.setCameraRotation);
  const setCameraTarget = useSceneStore(state => state.setCameraTarget);

  useEffect(() => {
    if (cameraPreset && controlsRef.current) {
      const config = PRESET_CONFIGS[cameraPreset];
      if (config) {
        controlsRef.current.setLookAt(
          config.position[0], config.position[1], config.position[2],
          config.target[0], config.target[1], config.target[2],
          true
        );
      }
      clearCameraPreset();
    }
  }, [cameraPreset, clearCameraPreset]);

  const handleControlChange = () => {
    setCameraPosition([camera.position.x, camera.position.y, camera.position.z]);
    setCameraRotation([camera.rotation.x, camera.rotation.y, camera.rotation.z]);
    
    if (controlsRef.current) {
      const target = controlsRef.current.target;
      setCameraTarget([target.x, target.y, target.z]);
    }
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.1}
      target={[0, 0, 0]}
      onChange={handleControlChange}
      enableDamping
      dampingFactor={0.05}
    />
  );
}
