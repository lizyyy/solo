import { useRef } from 'react';
import * as THREE from 'three';
import type { Point3D } from '../../types';

interface GroundPlaneProps {
  size: { width: number; depth: number };
  onClick?: (position: Point3D) => void;
  onHover?: (position: Point3D | null) => void;
  visible?: boolean;
}

export function GroundPlane({
  size,
  onClick,
  onHover,
  visible = true,
}: GroundPlaneProps) {
  const planeRef = useRef<THREE.Mesh>(null);

  const handleClick = (e: { point: THREE.Vector3 }) => {
    onClick?.({
      x: Math.round(e.point.x * 2) / 2,
      y: 0.5,
      z: Math.round(e.point.z * 2) / 2,
    });
  };

  const handlePointerMove = (e: { point: THREE.Vector3 }) => {
    onHover?.({
      x: Math.round(e.point.x * 2) / 2,
      y: 0,
      z: Math.round(e.point.z * 2) / 2,
    });
  };

  const handlePointerLeave = () => {
    onHover?.(null);
  };

  return (
    <group>
      <mesh
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        receiveShadow
      >
        <planeGeometry args={[size.width, size.depth]} />
        <meshStandardMaterial
          color="#1e293b"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {visible && (
        <gridHelper
          args={[
            Math.max(size.width, size.depth),
            Math.max(size.width, size.depth) / 2,
            '#334155',
            '#1e293b',
          ]}
        />
      )}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[size.width, size.depth]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.1}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}
