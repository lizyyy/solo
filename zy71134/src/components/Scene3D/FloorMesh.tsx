import * as THREE from 'three';
import React, { useMemo } from 'react';

interface FloorMeshProps {
  floorLevel: number;
  isSelected: boolean;
}

export const FloorMesh: React.FC<FloorMeshProps> = ({ floorLevel, isSelected }) => {
  const yOffset = (floorLevel - 1) * 8;

  const floorGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-15, -10);
    shape.lineTo(15, -10);
    shape.lineTo(15, 10);
    shape.lineTo(-15, 10);
    shape.lineTo(-15, -10);

    const hole = new THREE.Path();
    hole.moveTo(-2, -8);
    hole.lineTo(2, -8);
    hole.lineTo(2, 8);
    hole.lineTo(-2, 8);
    hole.lineTo(-2, -8);
    shape.holes.push(hole);

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.3,
      bevelEnabled: false,
    });
  }, []);

  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: isSelected ? '#E6F4FF' : '#F5F7FA',
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    [isSelected]
  );

  return (
    <group position={[0, yOffset, 0]}>
      <mesh
        geometry={floorGeometry}
        material={wallMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      />
      <mesh position={[0, 1.5, -9.85]} receiveShadow>
        <boxGeometry args={[30, 3, 0.3]} />
        <meshStandardMaterial color={isSelected ? '#D6E8FF' : '#E8EDF2'} />
      </mesh>
      <mesh position={[0, 1.5, 9.85]} receiveShadow>
        <boxGeometry args={[30, 3, 0.3]} />
        <meshStandardMaterial color={isSelected ? '#D6E8FF' : '#E8EDF2'} />
      </mesh>
      <mesh position={[-14.85, 1.5, 0]} receiveShadow>
        <boxGeometry args={[0.3, 3, 20]} />
        <meshStandardMaterial color={isSelected ? '#D6E8FF' : '#E8EDF2'} />
      </mesh>
      <mesh position={[14.85, 1.5, 0]} receiveShadow>
        <boxGeometry args={[0.3, 3, 20]} />
        <meshStandardMaterial color={isSelected ? '#D6E8FF' : '#E8EDF2'} />
      </mesh>
    </group>
  );
};

export default FloorMesh;
