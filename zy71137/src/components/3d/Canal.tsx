import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Canal as CanalType } from '@/types';
import { COLORS } from '@/data/constants';
import * as THREE from 'three';

interface CanalProps {
  data: CanalType;
}

export function Canal({ data }: CanalProps) {
  const { position, size } = data;
  const [width, depth] = size;
  const waterRef = useRef<THREE.Mesh>(null);

  const waterTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, COLORS.canal);
      gradient.addColorStop(0.5, COLORS.canalDeep);
      gradient.addColorStop(1, COLORS.canal);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 25 + 10);
        ctx.quadraticCurveTo(128, i * 25 + 20, 256, i * 25 + 10);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      const material = waterRef.current.material as THREE.MeshBasicMaterial;
      if (material.map) {
        material.map.offset.y = clock.getElapsedTime() * 0.1;
      }
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[width + 1, 0.8, depth + 1]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>

      <mesh
        ref={waterRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial
          map={waterTexture}
          transparent
          opacity={0.85}
        />
      </mesh>

      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[width + 0.2, 0.1, depth + 0.2]} />
        <meshBasicMaterial
          color={COLORS.canalDeep}
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}