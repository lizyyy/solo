import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Shelf } from '../types';
import { congestionToColor } from '../utils/colors';
import { useViewStore } from '../store/viewStore';
import { useDataStore } from '../store/dataStore';
import { useModificationStore } from '../store/modificationStore';

interface Shelf3DProps {
  shelf: Shelf;
  floorZ: number;
}

export default function Shelf3D({ shelf, floorZ }: Shelf3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const congestionRef = useRef<THREE.Mesh>(null);
  const { selectedElementId, setSelectedElement } = useViewStore();
  const { updateShelf } = useDataStore();
  const { recordModification } = useModificationStore();

  const isSelected = selectedElementId === shelf.id;
  const congestionLevel = shelf.congestionLevel ?? 0;
  const color = useMemo(() => {
    if (shelf.isMissingData) return new THREE.Color('#475569');
    const rgb = congestionToColor(congestionLevel);
    return new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
  }, [congestionLevel, shelf.isMissingData]);

  const targetY = useMemo(() => floorZ + shelf.dimensions.height / 2, [floorZ, shelf.dimensions.height]);
  const targetPos = useMemo(
    () => new THREE.Vector3(shelf.position.x, targetY, shelf.position.y),
    [shelf.position.x, shelf.position.y, targetY]
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const current = meshRef.current.position;
    const targetYPos = isSelected ? targetY + 0.1 : targetY;
    current.y += (targetYPos - current.y) * delta * 5;
  });

  useFrame(() => {
    if (!ringRef.current) return;
    ringRef.current.visible = isSelected;
    if (isSelected) {
      ringRef.current.rotation.y += 0.02;
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.05;
      ringRef.current.scale.set(scale, 1, scale);
    }
  });

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation();
    setSelectedElement(shelf.id, 'shelf');
  };

  const handleModify = (field: string, oldValue: string, newValue: string, reason: string) => {
    recordModification({
      entityType: 'shelf',
      entityId: shelf.id,
      fieldName: field,
      oldValue,
      newValue,
      reason,
    });
    const numValue = Number(newValue);
    if (!isNaN(numValue)) {
      updateShelf(shelf.id, { [field]: numValue });
    }
  };

  return (
    <group position={targetPos}>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={handleClick}
      >
        <boxGeometry args={[shelf.dimensions.width, shelf.dimensions.height, shelf.dimensions.depth]} />
        <meshStandardMaterial
          color={color}
          metalness={0.6}
          roughness={0.3}
          transparent={shelf.isMissingData ?? false}
          opacity={shelf.isMissingData ? 0.4 : 1}
        />
      </mesh>

      {congestionLevel > 0.5 && (
        <mesh ref={congestionRef} position={[0, shelf.dimensions.height / 2 + congestionLevel * 1.5, 0]}>
          <cylinderGeometry args={[0.3, 0.3, congestionLevel * 2, 8]} />
          <meshStandardMaterial
            color="#EF4444"
            transparent
            opacity={0.4}
            emissive="#EF4444"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      <mesh ref={ringRef} position={[0, -shelf.dimensions.height / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(shelf.dimensions.width, shelf.dimensions.depth) * 0.6, Math.max(shelf.dimensions.width, shelf.dimensions.depth) * 0.7, 32]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {handleModify as unknown as React.ReactNode}
    </group>
  );
}
