import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useExperimentStore } from '../../store/useExperimentStore';
import { STATUS_COLOR } from '../../types';

interface BlockProps {
  angle: number;
  position: number;
  status: 'static' | 'sliding' | 'critical';
}

const Block: React.FC<BlockProps> = ({ angle, position, status }) => {
  const { selectedObject, setSelectedObject } = useExperimentStore();
  const isSelected = selectedObject === 'block';

  const blockSize = 0.8;
  const angleRad = (angle * Math.PI) / 180;

  const blockPosition = useMemo(() => {
    const startX = 1.5;
    const x = startX + position;
    const y = 0.1 + blockSize / 2 + x * Math.sin(angleRad);
    return [x, y, 0];
  }, [position, angleRad]);

  const metalTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, '#6b7280');
    gradient.addColorStop(0.3, '#9ca3af');
    gradient.addColorStop(0.6, '#6b7280');
    gradient.addColorStop(1, '#4b5563');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.1})`;
      ctx.fillRect(
        Math.random() * 256,
        Math.random() * 256,
        Math.random() * 5 + 1,
        Math.random() * 5 + 1
      );
    }

    for (let i = 0; i < 20; i++) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`;
      ctx.lineWidth = Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 256, Math.random() * 256);
      ctx.lineTo(Math.random() * 256, Math.random() * 256);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  const handleClick = (e: any) => {
    e.stopPropagation();
    setSelectedObject(isSelected ? null : 'block');
  };

  const statusColor = STATUS_COLOR[status];

  return (
    <group position={blockPosition as [number, number, number]} rotation={[0, 0, angleRad]}>
      <mesh
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
        <boxGeometry args={[blockSize, blockSize, blockSize]} />
        <meshStandardMaterial
          map={metalTexture}
          roughness={0.3}
          metalness={0.8}
          emissive={isSelected ? statusColor : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {isSelected && (
        <mesh>
          <boxGeometry args={[blockSize + 0.1, blockSize + 0.1, blockSize + 0.1]} />
          <meshBasicMaterial color={statusColor} wireframe transparent opacity={0.4} />
        </mesh>
      )}

      {status !== 'static' && (
        <mesh position={[0, blockSize / 2 + 0.2, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.8} />
          <pointLight color={statusColor} intensity={0.5} distance={2} />
        </mesh>
      )}
    </group>
  );
};

export default Block;
