import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Pin } from '@/data/types';
import { useSelectionStore } from '@/store/selectionStore';

interface PinTowerProps {
  pin: Pin;
  domainColor: string;
  isConflicted: boolean;
  isFiltered: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isConflictFocused: boolean;
}

export default function PinTower({
  pin,
  domainColor,
  isConflicted,
  isFiltered,
  isSelected,
  isHovered,
  isConflictFocused,
}: PinTowerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const selectPin = useSelectionStore((s) => s.selectPin);
  const hoverPin = useSelectionStore((s) => s.hoverPin);

  const towerHeight = useMemo(() => {
    if (pin.signalType === 'power') return 0.6;
    if (pin.signalType === 'ground') return 0.3;
    if (pin.signalType === 'signal' || pin.signalType === 'clock') {
      return 0.3 + (pin.signalFrequency / 1000) * 1.5;
    }
    return 0.3;
  }, [pin.signalType, pin.signalFrequency]);

  const chipTopZ = 0.15;
  const towerZ = chipTopZ + towerHeight / 2;

  const emissiveColor = useMemo(() => {
    if (isConflictFocused) return new THREE.Color('#ff2d55');
    if (isConflicted) return new THREE.Color('#ff2d55');
    if (isSelected) return new THREE.Color('#ffffff');
    return new THREE.Color('#000000');
  }, [isConflicted, isSelected, isConflictFocused]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    if (isConflictFocused) {
      material.emissiveIntensity = 1.0;
    } else if (isConflicted) {
      const t = state.clock.elapsedTime;
      material.emissiveIntensity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4));
    } else if (isSelected) {
      material.emissiveIntensity = 0.5;
    } else {
      material.emissiveIntensity = 0;
    }
  });

  const scale = isHovered ? 1.2 : 1;
  const opacity = isFiltered ? 1 : 0.15;

  return (
    <group
      position={[pin.x, pin.y, 0]}
      scale={[scale, scale, scale]}
    >
      <mesh
        ref={meshRef}
        position={[0, 0, towerZ]}
        onClick={(e) => {
          e.stopPropagation();
          selectPin(pin.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hoverPin(pin.id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          hoverPin(null);
        }}
      >
        <cylinderGeometry args={[0.04, 0.04, towerHeight, 12]} />
        <meshStandardMaterial
          color={domainColor}
          emissive={emissiveColor}
          emissiveIntensity={0}
          transparent
          opacity={opacity}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>
      {(isHovered || isSelected) && (
        <Html
          position={[0, 0, chipTopZ + towerHeight + 0.1]}
          center
          distanceFactor={8}
          occlude={false}
          style={{
            color: '#e0e0e0',
            fontSize: '12px',
            fontFamily: 'monospace',
            background: 'rgba(10, 14, 23, 0.85)',
            padding: '2px 6px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            border: `1px solid ${domainColor}`,
          }}
        >
          {pin.name}
        </Html>
      )}
    </group>
  );
}
