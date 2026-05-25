import { useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Construction as ConstructionType } from '../../types';
import * as THREE from 'three';

interface ConstructionProps {
  construction: ConstructionType;
  onClick?: (construction: ConstructionType) => void;
  visible: boolean;
}

export const ConstructionModel = ({ construction, onClick, visible }: ConstructionProps) => {
  const meshRef = useRef<THREE.Group>(null);
  const warningStripes = useRef<THREE.Texture>(null);

  if (!visible || !construction.isActive) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.(construction);
  };

  if (!warningStripes.current) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FF7D00';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#1D2129';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 16 - 8, 0);
      ctx.lineTo(i * 16 + 8, 0);
      ctx.lineTo(i * 16 + 24, 64);
      ctx.lineTo(i * 16 + 8, 64);
      ctx.closePath();
      ctx.fill();
    }
    warningStripes.current = new THREE.CanvasTexture(canvas);
    warningStripes.current.wrapS = THREE.RepeatWrapping;
    warningStripes.current.wrapT = THREE.RepeatWrapping;
  }

  return (
    <group
      ref={meshRef}
      position={[construction.position.x, construction.position.y, construction.position.z]}
      onClick={handleClick}
    >
      <mesh position={[0, construction.size.y / 2, 0]}>
        <boxGeometry args={[construction.size.x, construction.size.y, construction.size.z]} />
        <meshStandardMaterial
          map={warningStripes.current}
          transparent
          opacity={0.7}
        />
      </mesh>

      {[-1, 1].map((sideX) =>
        [-1, 1].map((sideZ) => (
          <mesh
            key={`pole-${sideX}-${sideZ}`}
            position={[
              (sideX * construction.size.x) / 2,
              construction.size.y / 2,
              (sideZ * construction.size.z) / 2,
            ]}
          >
            <cylinderGeometry args={[0.1, 0.15, construction.size.y + 1, 8]} />
            <meshStandardMaterial color="#FF7D00" />
          </mesh>
        ))
      )}

      <mesh position={[0, construction.size.y + 0.5, 0]}>
        <boxGeometry args={[construction.size.x + 1, 0.8, 0.2]} />
        <meshStandardMaterial color="#F53F3F" emissive="#F53F3F" emissiveIntensity={0.3} />
      </mesh>

      <mesh position={[0, construction.size.y + 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.5, 1.5, 4]} />
        <meshStandardMaterial color="#FF7D00" emissive="#FF7D00" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};
