import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PipelineSegment } from '../../types';
import { pipelineColors } from '../../data/config';

interface PipelineMeshProps {
  segment: PipelineSegment;
  isSelected: boolean;
  showWarning: boolean;
  transparency: number;
  onClick: () => void;
}

export function PipelineMesh({ segment, isSelected, showWarning, transparency, onClick }: PipelineMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const start = new THREE.Vector3(segment.startPoint.x, segment.startPoint.y, segment.startPoint.z);
    const end = new THREE.Vector3(segment.endPoint.x, segment.endPoint.y, segment.endPoint.z);
    const radius = segment.diameter / 2 || 0.05;

    const path = new THREE.LineCurve3(start, end);
    const geometry = new THREE.TubeGeometry(path, 32, radius, 8, false);

    const color = new THREE.Color(pipelineColors[segment.type] || '#888888');
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.7,
      roughness: 0.2,
      transparent: true,
      opacity: transparency,
      emissive: showWarning ? new THREE.Color('#fb8c00') : color,
      emissiveIntensity: showWarning ? 0.3 : 0.1,
    });

    return { geometry, material };
  }, [segment, transparency, showWarning]);

  const glowGeometry = useMemo(() => {
    if (!isSelected) return null;
    const start = new THREE.Vector3(segment.startPoint.x, segment.startPoint.y, segment.startPoint.z);
    const end = new THREE.Vector3(segment.endPoint.x, segment.endPoint.y, segment.endPoint.z);
    const radius = (segment.diameter / 2 || 0.05) * 1.3;
    const path = new THREE.LineCurve3(start, end);
    return new THREE.TubeGeometry(path, 32, radius, 8, false);
  }, [segment, isSelected]);

  useFrame((_, delta) => {
    if (meshRef.current && isSelected) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
    }
    if (glowRef.current && isSelected) {
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
      />
      {isSelected && glowGeometry && (
        <mesh
          ref={glowRef}
          geometry={glowGeometry}
        >
          <meshBasicMaterial
            color={pipelineColors[segment.type]}
            transparent
            opacity={0.3}
            side={THREE.BackSide}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

export function PipelineGroup({
  segments,
  visibility,
  selectedSegment,
  transparency,
  onSelectSegment,
}: {
  segments: PipelineSegment[];
  visibility: { water: boolean; electric: boolean; gas: boolean };
  selectedSegment: PipelineSegment | null;
  transparency: number;
  onSelectSegment: (segment: PipelineSegment | null) => void;
}) {
  const visibleSegments = useMemo(() => {
    return segments.filter((seg) => visibility[seg.type]);
  }, [segments, visibility]);

  return (
    <group>
      {visibleSegments.map((segment) => (
        <PipelineMesh
          key={segment.id}
          segment={segment}
          isSelected={selectedSegment?.id === segment.id}
          showWarning={segment.hasWarning}
          transparency={transparency}
          onClick={() => onSelectSegment(selectedSegment?.id === segment.id ? null : segment)}
        />
      ))}
    </group>
  );
}
