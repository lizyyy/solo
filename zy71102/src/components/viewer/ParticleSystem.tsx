import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Passenger, PassengerStatus } from '../../simulation/types';

interface ParticleSystemProps {
  passengers: Passenger[];
  stationWidth: number;
  stationHeight: number;
  is2DMode: boolean;
}

const getStatusColor = (status: PassengerStatus): THREE.Color => {
  switch (status) {
    case 'moving':
      return new THREE.Color('#2ecc71');
    case 'waiting':
      return new THREE.Color('#f39c12');
    case 'stuck':
      return new THREE.Color('#e74c3c');
    case 'exited':
      return new THREE.Color('#3498db');
    default:
      return new THREE.Color('#95a5a6');
  }
};

export const ParticleSystem: React.FC<ParticleSystemProps> = ({
  passengers,
  stationWidth,
  stationHeight,
  is2DMode
}) => {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particleHeight = is2DMode ? 0.05 : 0.3;

  const activePassengers = passengers.filter(p => p.status !== 'exited');

  useFrame(() => {
    if (!instancedMeshRef.current) return;

    activePassengers.forEach((passenger, index) => {
      const x = passenger.x - stationWidth / 2;
      const z = passenger.y - stationHeight / 2;
      const y = is2DMode ? 0.03 : particleHeight / 2;

      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      instancedMeshRef.current!.setMatrixAt(index, dummy.matrix);
      
      const color = getStatusColor(passenger.status);
      instancedMeshRef.current!.setColorAt(index, color);
    });

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    if (instancedMeshRef.current.instanceColor) {
      instancedMeshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (activePassengers.length === 0) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[undefined, undefined, activePassengers.length]}
    >
      <sphereGeometry args={[0.25, 8, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
};
