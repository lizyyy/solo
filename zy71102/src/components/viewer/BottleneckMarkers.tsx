import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Bottleneck } from '../../simulation/types';

interface BottleneckMarkersProps {
  bottlenecks: Bottleneck[];
  stationWidth: number;
  stationHeight: number;
  is2DMode: boolean;
}

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'high':
      return '#e74c3c';
    case 'medium':
      return '#f39c12';
    case 'low':
      return '#f1c40f';
    default:
      return '#95a5a6';
  }
};

export const BottleneckMarkers: React.FC<BottleneckMarkersProps> = ({
  bottlenecks,
  stationWidth,
  stationHeight,
  is2DMode
}) => {
  const markerHeight = is2DMode ? 0.1 : 3;

  return (
    <group>
      {bottlenecks.map((bottleneck) => {
        const x = bottleneck.x - stationWidth / 2;
        const z = bottleneck.y - stationHeight / 2;
        const color = getSeverityColor(bottleneck.severity);
        const pulseScale = 1 + Math.sin(Date.now() * 0.003) * 0.2;

        return (
          <group key={bottleneck.id} position={[x, 0, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[1.5 * pulseScale, 2.5 * pulseScale, 16]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>

            {!is2DMode && (
              <mesh position={[0, markerHeight / 2, 0]}>
                <cylinderGeometry args={[0.1, 0.1, markerHeight, 8]} />
                <meshBasicMaterial color={color} transparent opacity={0.8} />
              </mesh>
            )}

            <mesh position={[0, is2DMode ? 0.1 : markerHeight + 0.5, 0]}>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
