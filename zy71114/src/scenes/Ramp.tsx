import { useMemo } from 'react';
import * as THREE from 'three';
import { Ramp as RampType } from '../types';

interface RampProps {
  ramp: RampType;
}

export function Ramp({ ramp }: RampProps) {
  const { geometry, edgeGeometry } = useMemo(() => {
    const points = ramp.points;
    const halfWidth = ramp.width / 2;

    const vertices: number[] = [];
    const indices: number[] = [];
    const edgeVertices: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      vertices.push(p[0] - halfWidth, p[1], p[2]);
      vertices.push(p[0] + halfWidth, p[1], p[2]);

      edgeVertices.push(p[0] - halfWidth, p[1] + 0.02, p[2]);
      edgeVertices.push(p[0] + halfWidth, p[1] + 0.02, p[2]);
    }

    for (let i = 0; i < points.length - 1; i++) {
      const i0 = i * 2;
      const i1 = i * 2 + 1;
      const i2 = (i + 1) * 2;
      const i3 = (i + 1) * 2 + 1;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));

    return { geometry: geo, edgeGeometry: edgeGeo };
  }, [ramp]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#6B7280" metalness={0.1} roughness={0.9} />
      </mesh>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color="#9CA3AF" linewidth={2} />
      </lineSegments>

      {ramp.transitionPoints.map((tp) => (
        <group key={tp.id} position={tp.position}>
          <mesh position={[0, 0.05, 0]}>
            <ringGeometry args={[0.3, 0.5, 32]} />
            <meshBasicMaterial
              color={tp.riskLevel === 'danger' ? '#F53F3F' : tp.riskLevel === 'warning' ? '#FF7D00' : '#00B42A'}
              side={THREE.DoubleSide}
              transparent
              opacity={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
