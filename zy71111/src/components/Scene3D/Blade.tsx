
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Blade() {
  const meshRef = useRef<THREE.Mesh>(null);

  const bladeShape = new THREE.Shape();
  const width = 0.8;
  const height = 6;

  bladeShape.moveTo(0, -height / 2);
  bladeShape.quadraticCurveTo(width, -height / 4, width * 0.6, 0);
  bladeShape.quadraticCurveTo(width * 0.3, height / 3, 0, height / 2);
  bladeShape.quadraticCurveTo(-width * 0.3, height / 3, -width * 0.6, 0);
  bladeShape.quadraticCurveTo(-width, -height / 4, 0, -height / 2);

  const extrudeSettings = {
    steps: 30,
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 5,
  };

  const geometry = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
  geometry.center();
  geometry.rotateX(Math.PI / 2);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.02;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#64748b"
        metalness={0.6}
        roughness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
