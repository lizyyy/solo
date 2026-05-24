import { useState, useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Mesh } from 'three';
import { SkuSlot } from '../../types';
import { useAppStore } from '../../store/appStore';

interface Sku3DProps {
  slot: SkuSlot;
  shelfId: string;
  layerIndex: number;
  layerHeight: number;
  shelfWidth: number;
  shelfDepth: number;
  isSelected: boolean;
  hasIssue: boolean;
}

export function Sku3D({
  slot,
  shelfId,
  layerIndex,
  layerHeight,
  shelfWidth,
  shelfDepth,
  isSelected,
  hasIssue,
}: Sku3DProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const setSelectedSku = useAppStore((state) => state.setSelectedSku);
  const setDraggedSku = useAppStore((state) => state.setDraggedSku);
  const draggedSku = useAppStore((state) => state.draggedSku);
  const moveSku = useAppStore((state) => state.moveSku);

  const slotWidth = shelfWidth / 8;
  const xPos = (slot.position - 3.5) * slotWidth + slotWidth / 2;
  const zPos = 0;
  const yPos = layerHeight + 0.15;

  const isDragging = draggedSku?.slotId === slot.id;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (draggedSku && draggedSku.slotId !== slot.id) {
      moveSku(
        draggedSku.shelfId,
        draggedSku.layerIndex,
        draggedSku.slotId,
        shelfId,
        layerIndex,
        slot.position
      );
    } else {
      setSelectedSku(slot.skuId, slot.id);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!slot.isOutOfStock) {
      setDraggedSku({ shelfId, layerIndex, slotId: slot.id });
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  if (slot.isOutOfStock) {
    return (
      <mesh
        position={[xPos, yPos, zPos]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[slotWidth * 0.9, 0.25, shelfDepth * 0.8]} />
        <meshStandardMaterial
          color="#ff4444"
          transparent
          opacity={hovered ? 0.5 : 0.3}
          wireframe={!hovered}
        />
      </mesh>
    );
  }

  let boxColor = slot.color;
  if (hasIssue) {
    boxColor = '#ff6b35';
  }
  if (isSelected) {
    boxColor = '#fbbf24';
  }
  if (hovered && !isSelected) {
    boxColor = '#ffffff';
  }

  return (
    <group position={[xPos, yPos, zPos]}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        scale={isDragging ? [1.1, 1.1, 1.1] : [1, 1, 1]}
      >
        <boxGeometry args={[slotWidth * 0.85, 0.25, shelfDepth * 0.85]} />
        <meshStandardMaterial
          color={boxColor}
          emissive={isSelected ? '#fbbf24' : hovered ? '#333333' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : hovered ? 0.1 : 0}
          metalness={0.1}
          roughness={0.7}
        />
      </mesh>

      {(isSelected || hovered) && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[slotWidth * 0.9, 0.28, shelfDepth * 0.9]} />
          <meshBasicMaterial
            color={isSelected ? '#fbbf24' : '#ffffff'}
            transparent
            opacity={0.2}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
}
