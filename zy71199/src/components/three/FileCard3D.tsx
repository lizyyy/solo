import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { FileCard, ConfidentialityLevel } from '@/types';
import { FILE_CATEGORY_LABELS, CONFIDENTIALITY_COLORS } from '@/types';

interface FileCard3DProps {
  file: FileCard;
  position: [number, number, number];
  onPointerDown: (e: THREE.Event) => void;
  onPointerUp: (e: THREE.Event) => void;
  onPointerMove: (e: THREE.Event) => void;
  isBeingDragged: boolean;
  selectedConfidentiality: ConfidentialityLevel | null;
}

export default function FileCard3D({
  file,
  position,
  onPointerDown,
  onPointerUp,
  onPointerMove,
  isBeingDragged,
  selectedConfidentiality,
}: FileCard3DProps) {
  const meshRef = useRef<THREE.Group>(null);
  const confColor = selectedConfidentiality
    ? CONFIDENTIALITY_COLORS[selectedConfidentiality]
    : '#95a5a6';

  useFrame(() => {
    if (meshRef.current) {
      if (isBeingDragged) {
        meshRef.current.position.y += (position[1] + 0.3 - meshRef.current.position.y) * 0.2;
      } else {
        meshRef.current.position.y += (position[1] - meshRef.current.position.y) * 0.15;
      }
    }
  });

  return (
    <group
      ref={meshRef}
      position={position}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
    >
      <RoundedBox args={[0.55, 0.75, 0.03]} radius={0.015} smoothness={4}>
        <meshStandardMaterial color="#f5e6c8" metalness={0.1} roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0.25, 0.02]}>
        <planeGeometry args={[0.45, 0.08]} />
        <meshStandardMaterial color={confColor} />
      </mesh>
      <Text
        position={[0, 0.3, 0.025]}
        fontSize={0.04}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.4}
      >
        {FILE_CATEGORY_LABELS[file.type]}
      </Text>
      <Text
        position={[0, 0.1, 0.02]}
        fontSize={0.045}
        color="#333"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.45}
      >
        {file.name.length > 12 ? file.name.slice(0, 12) + '...' : file.name}
      </Text>
      <Text
        position={[0, -0.1, 0.02]}
        fontSize={0.03}
        color="#666"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.45}
      >
        {file.content.length > 20 ? file.content.slice(0, 20) + '...' : file.content}
      </Text>
      <Text
        position={[0, -0.3, 0.02]}
        fontSize={0.025}
        color="#888"
        anchorX="center"
        anchorY="middle"
      >
        ID: {file.id.slice(-4)}
      </Text>
      {selectedConfidentiality && (
        <mesh position={[0, 0.38, 0.02]}>
          <ringGeometry args={[0.08, 0.1, 32]} />
          <meshBasicMaterial color={confColor} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}