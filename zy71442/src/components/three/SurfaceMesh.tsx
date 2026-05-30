import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Point3D, Vector3D, UVPoint } from '../../types/surface';
import { flattenPoints, flattenUVs, generateGridIndices } from '../../utils/math/geometry';
import { useViewStore } from '../../stores/useViewStore';
import { useFilterStore } from '../../stores/useFilterStore';

interface SurfaceMeshProps {
  vertices: Point3D[];
  normals: Vector3D[];
  uvs: UVPoint[];
  resolution: number;
  reversedNormalIndices?: Set<number>;
}

export function SurfaceMesh({
  vertices,
  normals,
  uvs,
  resolution,
  reversedNormalIndices = new Set(),
}: SurfaceMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const { sliceParams, showSurface } = useViewStore();
  const { isPointInRange } = useFilterStore();

  const { geometry, edgesGeometry, colors } = useMemo(() => {
    if (vertices.length === 0) {
      return {
        geometry: new THREE.BufferGeometry(),
        edgesGeometry: new THREE.BufferGeometry(),
        colors: new Float32Array(),
      };
    }

    const positions = flattenPoints(vertices);
    const normalArr = flattenPoints(normals);
    const uvArr = flattenUVs(uvs);
    const indices = generateGridIndices(resolution, resolution);

    const colorArr = new Float32Array(vertices.length * 3);
    for (let i = 0; i < vertices.length; i++) {
      const isReversed = reversedNormalIndices.has(i);
      colorArr[i * 3] = isReversed ? 0.9 : 0.35;
      colorArr[i * 3 + 1] = isReversed ? 0.3 : 0.75;
      colorArr[i * 3 + 2] = isReversed ? 0.3 : 0.95;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normalArr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    geo.setIndex(indices);

    const edges = new THREE.EdgesGeometry(geo, 20);

    return { geometry: geo, edgesGeometry: edges, colors: colorArr };
  }, [vertices, normals, uvs, resolution, reversedNormalIndices]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.visible = showSurface;
    }
    if (linesRef.current) {
      linesRef.current.visible = showSurface;
    }
  });

  if (vertices.length === 0) return null;

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.6}
          metalness={0.1}
          transparent
          opacity={0.9}
          flatShading={false}
        />
      </mesh>
      <lineSegments ref={linesRef} geometry={edgesGeometry}>
        <lineBasicMaterial color="#1e3a5f" transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}
