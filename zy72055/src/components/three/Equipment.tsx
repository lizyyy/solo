import { useMemo } from 'react';
import * as THREE from 'three';
import type { InspectionRecord } from '../../types';

interface EquipmentProps {
  records: InspectionRecord[];
}

export function Equipment({ records }: EquipmentProps) {
  const equipmentPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; z: number; type: string }>();
    
    records.forEach(record => {
      const key = record.deviceName;
      if (!map.has(key)) {
        map.set(key, {
          x: record.x,
          y: record.y,
          z: record.z,
          type: record.deviceType || 'unknown',
        });
      }
    });
    
    return Array.from(map.entries()).map(([name, pos]) => ({ name, ...pos }));
  }, [records]);
  
  const towerMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      metalness: 0.5,
      roughness: 0.5,
    });
  }, []);
  
  const craneMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#60a5fa',
      metalness: 0.4,
      roughness: 0.6,
    });
  }, []);
  
  const defaultMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#a78bfa',
      metalness: 0.3,
      roughness: 0.7,
    });
  }, []);
  
  const getMaterial = (type: string) => {
    if (type.includes('塔吊') || type.includes('tower')) return towerMaterial;
    if (type.includes('起重机') || type.includes('crane')) return craneMaterial;
    return defaultMaterial;
  };
  
  const getSize = (type: string): [number, number, number] => {
    if (type.includes('塔吊') || type.includes('tower')) return [1.5, 6, 1.5];
    if (type.includes('起重机') || type.includes('crane')) return [2, 2, 3];
    return [1, 1, 1];
  };
  
  return (
    <group>
      {equipmentPositions.map((eq, i) => {
        const [w, h, d] = getSize(eq.type);
        return (
          <group key={`eq-${i}`} position={[eq.x, eq.y + h / 2, eq.z]}>
            <mesh
              position={[0, 0, 0]}
              material={getMaterial(eq.type)}
              castShadow
            >
              <boxGeometry args={[w, h, d]} />
            </mesh>
            
            <mesh position={[0, h / 2 + 0.3, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
            </mesh>
            
            <mesh position={[0, h / 2 + 0.6, 0]}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
