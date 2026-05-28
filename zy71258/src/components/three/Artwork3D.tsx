import { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { DragControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Artwork, Point3D, RiskSeverity } from '@/types';
import { GRADE_COLORS, LIGHT_RESISTANCE_THRESHOLDS } from '@/types';
import { useMainStore } from '@/store/mainStore';
import { calculateTotalIllumination } from '@/hooks/useLightCalculation';

interface Artwork3DProps {
  artwork: Artwork;
  isSelected: boolean;
}

function getRiskSeverity(illumination: number, grade: Artwork['lightResistanceGrade']): RiskSeverity {
  const threshold = LIGHT_RESISTANCE_THRESHOLDS[grade].maxInstantIllumination;
  const ratio = illumination / threshold;
  if (ratio >= 2) return 'critical';
  if (ratio >= 1.5) return 'high';
  if (ratio >= 1) return 'medium';
  return 'low';
}

export default function Artwork3D({ artwork, isSelected }: Artwork3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const {
    selectArtwork,
    isRelayoutMode,
    draggingArtworkId,
    setDraggingArtworkId,
    updateArtworkPosition,
    gallery,
    lightSources,
    setOriginalPosition,
    setRelayoutPreview
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

  const originalPosition: Point3D = useMemo(() => ({
    x: artwork.posX,
    y: artwork.posY,
    z: artwork.posZ
  }), [artwork.posX, artwork.posY, artwork.posZ]);

  const handleDragStart = () => {
    setDraggingArtworkId(artwork.id);
    setOriginalPosition(originalPosition);
  };

  const handleDragEnd = () => {
    if (groupRef.current && isDragging && gallery) {
      const newPos: Point3D = {
        x: groupRef.current.position.x,
        y: groupRef.current.position.y,
        z: groupRef.current.position.z
      };
      
      const originalIllumination = calculateTotalIllumination(
        lightSources,
        originalPosition,
        gallery.walls
      );
      
      const newIllumination = calculateTotalIllumination(
        lightSources,
        newPos,
        gallery.walls
      );
      
      const originalRisk = getRiskSeverity(originalIllumination, artwork.lightResistanceGrade);
      const newRisk = getRiskSeverity(newIllumination, artwork.lightResistanceGrade);
      
      const improvement = (originalIllumination - newIllumination) / Math.max(originalIllumination, 1);
      
      const threshold = LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade].maxInstantIllumination;
      const warnings: string[] = [];
      
      if (newIllumination > threshold) {
        warnings.push(`新位置照度 ${newIllumination.toFixed(1)} lux 仍超过该作品耐光阈值 ${threshold} lux`);
      }
      if (newPos.x < -gallery.width / 2 || newPos.x > gallery.width / 2 ||
          newPos.z < -gallery.depth / 2 || newPos.z > gallery.depth / 2) {
        warnings.push('作品位置超出展厅边界');
      }
      
      let recommendation = '';
      if (improvement > 0.3) {
        recommendation = '换位后光照条件显著改善，建议确认换位。';
      } else if (improvement > 0.1) {
        recommendation = '换位后光照条件有所改善，可考虑确认。';
      } else if (improvement > 0) {
        recommendation = '换位后光照条件略有改善，建议评估其他因素。';
      } else if (improvement < -0.1) {
        recommendation = '⚠️ 换位后光照条件恶化，不建议确认。';
      } else {
        recommendation = '换位后光照条件变化不大，请综合考虑。';
      }
      
      updateArtworkPosition(artwork.id, newPos);
      
      setRelayoutPreview({
        originalPosition,
        newPosition: newPos,
        originalIllumination,
        newIllumination,
        originalRiskLevel: originalRisk,
        newRiskLevel: newRisk,
        improvement,
        recommendation,
        warnings
      });
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
