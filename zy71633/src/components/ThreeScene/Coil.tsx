import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTemperatureColor } from '../../physics/simulation';

interface CoilProps {
  position: [number, number, number];
  current: number;
  maxCurrent: number;
  temperature: number;
  isHighlighted?: boolean;
  isActive?: boolean;
}

export function Coil({ position, current, maxCurrent, temperature, isHighlighted, isActive }: CoilProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const tempColor = getTemperatureColor(temperature);
  const currentIntensity = Math.min(current / maxCurrent, 1);
  const glowColor = isActive ? '#00d4ff' : '#334455';

  const coilPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const turns = 8;
    const radius = 0.08;
    const height = 0.15;

    for (let i = 0; i <= turns * 32; i++) {
      const t = i / (turns * 32);
      const angle = t * turns * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          (t - 0.5) * height,
          Math.sin(angle) * radius
        )
      );
    }
    return points;
  }, []);

  const tubeGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(coilPoints);
    return new THREE.TubeGeometry(curve, 200, 0.008, 8, false);
  }, [coilPoints]);

  useFrame(() => {
    if (glowRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
      glowRef.current.scale.setScalar(pulse * currentIntensity * 0.5 + 0.8);
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 * currentIntensity;
    }
    if (groupRef.current && isHighlighted) {
      groupRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.01) * 0.03);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color={tempColor}
          metalness={0.9}
          roughness={0.1}
          emissive={isHighlighted ? '#00d4ff' : '#000000'}
          emissiveIntensity={isHighlighted ? 0.2 : 0}
        />
      </mesh>

      <mesh ref={glowRef}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.3 * currentIntensity}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0.12, 0]}>
        <ringGeometry args={[0.02, 0.025, 16]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.8 * currentIntensity} />
      </mesh>
    </group>
  );
}
