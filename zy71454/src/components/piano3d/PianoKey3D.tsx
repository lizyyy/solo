import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PianoKeyData } from '../../types';
import { getHeatmapColor } from '../../data/mockData';

interface PianoKey3DProps {
  keyData: PianoKeyData;
  position: [number, number, number];
  isSelected: boolean;
  viewMode: 'heatmap' | 'normal' | 'rebound';
  onClick: () => void;
  isFiltered: boolean;
}

export default function PianoKey3D({ keyData, position, isSelected, viewMode, onClick, isFiltered }: PianoKey3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      const targetY = position[1] + (pressed ? -0.3 : hovered ? 0.05 : 0);
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y, targetY, 0.1
      );
    }
  });

  function getKeyColor() {
    if (!isFiltered) {
      return keyData.isBlack ? '#1a1a1a' : '#e8e8e8';
    }
    
    if (viewMode === 'heatmap') {
      return keyData.isBlack ? '#1a1a1a' : getHeatmapColor(keyData.pressure);
    } else if (viewMode === 'rebound') {
      const reboundNormalized = Math.max(0, Math.min(1, (keyData.reboundTime - 60) / 120));
      return keyData.isBlack ? '#1a1a1a' : getHeatmapColor(40 + reboundNormalized * 40);
    }
    return keyData.isBlack ? '#1a1a1a' : '#f5f5f3';
  }

  const keyColor = getKeyColor();
  const scaleVal = isSelected ? 1.02 : hovered ? 1.01 : 1;
  const emissiveIntensity = isSelected ? 0.3 : hovered ? 0.1 : 0;
  const keyWidth = keyData.isBlack ? 0.55 : 0.9;
  const keyHeight = keyData.isBlack ? 6 : 10;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      scale={[scaleVal, 1, scaleVal]}
    >
      <boxGeometry args={[keyWidth, 0.8, keyHeight]} />
      <meshStandardMaterial
        color={keyColor}
        emissive={isSelected || hovered ? '#ff6b35' : '#000000'}
        emissiveIntensity={emissiveIntensity}
        roughness={0.3}
        metalness={0.1}
        transparent={!isFiltered}
        opacity={isFiltered ? 1 : 0.3}
      />
    </mesh>
  );
}
