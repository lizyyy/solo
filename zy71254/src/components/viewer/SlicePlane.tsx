import { useRef, useMemo, useEffect, useState } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Slice, Annotation } from '@/types';

interface SlicePlaneProps {
  slice: Slice;
  position: [number, number, number];
  isSelected: boolean;
  annotations: Annotation[];
  windowWidth: number;
  windowCenter: number;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

export const SlicePlane = ({
  slice,
  position,
  isSelected,
  annotations,
  windowWidth,
  windowCenter,
  onClick,
  onPointerOver,
  onPointerOut,
}: SlicePlaneProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [adjustedTexture, setAdjustedTexture] = useState<THREE.Texture | null>(null);

  const baseTexture = useTexture(slice.imageData);

  useEffect(() => {
    if (!baseTexture) return;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, 256, 256);
      const data = imageData.data;
      const minWindow = windowCenter - windowWidth / 2;
      const maxWindow = windowCenter + windowWidth / 2;

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        let adjusted = ((gray - minWindow) / windowWidth) * 255;
        adjusted = Math.max(0, Math.min(255, adjusted));
        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
      }

      ctx.putImageData(imageData, 0, 0);

      sliceAnnotations.forEach((annotation) => {
        const x = annotation.x * 256;
        const y = annotation.y * 256;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = annotation.type === 'lesion' ? '#ff4444' : annotation.type === 'artifact' ? '#ffaa00' : '#00aaff';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (annotation.hasDrift) {
          ctx.strokeStyle = '#ffff00';
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      const newTexture = new THREE.CanvasTexture(canvas);
      newTexture.needsUpdate = true;
      setAdjustedTexture(newTexture);
    };
    img.src = slice.imageData;
  }, [slice.imageData, windowWidth, windowCenter, annotations]);

  const sliceAnnotations = useMemo(
    () => annotations.filter((a) => a.sliceId === slice.id),
    [annotations, slice.id]
  );

  const borderColor = useMemo(() => {
    if (slice.hasError) return '#ff6b6b';
    if (isSelected) return '#06b6d4';
    if (slice.isHighlighted) return '#fbbf24';
    return '#334155';
  }, [slice.hasError, slice.isHighlighted, isSelected]);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onPointerOver();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onPointerOut();
          document.body.style.cursor = 'auto';
        }}
      >
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          map={adjustedTexture || baseTexture}
          transparent
          opacity={slice.isVisible ? (isSelected ? 1 : 0.85) : 0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[2.05, 2.05]} />
        <meshBasicMaterial
          color={borderColor}
          transparent
          opacity={slice.hasError || isSelected ? 0.8 : 0.2}
          side={THREE.BackSide}
        />
      </mesh>

      {slice.hasError && (
        <mesh position={[0.9, 0.9, 0.01]}>
          <ringGeometry args={[0.05, 0.08, 16]} />
          <meshBasicMaterial color="#ff6b6b" side={THREE.DoubleSide} />
        </mesh>
      )}

      {sliceAnnotations.length > 0 && (
        <mesh position={[-0.9, 0.9, 0.01]}>
          <ringGeometry args={[0.05, 0.08, 16]} />
          <meshBasicMaterial color="#06b6d4" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
