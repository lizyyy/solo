import { useMemo } from 'react';
import * as THREE from 'three';
import { SPHERE_RADIUS } from '../../utils/hslCalculator';

interface AxesHelperProps {
  visible: boolean;
}

export function AxesHelper({ visible }: AxesHelperProps) {
  const axisLength = SPHERE_RADIUS * 1.2;
  const axisRadius = SPHERE_RADIUS * 1.15;

  const axes = useMemo(() => {
    return [
      {
        direction: new THREE.Vector3(1, 0, 0),
        color: 0xff6b6b,
        label: 'H',
        sublabel: '色相',
        position: new THREE.Vector3(axisLength, 0, 0)
      },
      {
        direction: new THREE.Vector3(0, 1, 0),
        color: 0x51cf66,
        label: 'L',
        sublabel: '明度',
        position: new THREE.Vector3(0, axisLength, 0)
      },
      {
        direction: new THREE.Vector3(0, 0, 1),
        color: 0x4dabf7,
        label: 'S',
        sublabel: '饱和度',
        position: new THREE.Vector3(0, 0, axisLength)
      }
    ];
  }, [axisLength]);

  const createAxisGeometry = (direction: THREE.Vector3, length: number) => {
    const geometry = new THREE.CylinderGeometry(0.015, 0.015, length, 8);
    geometry.translate(0, length / 2, 0);
    geometry.lookAt(direction);
    return geometry;
  };

  const createArrowGeometry = (direction: THREE.Vector3) => {
    const geometry = new THREE.ConeGeometry(0.04, 0.12, 8);
    geometry.translate(0, 0.06, 0);
    geometry.lookAt(direction);
    return geometry;
  };

  if (!visible) return null;

  return (
    <group>
      {axes.map((axis, idx) => (
        <group key={idx}>
          <mesh geometry={createAxisGeometry(axis.direction, axisLength * 0.95)}>
            <meshBasicMaterial color={axis.color} transparent opacity={0.6} />
          </mesh>
          
          <mesh 
            geometry={createArrowGeometry(axis.direction)}
            position={axis.direction.clone().multiplyScalar(axisLength * 0.95)}
          >
            <meshBasicMaterial color={axis.color} />
          </mesh>

          <group position={axis.direction.clone().multiplyScalar(axisRadius)}>
            <mesh>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshBasicMaterial color={axis.color} transparent opacity={0.2} />
            </mesh>
          </group>
        </group>
      ))}

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color={0xffffff} />
      </mesh>
    </group>
  );
}
