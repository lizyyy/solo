import { useMemo } from 'react';
import type { SectionParams } from '@/types';

interface SectionPlaneProps {
  params: SectionParams;
  dimensions: { width: number; height: number; depth: number };
}

export function SectionPlane({ params, dimensions }: SectionPlaneProps) {
  const planeProps = useMemo(() => {
    const { width, height, depth } = dimensions;
    const size = Math.max(width, height, depth) * 1.2;

    switch (params.axis) {
      case 'x':
        return {
          position: [params.position, 0, 0] as [number, number, number],
          rotation: [0, Math.PI / 2, 0] as [number, number, number],
          args: [size, size] as [number, number],
        };
      case 'y':
        return {
          position: [0, params.position, 0] as [number, number, number],
          rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
          args: [size, size] as [number, number],
        };
      case 'z':
        return {
          position: [0, 0, params.position] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          args: [size, size] as [number, number],
        };
      default:
        return {
          position: [0, 0, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          args: [size, size] as [number, number],
        };
    }
  }, [params.axis, params.position, dimensions]);

  if (!params.showCutSurface) return null;

  return (
    <mesh position={planeProps.position} rotation={planeProps.rotation}>
      <planeGeometry args={planeProps.args} />
      <meshBasicMaterial
        color="#B8860B"
        transparent
        opacity={0.15}
        side={2}
        depthWrite={false}
      />
      <meshBasicMaterial
        color="#DAA520"
        transparent
        opacity={0.5}
        side={2}
        wireframe
      />
    </mesh>
  );
}
