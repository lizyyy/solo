import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';

const CustomAxesHelper = ({ size = 15 }) => {
  const axisLabels = [
    { label: '五度圈 (X)', position: [size + 1, 0, 0], color: '#ff6b6b' },
    { label: '功能层级 (Y)', position: [0, size + 1, 0], color: '#4ecdc4' },
    { label: '调式亮度 (Z)', position: [0, 0, size + 1], color: '#ffe66d' },
  ];

  return (
    <group>
      <Line
        points={[[-size, 0, 0], [size, 0, 0]]}
        color="#ff6b6b"
        lineWidth={1}
        transparent
        opacity={0.5}
      />
      <Line
        points={[[0, -size / 2, 0], [0, size / 2, 0]]}
        color="#4ecdc4"
        lineWidth={1}
        transparent
        opacity={0.5}
      />
      <Line
        points={[[0, 0, -size], [0, 0, size]]}
        color="#ffe66d"
        lineWidth={1}
        transparent
        opacity={0.5}
      />

      <mesh position={[size, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 8]} />
        <meshBasicMaterial color="#ff6b6b" />
      </mesh>
      <mesh position={[0, size / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.3, 0.8, 8]} />
        <meshBasicMaterial color="#4ecdc4" />
      </mesh>
      <mesh position={[0, 0, size]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.8, 8]} />
        <meshBasicMaterial color="#ffe66d" />
      </mesh>

      {axisLabels.map((axis) => (
        <Text
          key={axis.label}
          position={axis.position as [number, number, number]}
          fontSize={0.6}
          color={axis.color}
          anchorX="center"
          anchorY="middle"
        >
          {axis.label}
        </Text>
      ))}

      {[-10, -5, 0, 5, 10].map((tick) => (
        <group key={`x-tick-${tick}`}>
          <Line
            points={[[tick, -0.2, 0], [tick, 0.2, 0]]}
            color="#ff6b6b"
            lineWidth={1}
            transparent
            opacity={0.4}
          />
          <Text
            position={[tick, -0.8, 0]}
            fontSize={0.4}
            color="#ff6b6b"
            anchorX="center"
            anchorY="middle"
          >
            {tick}
          </Text>
        </group>
      ))}
    </group>
  );
};

export default CustomAxesHelper;
