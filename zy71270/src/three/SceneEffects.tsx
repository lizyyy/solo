import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewStore } from '../store/viewStore';

export default function SceneEffects() {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  const { cameraPosition, cameraTarget } = useViewStore();

  useFrame((_, delta) => {
    targetPos.current.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    targetLookAt.current.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);

    camera.position.lerp(targetPos.current, delta * 2);
    if (camera.lookAt) {
      const currentTarget = new THREE.Vector3();
      camera.getWorldDirection(currentTarget);
      currentTarget.multiplyScalar(10).add(camera.position);
      currentTarget.lerp(targetLookAt.current, delta * 2);
    }
  });

  return null;
}
