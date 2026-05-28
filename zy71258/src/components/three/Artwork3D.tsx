import { useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { DragControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Artwork } from '@/types';
import { GRADE_COLORS } from '@/types';
import { useMainStore } from '@/store/mainStore';

interface Artwork3DProps {
  artwork: Artwork;
  isSelected: boolean;
}

export default function Artwork3D({ artwork, isSelected }: Artwork3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const {
    selectArtwork,
    isRelayoutMode,
    draggingArtworkId,
    setDraggingArtworkId,
    updateArtworkPosition
  } = useMainStore();

  const borderColor = GRADE_COLORS[artwork.lightResistanceGrade];
  const isDragging = draggingArtworkId === artwork.id;

  useFrame((_, delta) => {
    if (groupRef.current) {
      const targetScale = isSelected ? 1.05 : hovered ? 1.02 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);
    }
  });

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!isRelayoutMode) {
      selectArtwork(artwork.id);
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = isRelayoutMode ? 'grab' : 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleDragStart = () => {
    setDraggingArtworkId(artwork.id);
  };

  const handleDragEnd = () => {
    if (groupRef.current && isDragging) {
      const pos = groupRef.current.position;
      updateArtworkPosition(artwork.id, { x: pos.x, y: pos.y, z: pos.z });
    }
    setDraggingArtworkId(null);
  };

  const Wrapper = isRelayoutMode ? DragControls : 'group';
  const wrapperProps = isRelayoutMode
    ? {
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd,
        dragPlaneNormal: [0, 0, 1] as [number, number, number],
        position: [artwork.posX, artwork.posY, artwork.posZ] as [number, number, number]
      }
    : {
        position: [artwork.posX, artwork.posY, artwork.posZ] as [number, number, number]
      };

  return (
    <Wrapper {...wrapperProps}>
      <group
        ref={groupRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[artwork.width + 0.08, artwork.height + 0.08, 0.05]} />
          <meshStandardMaterial
            color={borderColor}
            emissive={isSelected ? borderColor : '#000000'}
            emissiveIntensity={isSelected ? 0.3 : 0}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>

        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[artwork.width, artwork.height, 0.03]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>

        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[artwork.width - 0.04, artwork.height - 0.04]} />
          <meshStandardMaterial
            color={`hsl(${(artwork.id.charCodeAt(8) * 37) % 360}, 30%, 25%)`}
            roughness={0.7}
          />
        </mesh>

        {isSelected && (
          <mesh position={[0, 0, 0.02]} renderOrder={100}>
            <ringGeometry
              args={[Math.max(artwork.width, artwork.height) / 2 + 0.1, Math.max(artwork.width, artwork.height) / 2 + 0.15, 64]}
            />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </Wrapper>
  );
}
