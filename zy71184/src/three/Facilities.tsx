import { useMemo } from 'react';
import { CONFIG } from '../engine/config';
import { Drain, Lowland, Pump } from '../engine/types';

interface FacilitiesProps {
  facilities: (Drain | Pump | Lowland)[];
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'normal': return '#00B42A';
    case 'warning': return '#FF7D00';
    case 'danger': return '#F53F3F';
    case 'broken': return '#4E5969';
    default: return '#00B42A';
  }
}

export function Facilities({ facilities }: FacilitiesProps) {
  const facilityObjects = useMemo(() => {
    return facilities.map(facility => {
      const x = facility.x * CONFIG.CELL_SIZE - (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2 + CONFIG.CELL_SIZE / 2;
      const z = facility.y * CONFIG.CELL_SIZE - (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2 + CONFIG.CELL_SIZE / 2;
      const color = getStatusColor(facility.status);

      return { ...facility, worldX: x, worldZ: z, color };
    });
  }, [facilities]);

  return (
    <group>
      {facilityObjects.map(facility => (
        <group key={facility.id} position={[facility.worldX, 0, facility.worldZ]}>
          {facility.type === 'drain' && (
            <>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[1.5, 2, 0.6, 16]} />
                <meshStandardMaterial color="#165DFF" metalness={0.5} roughness={0.3} />
              </mesh>
              <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.8, 1, 1.2, 16]} />
                <meshStandardMaterial color="#165DFF" metalness={0.6} roughness={0.2} />
              </mesh>
              <mesh position={[0, 2, 0]}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshStandardMaterial
                  color={facility.color}
                  emissive={facility.color}
                  emissiveIntensity={0.5}
                />
              </mesh>
            </>
          )}

          {facility.type === 'pump' && (
            <>
              <mesh position={[0, 1, 0]}>
                <boxGeometry args={[5, 2, 4]} />
                <meshStandardMaterial color="#FF7D00" metalness={0.4} roughness={0.4} />
              </mesh>
              <mesh position={[0, 2.5, 0]}>
                <boxGeometry args={[4, 1, 3]} />
                <meshStandardMaterial color="#FF9A2E" metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh position={[-1.5, 3.5, 0]}>
                <cylinderGeometry args={[0.4, 0.4, 2, 16]} />
                <meshStandardMaterial color="#86909C" metalness={0.7} roughness={0.2} />
              </mesh>
              <mesh position={[1.5, 3.5, 0]}>
                <cylinderGeometry args={[0.4, 0.4, 2, 16]} />
                <meshStandardMaterial color="#86909C" metalness={0.7} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <sphereGeometry args={[0.4, 16, 16]} />
                <meshStandardMaterial
                  color={facility.color}
                  emissive={facility.color}
                  emissiveIntensity={0.5}
                />
              </mesh>
            </>
          )}

          {facility.type === 'lowland' && (
            <>
              <mesh position={[0, -0.5, 0]}>
                <cylinderGeometry args={[4, 4.5, 1, 32]} />
                <meshStandardMaterial color="#9CA3AF" metalness={0.1} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.1, 0]}>
                <torusGeometry args={[3.5, 0.3, 8, 32]} />
                <meshStandardMaterial color="#717579" metalness={0.2} roughness={0.8} />
              </mesh>
              <mesh position={[0, 0.5, 0]}>
                <sphereGeometry args={[0.6, 16, 16]} />
                <meshStandardMaterial
                  color={facility.color}
                  emissive={facility.color}
                  emissiveIntensity={0.4}
                />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}
