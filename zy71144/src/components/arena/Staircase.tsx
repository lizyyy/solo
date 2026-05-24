import { useMemo } from 'react';
import type { Staircase as StaircaseType } from '../../types';

interface StaircaseProps {
  staircase: StaircaseType;
  visible?: boolean;
  onClick?: (position: { x: number; y: number; z: number }) => void;
}

export function Staircase({
  staircase,
  visible = true,
  onClick,
}: StaircaseProps) {
  const steps = useMemo(() => {
    const totalHeight = staircase.endPoint.y - staircase.startPoint.y;
    const stepHeight = 0.2;
    const stepCount = Math.floor(totalHeight / stepHeight);
    const stepDepth = 0.25;

    return Array.from({ length: stepCount }, (_, i) => ({
      y: staircase.startPoint.y + i * stepHeight + stepHeight / 2,
      zOffset: i * stepDepth,
      height: stepHeight,
    }));
  }, [staircase]);

  if (!visible) return null;

  return (
    <group
      position={[staircase.startPoint.x, 0, staircase.startPoint.z]}
      onClick={() =>
        onClick?.({
          x: staircase.startPoint.x,
          y: (staircase.startPoint.y + staircase.endPoint.y) / 2,
          z: staircase.startPoint.z,
        })
      }
    >
      {steps.map((step, i) => (
        <mesh
          key={i}
          position={[0, step.y, step.zOffset]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.5, step.height, 0.5]} />
          <meshStandardMaterial
            color="#64748b"
            metalness={0.2}
            roughness={0.7}
          />
        </mesh>
      ))}

      <mesh
        position={[
          -1.5,
          (staircase.startPoint.y + staircase.endPoint.y) / 2,
          steps.length * 0.125,
        ]}
        castShadow
      >
        <boxGeometry
          args={[0.15, staircase.endPoint.y - staircase.startPoint.y + 1, steps.length * 0.25 + 1]}
        />
        <meshStandardMaterial
          color="#475569"
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      <mesh
        position={[
          1.5,
          (staircase.startPoint.y + staircase.endPoint.y) / 2,
          steps.length * 0.125,
        ]}
        castShadow
      >
        <boxGeometry
          args={[0.15, staircase.endPoint.y - staircase.startPoint.y + 1, steps.length * 0.25 + 1]}
        />
        <meshStandardMaterial
          color="#475569"
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      <mesh
        position={[0, staircase.endPoint.y + 0.1, steps.length * 0.25 + 1]}
        receiveShadow
      >
        <boxGeometry args={[2.5, 0.2, 2]} />
        <meshStandardMaterial
          color="#64748b"
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>
    </group>
  );
}
