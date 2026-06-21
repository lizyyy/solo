import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Anomaly } from '../../types';
import { STATUS_COLORS } from '../../types';

interface AnomalyMarkerProps {
  anomaly: Anomaly;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

export function AnomalyMarker({
  anomaly,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: AnomalyMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(1);
  
  const color = useMemo(() => {
    return STATUS_COLORS[anomaly.status];
  }, [anomaly.status]);
  
  const baseScale = useMemo(() => {
    if (anomaly.severity === 'critical') return 1.3;
    if (anomaly.severity === 'warning') return 1;
    return 0.8;
  }, [anomaly.severity]);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(time * 3) * 0.15;
    const targetScale = baseScale * pulse * (isSelected ? 1.5 : 1) * (isHovered ? 1.2 : 1);
    setScale(prev => prev + (targetScale - prev) * 0.1);
    
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scale);
    }
    
    if (glowRef.current) {
      const glowScale = 1 + Math.sin(time * 2) * 0.3;
      glowRef.current.scale.setScalar(scale * glowScale * 1.5);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(time * 2) * 0.15;
    }
    
    if (groupRef.current && anomaly.status === 'pending') {
      groupRef.current.position.y = anomaly.reportedPosition.y + 1 + Math.sin(time * 2) * 0.2;
    }
  });
  
  const showOffsetLine = anomaly.type === 'coordinate_offset' && anomaly.actualPosition;
  const showCrossFloorLine = anomaly.isCrossFloor;
  
  const linePoints = useMemo(() => {
    if (showOffsetLine && anomaly.actualPosition) {
      return [
        new THREE.Vector3(
          anomaly.reportedPosition.x,
          anomaly.reportedPosition.y + 1,
          anomaly.reportedPosition.z
        ),
        new THREE.Vector3(
          anomaly.actualPosition.x,
          anomaly.actualPosition.y + 1,
          anomaly.actualPosition.z
        ),
      ];
    }
    if (showCrossFloorLine) {
      return [
        new THREE.Vector3(
          anomaly.reportedPosition.x,
          2,
          anomaly.reportedPosition.z
        ),
        new THREE.Vector3(
          anomaly.reportedPosition.x,
          12,
          anomaly.reportedPosition.z
        ),
      ];
    }
    return null;
  }, [showOffsetLine, showCrossFloorLine, anomaly]);
  
  const lineGeometry = useMemo(() => {
    if (!linePoints) return null;
    const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    // @ts-expect-error computeLineDistances exists in runtime
    geometry.computeLineDistances?.();
    return geometry;
  }, [linePoints]);
  
  return (
    <group>
      <group
        ref={groupRef}
        position={[
          anomaly.reportedPosition.x,
          anomaly.reportedPosition.y + 1,
          anomaly.reportedPosition.z,
        ]}
      >
        <mesh
          ref={meshRef}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onPointerOver();
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onPointerOut();
          }}
        >
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isSelected ? 1 : 0.5}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
        
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
        
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
            <ringGeometry args={[0.6, 0.8, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
      
      {lineGeometry && (
        <lineSegments geometry={lineGeometry}>
          <lineDashedMaterial
            color={anomaly.type === 'coordinate_offset' ? '#e63946' : '#f4a261'}
            dashSize={0.5}
            gapSize={0.3}
            linewidth={2}
          />
        </lineSegments>
      )}
      
      {showOffsetLine && anomaly.offsetDistance && (
        <group
          position={[
            (anomaly.reportedPosition.x + (anomaly.actualPosition?.x || 0)) / 2,
            (anomaly.reportedPosition.y + (anomaly.actualPosition?.y || 0)) / 2 + 1.5,
            (anomaly.reportedPosition.z + (anomaly.actualPosition?.z || 0)) / 2,
          ]}
        >
          <mesh>
            <boxGeometry args={[2.5, 0.5, 0.1]} />
            <meshBasicMaterial color="#1e3a5f" opacity={0.9} transparent />
          </mesh>
        </group>
      )}
    </group>
  );
}

interface AnomalyMarkersProps {
  anomalies: Anomaly[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

export function AnomalyMarkers({
  anomalies,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: AnomalyMarkersProps) {
  return (
    <group>
      {anomalies.map((anomaly) => (
        <AnomalyMarker
          key={anomaly.id}
          anomaly={anomaly}
          isSelected={anomaly.id === selectedId}
          isHovered={anomaly.id === hoveredId}
          onClick={() => onSelect(anomaly.id)}
          onPointerOver={() => onHover(anomaly.id)}
          onPointerOut={() => onHover(null)}
        />
      ))}
    </group>
  );
}
