import { useMemo } from 'react';
import * as THREE from 'three';

interface Grid3DProps {
  size: { x: number; y: number; z: number };
}

export const Grid3D = ({ size }: Grid3DProps) => {
  const gridHelperX = useMemo(() => {
    return new THREE.GridHelper(size.x, 10, 0x4a3728, 0x3a2718);
  }, [size.x]);

  const gridHelperZ = useMemo(() => {
    const grid = new THREE.GridHelper(size.z, 10, 0x4a3728, 0x3a2718);
    grid.rotation.x = Math.PI / 2;
    return grid;
  }, [size.z]);

  const edgesGeometry = useMemo(() => {
    const geometry = new THREE.BoxGeometry(size.x, size.z, size.y);
    return new THREE.EdgesGeometry(geometry);
  }, [size]);

  const edgesMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({ color: 0x8b7355, linewidth: 2 });
  }, []);

  return (
    <group>
      <primitive
        object={gridHelperX}
        position={[size.x / 2, 0, size.y / 2]}
      />
      <primitive
        object={gridHelperZ}
        position={[size.x / 2, size.z / 2, 0]}
      />
      <lineSegments
        geometry={edgesGeometry}
        material={edgesMaterial}
        position={[size.x / 2, size.z / 2, size.y / 2]}
      />
      <mesh position={[size.x / 2, 0, size.y / 2]}>
        <planeGeometry args={[size.x, size.y]} />
        <meshStandardMaterial
          color="#2d1f14"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
