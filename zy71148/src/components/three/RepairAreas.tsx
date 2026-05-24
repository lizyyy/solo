import { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../../store';

export const RepairAreas = () => {
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const showRepairAreas = useAppStore((state) => state.showRepairAreas);

  const areas = useMemo(() => {
    if (!data || !showRepairAreas) return [];

    const currentTime = data.snapshots[currentTimeIndex].timestamp;

    return data.repairAreas.filter(
      (area) => area.startTime <= currentTime && area.endTime >= currentTime
    );
  }, [data, currentTimeIndex, showRepairAreas]);

  if (!data || !showRepairAreas || areas.length === 0) return null;

  return (
    <group>
      {areas.map((area) => {
        const shape = new THREE.Shape();
        const points = area.points;

        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          shape.lineTo(points[i].x, points[i].y);
        }
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        geometry.rotateX(-Math.PI / 2);

        const color = area.retested ? '#22c55e' : '#f59e0b';

        return (
          <group key={area.id}>
            <mesh geometry={geometry} position={[0, 0.02, 0]}>
              <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>

            <lineSegments>
              <edgesGeometry args={[geometry]} />
              <lineBasicMaterial color={color} linewidth={2} />
            </lineSegments>
          </group>
        );
      })}
    </group>
  );
};
