import { useRef, useState } from 'react';
import { Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Barrier as BarrierType } from '@/types';
import { useSceneStore } from '@/store/sceneStore';

interface BarrierProps {
  data: BarrierType;
  onClick?: () => void;
}

export function Barrier({ data, onClick }: BarrierProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectedElement = useSceneStore(state => state.selectedElement);
  const isSelected = selectedElement === data.id;

  useFrame(({ clock }) => {
    if (meshRef.current && data.isTemporary) {
      const elapsed = clock.getElapsedTime();
      meshRef.current.position.y = data.height / 2 + Math.sin(elapsed * 2) * 0.05;
    }
  });

  const rotation = data.rotation || [0, 0, 0];
  const depth = 0.3;

  return (
    <group
      position={[data.position[0], data.height / 2, data.position[2]]}
      rotation={rotation as [number, number, number]}
    >
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <boxGeometry args={[data.width, data.height, depth]} />
        <meshStandardMaterial
          color={isSelected ? '#ff9800' : (data.isTemporary ? '#ff5722' : '#795548')}
          emissive={hovered || isSelected ? (data.isTemporary ? '#ff5722' : '#795548') : '#000'}
          emissiveIntensity={hovered || isSelected ? 0.3 : 0}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {data.isTemporary && (
        <>
          <mesh position={[0, 0, depth / 2 + 0.01]}>
            <planeGeometry args={[data.width, data.height]} />
            <meshStandardMaterial
              color="#ffeb3b"
              transparent
              opacity={0.3}
            />
          </mesh>
          
          {Array.from({ length: Math.floor(data.width / 1.5) }).map((_, i) => (
            <Text
              key={i}
              position={[-data.width / 2 + 0.75 + i * 1.5, 0, depth / 2 + 0.02]}
              fontSize={0.4}
              color="#f44336"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              ⚠
            </Text>
          ))}
        </>
      )}

      <mesh position={[0, -data.height / 2 - 0.05, 0]}>
        <boxGeometry args={[data.width + 0.2, 0.1, depth + 0.2]} />
        <meshStandardMaterial
          color={data.isTemporary ? '#ff5722' : '#5d4037'}
        />
      </mesh>
    </group>
  );
}
