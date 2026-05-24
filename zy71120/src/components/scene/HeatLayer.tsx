import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Rack } from '../../types';
import { getHeatColor } from '../../utils/colors';

interface HeatLayerProps {
  racks: Rack[];
  dimensions: { width: number; depth: number };
}

export function HeatLayer({ racks, dimensions }: HeatLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvasRef.current = canvas;
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame((state) => {
    if (!canvasRef.current || !texture) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const time = state.clock.getElapsedTime();
    const pulse = 0.9 + Math.sin(time * 1.5) * 0.1;

    ctx.fillStyle = 'rgba(10, 22, 40, 0.9)';
    ctx.fillRect(0, 0, 512, 512);

    const padding = 30;
    const scaleX = (512 - padding * 2) / (dimensions.width + 10);
    const scaleY = (512 - padding * 2) / (dimensions.depth + 10);
    const offsetX = 256;
    const offsetY = 256;

    racks.forEach((rack) => {
      const screenX = offsetX + rack.position.x * scaleX;
      const screenY = offsetY + rack.position.z * scaleY;
      
      const color = getHeatColor(rack.temperature, 22, 55);
      const radius = 40 + (rack.temperature - 22) * 3;
      const opacity = (rack.temperature - 18) / 40 * pulse;

      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
      gradient.addColorStop(0, hexToRgba(color, Math.min(0.8, opacity)));
      gradient.addColorStop(0.5, hexToRgba(color, Math.min(0.4, opacity * 0.5)));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    texture.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <planeGeometry args={[dimensions.width + 10, dimensions.depth + 10]} />
      <meshBasicMaterial 
        map={texture} 
        transparent 
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^rgb?\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(hex);
  if (result) {
    return `rgba(${result[1]}, ${result[2]}, ${result[3]}, ${alpha})`;
  }
  return `rgba(255, 100, 100, ${alpha})`;
}
