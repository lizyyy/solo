import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WindowUnit as WindowType, Orientation } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface WindowProps {
  window: WindowType;
  isShadowed: boolean;
}

export default function WindowUnit({ window, isShadowed }: WindowProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedWindows, selectWindow } = useAppStore();
  
  const isSelected = selectedWindows.includes(window.id);

  const getRotation = (orientation: Orientation): [number, number, number] => {
    switch (orientation) {
      case 'north':
        return [0, 0, 0];
      case 'south':
        return [0, Math.PI, 0];
      case 'east':
        return [0, Math.PI / 2, 0];
      case 'west':
        return [0, -Math.PI / 2, 0];
      default:
        return [0, 0, 0];
    }
  };

  const windowColor = useMemo(() => {
    if (isSelected) return '#fbbf24';
    if (isShadowed) return '#ef4444';
    return '#60a5fa';
  }, [isSelected, isShadowed]);

  const glowIntensity = useRef(0);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      
      if (isSelected) {
        glowIntensity.current = (glowIntensity.current + delta * 2) % (Math.PI * 2);
        material.emissiveIntensity = 0.3 + Math.sin(glowIntensity.current) * 0.2;
      } else {
        material.emissiveIntensity = isShadowed ? 0.1 : 0.2;
      }
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    selectWindow(window.id, true);
  };

  return (
    <mesh
      ref={meshRef}
      position={window.position}
      rotation={getRotation(window.orientation)}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <planeGeometry args={[window.size.width, window.size.height]} />
      <meshStandardMaterial
        color={windowColor}
        emissive={windowColor}
        emissiveIntensity={isSelected ? 0.5 : 0.2}
        transparent
        opacity={isSelected ? 0.9 : 0.7}
        side={THREE.DoubleSide}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(window.size.width + 0.3, window.size.height + 0.3)]} />
          <lineBasicMaterial color="#fbbf24" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  );
}
