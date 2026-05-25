import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
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

interface CameraAnimationState {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  progress: number;
  duration: number;
}

export function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  const cameraPreset = useSceneStore(state => state.cameraPreset);
  const clearCameraPreset = useSceneStore(state => state.clearCameraPreset);
  const setCameraPosition = useSceneStore(state => state.setCameraPosition);
  const setCameraRotation = useSceneStore(state => state.setCameraRotation);
  const setCameraTarget = useSceneStore(state => state.setCameraTarget);
  
  const animationRef = useRef<CameraAnimationState | null>(null);

  useEffect(() => {
    if (cameraPreset) {
      const config = PRESET_CONFIGS[cameraPreset];
      if (config) {
        const startPos = camera.position.clone();
        const endPos = new THREE.Vector3(...config.position);
        
        let startTarget = new THREE.Vector3(0, 0, 0);
        if (controlsRef.current && controlsRef.current.target) {
          startTarget = controlsRef.current.target.clone();
        }
        const endTarget = new THREE.Vector3(...config.target);
        
        animationRef.current = {
          startPos,
          endPos,
          startTarget,
          endTarget,
          progress: 0,
          duration: 0.8,
        };
      }
      clearCameraPreset();
    }
  }, [cameraPreset, clearCameraPreset, camera]);

  useFrame((_, delta) => {
    if (animationRef.current) {
      const anim = animationRef.current;
      anim.progress = Math.min(anim.progress + delta / anim.duration, 1);
      
      const t = easeInOutCubic(anim.progress);
      
      const newPos = anim.startPos.clone().lerp(anim.endPos, t);
      const newTarget = anim.startTarget.clone().lerp(anim.endTarget, t);
      
      camera.position.copy(newPos);
      
      if (controlsRef.current && controlsRef.current.target) {
        controlsRef.current.target.copy(newTarget);
      }
      
      camera.lookAt(newTarget);
      
      setCameraPosition([newPos.x, newPos.y, newPos.z]);
      setCameraRotation([camera.rotation.x, camera.rotation.y, camera.rotation.z]);
      setCameraTarget([newTarget.x, newTarget.y, newTarget.z]);
      
      if (anim.progress >= 1) {
        animationRef.current = null;
      }
    }
  });

  const handleControlChange = () => {
    setCameraPosition([camera.position.x, camera.position.y, camera.position.z]);
    setCameraRotation([camera.rotation.x, camera.rotation.y, camera.rotation.z]);
    
    if (controlsRef.current && controlsRef.current.target) {
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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
