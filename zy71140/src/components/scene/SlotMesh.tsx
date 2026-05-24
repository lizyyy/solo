import { useRef, useState, useEffect } from 'react';
import type { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import type { Slot, SKU, Layer } from '../../types';
import { getExpiryColor, isExpiringSoon } from '../../utils/expiryChecker';

interface SlotMeshProps {
  slot: Slot;
  layer: Layer | undefined;
  sku: SKU | undefined;
  isSelected: boolean;
  isSearchMatch: boolean;
  expiryFilterDays: number;
  onClick: () => void;
}

export function SlotMesh({
  slot,
  layer,
  sku,
  isSelected,
  isSearchMatch,
  expiryFilterDays,
  onClick,
}: SlotMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(Math.random() * Math.PI * 2);

  const isExpiring = sku ? isExpiringSoon(sku.expiryDate, expiryFilterDays) : false;
  const expiryColor = sku ? getExpiryColor(sku.expiryDate) : '#64748b';

  let baseColor = layer?.color || '#475569';
  if (slot.status === 'misplaced') baseColor = '#f59e0b';
  if (slot.status === 'conflict') baseColor = '#ef4444';
  if (!slot.isOccupied) baseColor = '#374151';

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime;

      if (isExpiring) {
        const pulse = Math.sin(time * 3 + pulsePhase) * 0.5 + 0.5;
        meshRef.current.scale.setScalar(1 + pulse * 0.08);
      } else if (isSelected) {
        const float = Math.sin(time * 2) * 0.1;
        meshRef.current.position.y = slot.position.y + float;
      } else {
        meshRef.current.scale.setScalar(hovered ? 1.05 : 1);
      }
    }
  });

  const displayColor = isExpiring ? expiryColor : baseColor;
  const emissiveIntensity = isSelected ? 0.6 : hovered ? 0.4 : isExpiring ? 0.3 : 0.1;
  const opacity = isSearchMatch ? 1 : 0.25;

  return (
    <mesh
      ref={meshRef}
      position={[slot.position.x, slot.position.y, slot.position.z]}
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
    >
      <boxGeometry args={[1.5, 1.8, 1.2]} />
      <meshStandardMaterial
        color={displayColor}
        transparent
        opacity={opacity}
        emissive={displayColor}
        emissiveIntensity={emissiveIntensity}
        metalness={0.3}
        roughness={0.5}
      />

      {slot.status !== 'normal' && (
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color={slot.status === 'conflict' ? '#ef4444' : '#f59e0b'} />
        </mesh>
      )}

      {isExpiring && (
        <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.6, 32]} />
          <meshBasicMaterial color={expiryColor} transparent opacity={0.8} side={2} />
        </mesh>
      )}
    </mesh>
  );
}
