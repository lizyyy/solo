import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useExperimentStore } from '../../store/useExperimentStore';

interface InclinedPlaneProps {
  angle: number;
}

const InclinedPlane: React.FC<InclinedPlaneProps> = ({ angle }) => {
  const { selectedObject, setSelectedObject } = useExperimentStore();
  const isSelected = selectedObject === 'plane';

  const planeLength = 6;
  const planeWidth = 3;
  const planeThickness = 0.2;

  const woodTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#8B4513');
    gradient.addColorStop(0.3, '#A0522D');
    gradient.addColorStop(0.6, '#8B4513');
    gradient.addColorStop(1, '#654321');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${Math.random() * 0.15})`;
      ctx.lineWidth = Math.random() * 2 + 0.5;
      ctx.beginPath();
      const y = Math.random() * 512;
      ctx.moveTo(0, y);
      for (let x = 0; x < 512; x += 10) {
        ctx.lineTo(x, y + Math.sin(x * 0.02) * 3);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * 512,
        Math.random() * 512,
        Math.random() * 3 + 1,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    return texture;
  }, []);

  const angleRad = (angle * Math.PI) / 180;

  const handleClick = (e: any) => {
    e.stopPropagation();
    setSelectedObject(isSelected ? null : 'plane');
  };

  return (
    <group rotation={[0, 0, angleRad]} position={[0, 0, 0]}>
      <mesh
        position={[planeLength / 2 - 0.5, -planeThickness / 2, 0]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[planeLength, planeThickness, planeWidth]} />
        <meshStandardMaterial
          map={woodTexture}
          roughness={0.8}
          metalness={0.1}
          emissive={isSelected ? '#f97316' : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>

      {isSelected && (
        <mesh position={[planeLength / 2 - 0.5, -planeThickness / 2, 0]}>
          <boxGeometry args={[planeLength + 0.1, planeThickness + 0.1, planeWidth + 0.1]} />
          <meshBasicMaterial color="#f97316" wireframe transparent opacity={0.3} />
        </mesh>
      )}

      <mesh position={[0, -1.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 3, planeWidth]} />
        <meshStandardMaterial color="#4a3728" roughness={0.9} />
      </mesh>

      <mesh position={[planeLength - 1, -1.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 3, planeWidth]} />
        <meshStandardMaterial color="#4a3728" roughness={0.9} />
      </mesh>

      <mesh position={[planeLength / 2 - 0.5, -3.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[planeLength + 0.5, 0.2, planeWidth + 0.5]} />
        <meshStandardMaterial color="#334155" roughness={0.8} metalness={0.2} />
      </mesh>
    </group>
  );
};

export default InclinedPlane;
