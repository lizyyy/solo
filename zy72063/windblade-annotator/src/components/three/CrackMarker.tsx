import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { CrackRecord, RecordStatus } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface CrackMarkerProps {
  record: CrackRecord;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
}

const STATUS_COLOR_MAP: Record<RecordStatus, number> = {
  pending: 0xf97316,
  processing: 0x3b82f6,
  completed: 0x10b981,
  confirmed: 0x64748b
};

export const CrackMarker = ({ record, onSelect, onDoubleClick }: CrackMarkerProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedRecordId } = useAppStore();
  const isSelected = selectedRecordId === record.id;
  const color = STATUS_COLOR_MAP[record.status];

  const glowColor = useMemo(() => {
    if (record.isOldCaliber) return 0xfbbf24;
    return color;
  }, [color, record.isOldCaliber]);

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(record.id);
  };

  const handleDoubleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onDoubleClick(record.id);
  };

  const scale = isSelected ? 1.5 : 1;

  return (
    <group position={[record.position3D.x, record.position3D.y, record.position3D.z]}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        scale={[scale, scale, scale]}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>

      <mesh scale={[scale * 1.5, scale * 1.5, scale * 1.5]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.3}
        />
      </mesh>

      {isSelected && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <ringGeometry args={[0.12, 0.15, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <ringGeometry args={[0.16, 0.18, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {record.isOldCaliber && (
        <mesh position={[0.12, 0.12, 0]}>
          <torusGeometry args={[0.04, 0.01, 8, 16]} />
          <meshBasicMaterial color={0xfbbf24} />
        </mesh>
      )}

      {record.riskLevel === 'high' && (
        <mesh position={[0, 0.15, 0]}>
          <coneGeometry args={[0.05, 0.1, 4]} />
          <meshBasicMaterial color={0xef4444} />
        </mesh>
      )}
    </group>
  );
};
