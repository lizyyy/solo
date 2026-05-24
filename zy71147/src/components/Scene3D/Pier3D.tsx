
import React from 'react';
import * as THREE from 'three';
import { Pier } from '../../types';

interface Pier3DProps {
  pier: Pier;
}

export const Pier3D: React.FC<Pier3DProps> = ({ pier }) => {
  return (
    <group position={[pier.position.x, pier.position.y, pier.position.z]}>
      <mesh castShadow receiveShadow position={[0, pier.dimensions.height / 2, 0]}>
        <boxGeometry args={[pier.dimensions.width, pier.dimensions.height, pier.dimensions.depth]} />
        <meshStandardMaterial
          color="#8B7355"
          metalness={0.1}
          roughness={0.9}
        />
      </mesh>

      <mesh position={[0, pier.dimensions.height + 0.1, 0]}>
        <cylinderGeometry args={[pier.dimensions.width * 0.4, pier.dimensions.width * 0.5, 0.2, 8]} />
        <meshStandardMaterial color="#A0522D" />
      </mesh>

      <lineSegments position={[0, pier.dimensions.height / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(pier.dimensions.width, pier.dimensions.height, pier.dimensions.depth)]} />
        <lineBasicMaterial color="#5D4037" />
      </lineSegments>
    </group>
  );
};

