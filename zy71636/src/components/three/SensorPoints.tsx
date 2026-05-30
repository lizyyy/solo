import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Sensor } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface SensorPointsProps {
  sensors: Sensor[];
}

export function SensorPoints({ sensors }: SensorPointsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const selectedObject = useAppStore((state) => state.selectedObject);
  const selectObject = useAppStore((state) => state.selectObject);

  const sensorData = useMemo(() => {
    return sensors.map((sensor) => {
      let color = '#00b42a';
      if (sensor.status === 'warning') color = '#ff7d00';
      if (sensor.status === 'alarm') color = '#f53f3f';
      if (sensor.status === 'offline') color = '#86909c';

      const typeColors: Record<string, string> = {
        seepage: '#165dff',
        stress: '#722ed1',
        displacement: '#13c2c2',
      };

      return {
        sensor,
        color,
        typeColor: typeColors[sensor.type] || '#165dff',
        isSelected: selectedObject?.type === 'sensor' && selectedObject.id === sensor.id,
      };
    });
  }, [sensors, selectedObject]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const data = sensorData[i];
        if (!data) return;

        const pulse = Math.sin(state.clock.elapsedTime * 2 + i) * 0.1 + 1;

        if (data.isSelected) {
          child.scale.setScalar(pulse * 1.3);
        } else if (data.sensor.hasBreakpoint || data.sensor.status === 'alarm') {
          child.scale.setScalar(pulse * 1.1);
        }
      });
    }
  });

  const handleSensorClick = (sensor: Sensor) => {
    selectObject({ type: 'sensor', id: sensor.id });
  };

  return (
    <group ref={groupRef}>
      {sensorData.map(({ sensor, color, typeColor, isSelected }) => (
        <group key={sensor.id} position={sensor.position}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              handleSensorClick(sensor);
            }}
          >
            <cylinderGeometry args={[0.3, 0.5, 1.2, 8]} />
            <meshStandardMaterial
              color={isSelected ? '#ffffff' : color}
              emissive={color}
              emissiveIntensity={isSelected ? 0.5 : 0.2}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>

          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial
              color={typeColor}
              emissive={typeColor}
              emissiveIntensity={0.3}
            />
          </mesh>

          {sensor.hasBreakpoint && (
            <mesh position={[0.6, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.15, 0.25, 16]} />
              <meshBasicMaterial color="#ffff00" side={THREE.DoubleSide} />
            </mesh>
          )}

          <mesh position={[0, 1.5, 0]}>
            <planeGeometry args={[2, 0.5]} />
            <meshBasicMaterial color="#1d2129" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
