import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThermalStore } from '@/store/useThermalStore';
import { useView3DStore } from '@/store/useView3DStore';
import { getTemperatureColor } from '@/utils/colorMapping';

export const TempSensorMarker = () => {
  const groupRef = useRef<THREE.Group>(null);
  const chipPackage = useThermalStore((state) => state.chipPackage);
  const filterConditions = useThermalStore((state) => state.filterConditions);
  const selectedItem = useThermalStore((state) => state.selectedItem);
  const setSelectedItem = useThermalStore((state) => state.setSelectedItem);
  const { showSensors, colorScale } = useView3DStore();
  
  const sensors = useMemo(() => {
    return chipPackage.tempSensors.filter(s => {
      if (s.isMissing) return true;
      const tempInRange = s.temperature >= filterConditions.tempRange[0] && 
                         s.temperature <= filterConditions.tempRange[1];
      const anomalyFilter = !filterConditions.showOnlyAnomalies || s.isMissing;
      return tempInRange && anomalyFilter;
    });
  }, [chipPackage.tempSensors, filterConditions]);

  useFrame((state) => {
    if (!groupRef.current || !showSensors) return;
    
    const time = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const sensor = chipPackage.tempSensors[i];
      if (!sensor) return;
      
      if (sensor.isMissing) {
        child.rotation.y += 0.02;
        const pulse = 1 + Math.sin(time * 3) * 0.1;
        child.scale.setScalar(pulse);
      }
    });
  });

  if (!showSensors) return null;

  return (
    <group ref={groupRef}>
      {sensors.map((sensor) => (
        <group
          key={sensor.id}
          position={[sensor.position.x, sensor.position.y + 0.15, sensor.position.z]}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItem(sensor.id, 'sensor');
          }}
        >
          {sensor.isMissing ? (
            <group>
              <mesh>
                <ringGeometry args={[0.08, 0.12, 16]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.08, 0.12, 16]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.15, 8]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
              <mesh position={[0, 0.32, 0]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </group>
          ) : (
            <group>
              <mesh>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial 
                  color={getTemperatureColor(sensor.temperature, colorScale.min, colorScale.max)}
                  emissive={getTemperatureColor(sensor.temperature, colorScale.min, colorScale.max)}
                  emissiveIntensity={0.2}
                  metalness={0.3}
                  roughness={0.5}
                />
              </mesh>
              
              {selectedItem === sensor.id && (
                <mesh position={[0, 0, 0]}>
                  <ringGeometry args={[0.12, 0.15, 32]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          )}
        </group>
      ))}
    </group>
  );
};
