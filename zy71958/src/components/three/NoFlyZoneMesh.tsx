import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { NoFlyZone, Coordinate } from '../../types';
import { coordToVector3 } from '../../utils/geo';

interface NoFlyZoneMeshProps {
  zone: NoFlyZone;
  center: Coordinate;
  highlighted?: boolean;
}

export function NoFlyZoneMesh({ zone, center, highlighted = false }: NoFlyZoneMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);

  const position = useMemo(() => {
    const [x, , z] = coordToVector3(zone.center, center, 500);
    return [x, (zone.maxAlt + zone.minAlt) / 20, z] as [number, number, number];
  }, [zone, center]);

  const height = (zone.maxAlt - zone.minAlt) / 10;
  const radius = zone.radius / 500;

  useFrame((state) => {
    if (meshRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      meshRef.current.scale.setScalar(highlighted ? pulse * 1.1 : pulse);
    }
    if (edgesRef.current) {
      edgesRef.current.position.y = position[1];
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[radius, radius, height, 32, 1, true]} />
        <meshBasicMaterial
          color={highlighted ? '#EF4444' : '#DC2626'}
          transparent
          opacity={highlighted ? 0.3 : 0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.9, radius, 32]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.9, radius, 32]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, -height / 2 - 0.2, 0]}
        fontSize={0.15}
        color="#EF4444"
        anchorX="center"
        anchorY="middle"
      >
        {zone.name}
      </Text>
    </group>
  );
}
