import { Line } from '@react-three/drei';
import * as THREE from 'three';

export function CubeFrame() {
  const size = 1;
  const half = size / 2;

  const edges = [
    [[-half, -half, -half], [half, -half, -half]],
    [[half, -half, -half], [half, half, -half]],
    [[half, half, -half], [-half, half, -half]],
    [[-half, half, -half], [-half, -half, -half]],
    [[-half, -half, half], [half, -half, half]],
    [[half, -half, half], [half, half, half]],
    [[half, half, half], [-half, half, half]],
    [[-half, half, half], [-half, -half, half]],
    [[-half, -half, -half], [-half, -half, half]],
    [[half, -half, -half], [half, -half, half]],
    [[half, half, -half], [half, half, half]],
    [[-half, half, -half], [-half, half, half]],
  ];

  return (
    <group>
      {edges.map((edge, i) => (
        <Line
          key={i}
          points={[new THREE.Vector3(...edge[0]), new THREE.Vector3(...edge[1])]}
          color="#4a5568"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </group>
  );
}
