import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

export function WindIndicator() {
  const environment = useStore((state) => state.environment);
  const field = useStore((state) => state.field);

  const { windSpeed, windDirection } = environment;

  const arrowRotation = useMemo(() => {
    return [0, (windDirection * Math.PI) / 180, 0] as [number, number, number];
  }, [windDirection]);

  const arrowLength = useMemo(() => {
    return 2 + windSpeed * 0.5;
  }, [windSpeed]);

  const position: [number, number, number] = [
    -field.width / 2 - 5,
    3,
    -field.height / 2 - 5,
  ];

  if (windSpeed === 0) return null;

  return (
    <group position={position}>
      <mesh rotation={arrowRotation}>
        <coneGeometry args={[0.5, arrowLength, 8]} />
        <meshBasicMaterial color={0x66ccff} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, -arrowLength / 2 - 0.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1, 8]} />
        <meshBasicMaterial color={0x66ccff} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, -arrowLength - 1, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.2, 16]} />
        <meshBasicMaterial color={0x666666} />
      </mesh>
    </group>
  );
}
