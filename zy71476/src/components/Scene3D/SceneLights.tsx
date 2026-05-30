import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SceneLights: React.FC = () => {
  const rectLightRef = useRef<THREE.RectAreaLight>(null);

  useFrame(() => {
    if (rectLightRef.current) {
      rectLightRef.current.lookAt(new THREE.Vector3(0, 0, 0));
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} color="#cbd5e1" />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-10, 10, 10, -10, 0.1, 50]}
        />
      </directionalLight>
      <directionalLight
        position={[-5, 3, -5]}
        intensity={0.3}
        color="#94a3b8"
      />
      <pointLight
        position={[0, 5, 0]}
        intensity={0.5}
        color="#f97316"
        distance={15}
      />
      <rectAreaLight
        ref={rectLightRef}
        position={[0, 6, -6]}
        width={8}
        height={6}
        intensity={1}
        color="#f1f5f9"
      />
    </>
  );
};

export default SceneLights;
