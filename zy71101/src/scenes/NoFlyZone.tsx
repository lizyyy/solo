import { useMemo } from 'react';
import { NoFlyZone as NoFlyZoneType, unitConversion } from '@/types';
import * as THREE from 'three';

interface NoFlyZoneProps {
  zones: NoFlyZoneType[];
  visible?: boolean;
}

export const NoFlyZones = ({ zones, visible = true }: NoFlyZoneProps) => {
  const zoneGeometries = useMemo(() => {
    return zones.map(zone => {
      if (zone.type === 'polygon') {
        const shape = new THREE.Shape();
        const coords = zone.coordinates;
        if (coords.length < 3) return null;

        shape.moveTo(coords[0].x, coords[0].z);
        for (let i = 1; i < coords.length; i++) {
          shape.lineTo(coords[i].x, coords[i].z);
        }
        shape.closePath();

        const extrudeSettings = {
          depth: zone.maxHeight - zone.minHeight,
          bevelEnabled: false
        };

        return {
          type: 'polygon' as const,
          zone,
          shape,
          extrudeSettings,
          position: [0, zone.minHeight, 0] as [number, number, number],
          rotation: [-Math.PI / 2, 0, 0] as [number, number, number]
        };
      } else {
        const center = zone.coordinates[0];
        const radius = zone.radius || 20;
        return {
          type: 'circle' as const,
          zone,
          radius,
          height: zone.maxHeight - zone.minHeight,
          position: [center.x, zone.minHeight + (zone.maxHeight - zone.minHeight) / 2, center.z] as [number, number, number]
        };
      }
    }).filter(Boolean);
  }, [zones]);

  if (!visible) return null;

  return (
    <group>
      {zoneGeometries.map((data, index) => {
        if (!data) return null;
        const zone = data.zone;

        return (
          <group key={zone.id}>
            {data.type === 'polygon' ? (
              <mesh
                position={data.position}
                rotation={data.rotation}
              >
                <extrudeGeometry args={[data.shape, data.extrudeSettings]} />
                <meshBasicMaterial 
                  color={zone.color}
                  transparent
                  opacity={0.4}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : (
              <mesh position={data.position}>
                <cylinderGeometry 
                  args={[data.radius, data.radius, data.height, 32]} 
                />
                <meshBasicMaterial 
                  color={zone.color}
                  transparent
                  opacity={0.4}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
            
            <mesh position={[
              data.type === 'polygon' ? 0 : data.position[0],
              zone.minHeight + 0.05,
              data.type === 'polygon' ? 0 : data.position[2]
            ]} rotation={[-Math.PI / 2, 0, 0]}>
              {data.type === 'polygon' ? (
                <>
                  <shapeGeometry args={[data.shape]} />
                  <meshBasicMaterial 
                    color="#EF4444"
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                  />
                </>
              ) : (
                <>
                  <ringGeometry args={[data.radius - 0.5, data.radius, 32]} />
                  <meshBasicMaterial color="#EF4444" transparent opacity={0.8} />
                </>
              )}
            </mesh>

            {zone.type === 'polygon' && zone.coordinates.map((coord, i) => (
              <mesh key={i} position={[coord.x, zone.minHeight + 0.5, coord.z]}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color="#EF4444" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};
