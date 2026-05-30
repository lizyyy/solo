import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StressPoint } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface StressCloudProps {
  stressPoints: StressPoint[];
}

export function StressCloud({ stressPoints }: StressCloudProps) {
  const groupRef = useRef<THREE.Group>(null);
  const selectedObject = useAppStore((state) => state.selectedObject);
  const selectObject = useAppStore((state) => state.selectObject);

  const pointData = useMemo(() => {
    return stressPoints.map((point) => {
      let color = '#00b42a';
      let size = 0.3;

      switch (point.level) {
        case 'low':
          color = '#52c41a';
          size = 0.25;
          break;
        case 'medium':
          color = '#faad14';
          size = 0.35;
          break;
        case 'high':
          color = '#fa8c16';
          size = 0.45;
          break;
        case 'critical':
          color = '#f5222d';
          size = 0.6;
          break;
      }

      return {
        point,
        color,
        size,
        isSelected: selectedObject?.type === 'stress' && selectedObject.id === point.id,
      };
    });
  }, [stressPoints, selectedObject]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const data = pointData[i];
        if (!data) return;

        const pulse = Math.sin(state.clock.elapsedTime * 1.5 + i * 0.3) * 0.1 + 1;

        if (data.isSelected) {
          child.scale.setScalar(pulse * 1.5);
        } else if (data.point.level === 'critical') {
          child.scale.setScalar(pulse * 1.2);
        }
      });
    }
  });

  const handlePointClick = (point: StressPoint) => {
    selectObject({ type: 'stress', id: point.id });
  };

  return (
    <group ref={groupRef}>
      {pointData.map(({ point, color, size, isSelected }) => (
        <group key={point.id} position={point.position}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              handlePointClick(point);
            }}
          >
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial
              color={isSelected ? '#ffffff' : color}
              emissive={color}
              emissiveIntensity={isSelected ? 0.6 : 0.3}
              transparent
              opacity={0.8}
            />
          </mesh>

          <mesh>
            <sphereGeometry args={[size * 1.5, 8, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.2}
              wireframe
            />
          </mesh>

          {isSelected && (
            <mesh>
              <ringGeometry args={[size * 1.8, size * 2.2, 32]} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={0.5}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
