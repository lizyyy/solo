import { useRef, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraState } from '../types';
import { cameraStateToSpherical, sphericalToCameraState, EARTH_RADIUS } from '../utils/coordinate';

interface UseGlobeControlsOptions {
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

export function useGlobeControls(options: UseGlobeControlsOptions = {}) {
  const { autoRotate = false, autoRotateSpeed = 0.3 } = options;
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const targetPosition = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const isAnimating = useRef(false);

  const getCurrentCameraState = useCallback((): CameraState => {
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(camera.position);
    return sphericalToCameraState(spherical);
  }, [camera.position]);

  const flyTo = useCallback((cameraState: CameraState, duration: number = 1500) => {
    const targetSpherical = cameraStateToSpherical(cameraState);
    const targetPos = new THREE.Vector3().setFromSpherical(targetSpherical);
    const lookAt = new THREE.Vector3(0, 0, 0);

    targetPosition.current = targetPos;
    targetLookAt.current = lookAt;
    isAnimating.current = true;

    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }

    setTimeout(() => {
      isAnimating.current = false;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }, duration);
  }, []);

  const resetView = useCallback(() => {
    const defaultState: CameraState = {
      lat: 30,
      lng: 105,
      altitude: 4,
    };
    flyTo(defaultState, 1000);
  }, [flyTo]);

  useFrame((state, delta) => {
    if (autoRotate && controlsRef.current && !isAnimating.current) {
      controlsRef.current?.update();
    }

    if (isAnimating.current && targetPosition.current && targetLookAt.current && controlsRef.current) {
      const progress = Math.min(delta * 2, 1);
      camera.position.lerp(targetPosition.current, progress);
      controlsRef.current.target.lerp(targetLookAt.current, progress);
      camera.lookAt(controlsRef.current.target);
    }
  });

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = autoRotateSpeed;
    }
  }, [autoRotate, autoRotateSpeed]);

  return {
    controlsRef,
    camera,
    gl,
    flyTo,
    resetView,
    getCurrentCameraState,
  };
}
