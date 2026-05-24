import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Pipeline } from '@/types';

interface PipelineMeshProps {
  pipeline: Pipeline;
  floorLevel: number;
  isHighlighted: boolean;
}

export const PipelineMesh: React.FC<PipelineMeshProps> = ({
  pipeline,
  floorLevel,
  isHighlighted,
}) => {
  const yOffset = (floorLevel - 1) * 8;
  const flowRef = useRef<THREE.MeshStandardMaterial>(null);

  const { tubeGeometry, material } = useMemo(() => {
    const points = pipeline.path.map(
      (p) => new THREE.Vector3(p.x, p.y + yOffset, p.z)
    );
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const geometry = new THREE.TubeGeometry(curve, 64, 0.15, 8, false);

    let color = '#165DFF';
    if (pipeline.status === 'maintenance') {
      color = '#FAAD14';
    } else if (pipeline.status === 'fault') {
      color = '#F53F3F';
    }

    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.8,
      roughness: 0.2,
      emissive: isHighlighted ? color : '#000000',
      emissiveIntensity: isHighlighted ? 0.3 : 0,
    });

    return { tubeGeometry: geometry, material: mat };
  }, [pipeline, floorLevel, isHighlighted]);

  useFrame((state) => {
    if (flowRef.current && pipeline.status === 'normal') {
      const time = state.clock.getElapsedTime();
      flowRef.current.emissiveIntensity = (Math.sin(time * 2) + 1) * 0.1;
    }
  });

  return (
    <mesh geometry={tubeGeometry} material={material} ref={flowRef as any}>
      <mesh ref={flowRef as any} />
    </mesh>
  );
};

export default PipelineMesh;
