import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WaterProps {
  tideLevel: number;
}

export function Water({ tideLevel }: WaterProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 200, 50, 50);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setY(i, Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.1);
    }
    return geo;
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      const targetY = (tideLevel - 9) * 0.1 - 0.5;
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        targetY,
        0.02
      );
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.7 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
      receiveShadow
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        ref={materialRef}
        color="#0ea5e9"
        transparent
        opacity={0.75}
        metalness={0.3}
        roughness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
