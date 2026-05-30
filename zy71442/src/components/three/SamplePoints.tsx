import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Point3D } from '../../types/surface';
import { flattenPoints } from '../../utils/math/geometry';
import { useViewStore } from '../../stores/useViewStore';

interface SamplePointsProps {
  points: Point3D[];
  sparseIndices?: Set<number>;
}

export function SamplePoints({ points, sparseIndices = new Set() }: SamplePointsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const sparseRef = useRef<THREE.Points>(null);
  const { showSamples } = useViewStore();

  const { regularGeometry, sparseGeometry } = useMemo(() => {
    if (points.length === 0) {
      return {
        regularGeometry: new THREE.BufferGeometry(),
        sparseGeometry: new THREE.BufferGeometry(),
      };
    }

    const regularPoints: Point3D[] = [];
    const sparsePoints: Point3D[] = [];

    points.forEach((p, i) => {
      if (sparseIndices.has(i)) {
        sparsePoints.push(p);
      } else {
        regularPoints.push(p);
      }
    });

    const regularGeo = new THREE.BufferGeometry();
    regularGeo.setAttribute('position', new THREE.BufferAttribute(flattenPoints(regularPoints), 3));

    const sparseGeo = new THREE.BufferGeometry();
    sparseGeo.setAttribute('position', new THREE.BufferAttribute(flattenPoints(sparsePoints), 3));

    return { regularGeometry: regularGeo, sparseGeometry: sparseGeo };
  }, [points, sparseIndices]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.visible = showSamples;
    }
    if (sparseRef.current) {
      sparseRef.current.visible = showSamples;
    }
  });

  if (points.length === 0) return null;

  return (
    <group>
      <points ref={pointsRef} geometry={regularGeometry}>
        <pointsMaterial
          size={0.05}
          color="#a78bfa"
          sizeAttenuation
          transparent
          opacity={0.9}
        />
      </points>
      <points ref={sparseRef} geometry={sparseGeometry}>
        <pointsMaterial
          size={0.08}
          color="#f97316"
          sizeAttenuation
          transparent
          opacity={1}
        />
      </points>
    </group>
  );
}
