import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

export function AxesHelper() {
  const { scene } = useThree();
  const helperRef = useRef<THREE.AxesHelper | null>(null);

  useEffect(() => {
    const helper = new THREE.AxesHelper(5);
    helper.position.y = 0.01;
    scene.add(helper);
    helperRef.current = helper;

    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current);
      }
    };
  }, [scene]);

  return null;
}
