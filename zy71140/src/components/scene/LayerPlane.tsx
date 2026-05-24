import { useRef, useState } from 'react';
import type { Group } from 'three';
import { useFrame } from '@react-three/fiber';
import type { Layer } from '../../types';

interface LayerPlaneProps {
  layer: Layer;
  y: number;
  width: number;
  depth: number;
  isVisible: boolean;
}

export function LayerPlane({ layer, y, width, depth, isVisible }: LayerPlaneProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (groupRef.current && isVisible) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.02 + 0.08;
      groupRef.current.scale.setScalar(1 + pulse * 0.01);
    }
  });

  if (!isVisible) return null;

  return (
    <group ref={groupRef} position={[0, y, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.1, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[width - 1, depth - 1]} />
        <meshStandardMaterial
          color={layer.color}
          transparent
          opacity={hovered ? 0.25 : 0.12}
          side={2}
          emissive={layer.color}
          emissiveIntensity={hovered ? 0.3 : 0.1}
        />
      </mesh>

      <mesh position={[0, 0.15, -depth / 2 + 0.5]}>
        <boxGeometry args={[4, 0.6, 0.1]} />
        <meshStandardMaterial color={layer.color} emissive={layer.color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}
