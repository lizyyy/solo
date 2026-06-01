import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointData } from '../../types';

interface CrossFloorLinkProps {
  point1: PointData;
  point2: PointData;
  visible: boolean;
}

export const CrossFloorLink: React.FC<CrossFloorLinkProps> = ({ point1, point2, visible }) => {
  const tubeRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (tubeRef.current) {
      const mat = tubeRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.4 + Math.sin(timeRef.current * 2) * 0.2;
    }
  });

  if (!visible) return null;

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(point1.position.x, point1.position.y + 0.5, point1.position.z),
    new THREE.Vector3(
      (point1.position.x + point2.position.x) / 2,
      (point1.position.y + point2.position.y) / 2 + 2,
      (point1.position.z + point2.position.z) / 2
    ),
    new THREE.Vector3(point2.position.x, point2.position.y + 0.5, point2.position.z),
  ]);

  const tubeGeometry = new THREE.TubeGeometry(curve, 32, 0.08, 8, false);

  return (
    <mesh ref={tubeRef} geometry={tubeGeometry}>
      <meshBasicMaterial
        color="#EF4444"
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
