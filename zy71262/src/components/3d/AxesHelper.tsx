import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface AxesHelperProps {
  showLabels?: boolean;
}

export function AxesHelper({ showLabels = true }: AxesHelperProps) {
  const axisLength = 0.7;
  const labelOffset = 0.1;

  return (
    <group>
      <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.5, -0.5, -0.5), axisLength, '#ef4444', 0.05, 0.03]} />
      
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.5, -0.5, -0.5), axisLength, '#22c55e', 0.05, 0.03]} />
      
      <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.5, -0.5, -0.5), axisLength, '#3b82f6', 0.05, 0.03]} />

      {showLabels && (
        <>
          <Text
            position={[axisLength / 2 + labelOffset, -0.5, -0.5]}
            fontSize={0.05}
            color="#ef4444"
            anchorX="center"
            anchorY="middle"
          >
            配方
          </Text>
          <Text
            position={[-0.5, axisLength / 2 + labelOffset, -0.5]}
            fontSize={0.05}
            color="#22c55e"
            anchorX="center"
            anchorY="middle"
          >
            透明度
          </Text>
          <Text
            position={[-0.5, -0.5, axisLength / 2 + labelOffset]}
            fontSize={0.05}
            color="#3b82f6"
            anchorX="center"
            anchorY="middle"
          >
            耐光
          </Text>
        </>
      )}
    </group>
  );
}
