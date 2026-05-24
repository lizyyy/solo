import { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore, useFilteredSeats } from '@/store/appStore';

export function LineOfSightLines() {
  const seats = useFilteredSeats();
  const platform = useAppStore((state) => state.platform);
  const eyeHeight = useAppStore((state) => state.eyeHeight);
  const showLineOfSight = useAppStore((state) => state.showLineOfSight);

  const lineData = useMemo(() => {
    if (!showLineOfSight) return [];

    return seats.map((seat) => {
      const start = new THREE.Vector3(
        seat.position.x,
        eyeHeight,
        seat.position.z
      );
      const end = new THREE.Vector3(
        platform.targetPoint.x,
        platform.targetPoint.y,
        platform.targetPoint.z
      );
      return {
        seatId: seat.id,
        start,
        end,
        isBlocked: seat.isBlocked,
      };
    });
  }, [seats, platform, eyeHeight, showLineOfSight]);

  if (!showLineOfSight) return null;

  return (
    <group>
      {lineData.map(({ seatId, start, end, isBlocked }) => (
        <line key={seatId}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                start.x, start.y, start.z,
                end.x, end.y, end.z,
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={isBlocked ? '#ef4444' : '#10b981'}
            transparent
            opacity={isBlocked ? 0.8 : 0.4}
            linewidth={1}
          />
        </line>
      ))}
    </group>
  );
}
