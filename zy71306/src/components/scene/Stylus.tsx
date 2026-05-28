import { useMemo } from 'react';

interface StylusProps {
  stylusPressure: number;
}

export default function Stylus({ stylusPressure }: StylusProps) {
  const pressureColor = useMemo(() => {
    if (stylusPressure > 2.5) return '#C41E3A';
    if (stylusPressure > 2.0) return '#FF6B35';
    if (stylusPressure < 1.2) return '#3B82F6';
    return '#2E7D32';
  }, [stylusPressure]);

  const glowIntensity = useMemo(() => {
    return 0.3 + (stylusPressure / 3) * 0.7;
  }, [stylusPressure]);

  const penetration = useMemo(() => {
    return ((stylusPressure - 0.5) / 2.5) * 0.02;
  }, [stylusPressure]);

  return (
    <group>
      <mesh position={[0, -0.02, 0]}>
        <coneGeometry args={[0.015, 0.04, 8]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      <mesh position={[0, -0.05 - penetration, 0]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.005, 0.025, 8]} />
        <meshStandardMaterial
          color="#8b4513"
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>

      <mesh position={[0, -0.065 - penetration, 0]}>
        <pointLight
          color={pressureColor}
          intensity={glowIntensity}
          distance={0.3}
        />
      </mesh>

      <mesh position={[0, -0.065 - penetration, 0]}>
        <sphereGeometry args={[0.008, 16, 16]} />
        <meshBasicMaterial
          color={pressureColor}
          transparent
          opacity={glowIntensity * 0.8}
        />
      </mesh>

      <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.03 + stylusPressure * 0.01, 0.002, 8, 32]} />
        <meshBasicMaterial
          color={pressureColor}
          transparent
          opacity={glowIntensity * 0.3}
        />
      </mesh>
    </group>
  );
}
