import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Point3D, Vector3D } from '../../types/surface';
import { useViewStore } from '../../stores/useViewStore';
import { vec3 } from '../../utils/math/geometry';

interface NormalVectorsProps {
  vertices: Point3D[];
  normals: Vector3D[];
  length?: number;
  density?: number;
  reversedIndices?: Set<number>;
}

export function NormalVectors({
  vertices,
  normals,
  length = 0.3,
  density = 8,
  reversedIndices = new Set(),
}: NormalVectorsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { showNormals, highlightReversedNormals } = useViewStore();

  const { arrows, reversedArrows } = useMemo(() => {
    if (vertices.length === 0 || normals.length === 0) {
      return { arrows: [] as THREE.ArrowHelper[], reversedArrows: [] as THREE.ArrowHelper[] };
    }

    const step = Math.max(1, Math.floor(Math.sqrt(vertices.length) / density));
    const normalArrows: THREE.ArrowHelper[] = [];
    const revArrows: THREE.ArrowHelper[] = [];

    const resolution = Math.sqrt(vertices.length);

    for (let j = 0; j < resolution; j += step) {
      for (let i = 0; i < resolution; i += step) {
        const idx = Math.floor(j) * Math.floor(resolution) + Math.floor(i);
        if (idx >= vertices.length || idx >= normals.length) continue;

        const vertex = vertices[idx];
        const normal = normals[idx];
        const isReversed = reversedIndices.has(idx);

        const dir = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
        const origin = new THREE.Vector3(vertex.x, vertex.y, vertex.z);
        const color = isReversed && highlightReversedNormals ? 0xff6b35 : 0x22d3ee;

        const arrow = new THREE.ArrowHelper(
          dir,
          origin,
          length,
          color,
          length * 0.3,
          length * 0.15
        );

        if (isReversed && highlightReversedNormals) {
          revArrows.push(arrow);
        } else {
          normalArrows.push(arrow);
        }
      }
    }

    return { arrows: normalArrows, reversedArrows: revArrows };
  }, [vertices, normals, length, density, reversedIndices, highlightReversedNormals]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = showNormals;
    }
  });

  if (vertices.length === 0) return null;

  return (
    <group ref={groupRef}>
      <instancedMesh args={[undefined, undefined, arrows.length]} visible={showNormals}>
        <cylinderGeometry args={[0.008, 0.008, 1, 6]} />
        <meshBasicMaterial color="#22d3ee" />
      </instancedMesh>
      {arrows.map((arrow, idx) => (
        <primitive key={`normal-${idx}`} object={arrow} />
      ))}
      {reversedArrows.map((arrow, idx) => (
        <primitive key={`rev-normal-${idx}`} object={arrow} />
      ))}
    </group>
  );
}
