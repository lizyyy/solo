import { ReactNode, useMemo } from 'react';
import * as THREE from 'three';
import { AntiSkatingDirection } from '../../types/calibration';

interface TonearmProps {
  stylusPressure: number;
  antiSkating: number;
  antiSkatingDirection: AntiSkatingDirection;
  tonearmLength: number;
  children?: ReactNode;
}

export default function Tonearm({
  stylusPressure,
  antiSkating,
  antiSkatingDirection,
  tonearmLength,
  children,
}: TonearmProps) {
  const normalizedLength = useMemo(() => {
    return ((tonearmLength - 200) / 100) * 0.3 + 1.5;
  }, [tonearmLength]);

  const pressureBend = useMemo(() => {
    return ((stylusPressure - 0.5) / 2.5) * 0.15;
  }, [stylusPressure]);

  const antiSkatingOffset = useMemo(() => {
    const direction = antiSkatingDirection === 'reverse' ? -1 : 1;
    return antiSkating * 0.05 * direction;
  }, [antiSkating, antiSkatingDirection]);

  const rotationY = useMemo(() => {
    return -0.5 + antiSkatingOffset;
  }, [antiSkatingOffset]);

  const headshellOffset = {
    x: Math.sin(rotationY) * normalizedLength,
    z: Math.cos(rotationY) * normalizedLength - 1,
  };

  return (
    <group>
      <mesh position={[0, 0.2, 0]} rotation={[0, rotationY, 0]}>
        <mesh position={[normalizedLength / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.025, normalizedLength, 16]} />
          <meshStandardMaterial
            color="#c0c0c0"
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>

        <mesh position={[normalizedLength + 0.1, -0.05 - pressureBend, 0]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.12, 0.08, 0.06]} />
          <meshStandardMaterial
            color="#1a1a1a"
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>

        <group position={[normalizedLength + 0.1, -0.1 - pressureBend, 0]} rotation={[0.3, 0, 0]}>
          {children}
        </group>

        <mesh position={[-0.05, 0.05, 0]} rotation={[0, rotationY, 0.5 + pressureBend * 2]}>
          <boxGeometry args={[0.3, 0.04, 0.08]} />
          <meshStandardMaterial
            color="#d4af37"
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>

        <mesh position={[0.2, 0.1, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.2, 16]} />
          <meshStandardMaterial
            color="#8b7355"
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>
      </mesh>

      <group position={[headshellOffset.x, 0.3, headshellOffset.z]}>
        <mesh rotation={[Math.PI / 2, 0, rotationY + antiSkatingOffset * 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
          <meshBasicMaterial
            color={antiSkatingDirection === 'reverse' ? '#C41E3A' : '#D4AF37'}
            transparent
            opacity={0.8}
          />
        </mesh>

        <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, rotationY]}>
          <cylinderGeometry args={[0.008, 0.008, 0.1 + antiSkating * 0.05, 8]} />
          <meshBasicMaterial
            color={antiSkatingDirection === 'reverse' ? '#C41E3A' : '#3B82F6'}
            transparent
            opacity={0.6}
          />
        </mesh>
      </group>

      {antiSkatingDirection === 'reverse' && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#C41E3A" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
