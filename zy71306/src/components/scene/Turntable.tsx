import { ReactNode } from 'react';
import * as THREE from 'three';

interface TurntableProps {
  children?: ReactNode;
}

export default function Turntable({ children }: TurntableProps) {
  const baseWidth = 3.5;
  const baseDepth = 2.8;
  const baseHeight = 0.3;
  const platterRadius = 1.5;
  const platterHeight = 0.1;

  const tonearmMountX = -1.2;
  const tonearmMountZ = 1.0;

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[baseWidth, baseHeight, baseDepth]} />
        <meshStandardMaterial
          color="#5d3a1a"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      <mesh position={[0, baseHeight + 0.01, 0]}>
        <boxGeometry args={[baseWidth - 0.1, 0.02, baseDepth - 0.1]} />
        <meshStandardMaterial
          color="#3d2410"
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[0, baseHeight + platterHeight / 2 + 0.02, 0]} castShadow>
        <cylinderGeometry args={[platterRadius, platterRadius, platterHeight, 64]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      <mesh position={[0, baseHeight + platterHeight + 0.001, 0]}>
        <cylinderGeometry args={[platterRadius - 0.05, platterRadius - 0.05, 0.02, 64]} />
        <meshStandardMaterial
          color="#d4af37"
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>

      <mesh position={[0, baseHeight + platterHeight + 0.022, 0]}>
        <cylinderGeometry args={[platterRadius - 0.08, platterRadius - 0.08, 0.002, 64]} />
        <meshStandardMaterial
          color="#2a2a2a"
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      <group position={[tonearmMountX, baseHeight, tonearmMountZ]}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.18, 0.3, 32]} />
          <meshStandardMaterial
            color="#8b7355"
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>

        <mesh position={[0, 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.04, 32]} />
          <meshStandardMaterial
            color="#d4af37"
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        <mesh position={[0, 0.36, 0]} castShadow>
          <sphereGeometry args={[0.08, 32, 32]} />
          <meshStandardMaterial
            color="#c0c0c0"
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>

        <group position={[0, 0.36, 0]} name="tonearm-pivot">
          {children}
        </group>
      </group>

      <mesh position={[1.3, baseHeight + 0.06, -0.8]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.12, 32]} />
        <meshStandardMaterial
          color="#333333"
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      <mesh position={[1.3, baseHeight + 0.125, -0.8]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.01, 32]} />
        <meshStandardMaterial
          color="#d4af37"
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      <mesh position={[-1.3, baseHeight + 0.06, -0.8]} castShadow>
        <boxGeometry args={[0.15, 0.12, 0.4]} />
        <meshStandardMaterial
          color="#2a2a2a"
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>

      <mesh position={[-1.3, baseHeight + 0.125, -0.8]} castShadow>
        <boxGeometry args={[0.13, 0.01, 0.38]} />
        <meshStandardMaterial
          color="#d4af37"
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[baseWidth + 0.2, 0.02, baseDepth + 0.2]} />
        <meshStandardMaterial
          color="#4a2c10"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {[[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.2], [1.5, 1.2]].map(([x, z], i) => (
        <mesh key={`foot-${i}`} position={[x, 0.04, z]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.08, 16]} />
          <meshStandardMaterial
            color="#1a1a1a"
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}
