
import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Edge3D, Node3D } from '../../types';

interface TransactionEdgeProps {
  edge: Edge3D;
  nodeMap: Map<string, Node3D>;
  isHighlighted: boolean;
}

export const TransactionEdge = ({ edge, nodeMap, isHighlighted }: TransactionEdgeProps) => {
  const particleProgress = useRef(Math.random());

  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);

  const [lineMaterial] = useState(() => {
    return new THREE.LineBasicMaterial({
      transparent: true,
    });
  });

  const [particleMaterial] = useState(() => {
    return new THREE.PointsMaterial({
      size: 0.5,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
  });

  const { geometry, particleGeometry } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(3);
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    
    return { geometry: geo, particleGeometry: particleGeo };
  }, []);

  const edgeColor = edge.isAnomaly ? '#ef4444' : isHighlighted ? '#6366f1' : '#4b5563';
  const opacity = edge.isAnomaly ? 0.8 : isHighlighted ? 0.6 : 0.3;

  useFrame((_, delta) => {
    if (!sourceNode || !targetNode) return;

    const positions = geometry.attributes.position.array as Float32Array;
    positions[0] = sourceNode.x;
    positions[1] = sourceNode.y;
    positions[2] = sourceNode.z;
    positions[3] = targetNode.x;
    positions[4] = targetNode.y;
    positions[5] = targetNode.z;
    geometry.attributes.position.needsUpdate = true;

    lineMaterial.color.set(edgeColor);
    lineMaterial.opacity = opacity;
    particleMaterial.color.set(edge.isAnomaly ? '#ef4444' : '#6366f1');

    particleProgress.current += delta * 0.5 * (edge.transaction.amount / 100000);
    if (particleProgress.current > 1) particleProgress.current = 0;

    const t = particleProgress.current;
    const particlePos = particleGeometry.attributes.position.array as Float32Array;
    particlePos[0] = sourceNode.x + (targetNode.x - sourceNode.x) * t;
    particlePos[1] = sourceNode.y + (targetNode.y - sourceNode.y) * t;
    particlePos[2] = sourceNode.z + (targetNode.z - sourceNode.z) * t;
    particleGeometry.attributes.position.needsUpdate = true;
  });

  if (!sourceNode || !targetNode) return null;

  return (
    <group>
      <primitive object={new THREE.Line(geometry, lineMaterial)} />
      <primitive object={new THREE.Points(particleGeometry, particleMaterial)} />
    </group>
  );
};
