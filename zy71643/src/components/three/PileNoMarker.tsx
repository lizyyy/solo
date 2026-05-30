import { useMemo } from 'react';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { PileMarker } from '../../types';

interface PileNoMarkerProps {
  marker: PileMarker;
  isHighlighted: boolean;
  onClick: () => void;
}

export function PileNoMarker({ marker, isHighlighted, onClick }: PileNoMarkerProps) {
  const color = isHighlighted ? '#fb8c00' : '#94a3b8';

  return (
    <group
      position={[marker.position.x, 0.5, marker.position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.1, 8]} />
        <meshStandardMaterial
          color={isHighlighted ? '#fb8c00' : '#334155'}
          emissive={isHighlighted ? '#fb8c00' : '#1e293b'}
          emissiveIntensity={isHighlighted ? 0.3 : 0.1}
        />
      </mesh>

      <Billboard position={[0, 1.5, 0]}>
        <Text
          fontSize={1.2}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.08}
          outlineColor="#0f172a"
        >
          {marker.no}
        </Text>
      </Billboard>

      {isHighlighted && (
        <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial
            color="#fb8c00"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

export function PileNoMarkersGroup({
  markers,
  visible,
  highlightedPileNo,
  onSelectPile,
}: {
  markers: PileMarker[];
  visible: boolean;
  highlightedPileNo: string;
  onSelectPile: (marker: PileMarker) => void;
}) {
  if (!visible) return null;

  return (
    <group>
      {markers.map((marker) => (
        <PileNoMarker
          key={marker.id}
          marker={marker}
          isHighlighted={highlightedPileNo === marker.no}
          onClick={() => onSelectPile(marker)}
        />
      ))}
    </group>
  );
}
