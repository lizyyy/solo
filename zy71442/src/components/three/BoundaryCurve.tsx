import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Point3D } from '../../types/surface';
import { flattenPoints } from '../../utils/math/geometry';
import { useViewStore } from '../../stores/useViewStore';

interface BoundaryCurveProps {
  points: Point3D[];
  gapIndices?: { start: number; end: number }[];
}

export function BoundaryCurve({ points, gapIndices = [] }: BoundaryCurveProps) {
  const lineRef = useRef<THREE.Line>(null);
  const gapsRef = useRef<THREE.Group>(null);
  const { showBoundary } = useViewStore();

  const { lineGeometry, gapMarkers } = useMemo(() => {
    if (points.length === 0) {
      return {
        lineGeometry: new THREE.BufferGeometry(),
        gapMarkers: [] as THREE.Mesh[],
      };
    }

    const positions = flattenPoints(points);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(
      Array.from({ length: points.length }, (_, i) => [i, (i + 1) % points.length]).flat()
    );

    const markers: THREE.Mesh[] = [];
    gapIndices.forEach((gap, idx) => {
      const startPoint = points[Math.min(gap.start, gap.end)];
      const endPoint = points[Math.max(gap.start, gap.end)];
      const midX = (startPoint.x + endPoint.x) / 2;
      const midY = (startPoint.y + endPoint.y) / 2;
      const midZ = (startPoint.z + endPoint.z) / 2;

      const markerGeo = new THREE.SphereGeometry(0.04, 12, 12);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xff9500 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(midX, midY, midZ);
      markers.push(marker);
    });

    return { lineGeometry: geo, gapMarkers: markers };
  }, [points, gapIndices]);

  useFrame(() => {
    if (lineRef.current) {
      lineRef.current.visible = showBoundary;
    }
    if (gapsRef.current) {
      gapsRef.current.visible = showBoundary;
    }
  });

  if (points.length === 0) return null;

  return (
    <group>
      <primitive object={new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xf472b6 }))} ref={lineRef} />
      <group ref={gapsRef}>
        {gapMarkers.map((marker, idx) => (
          <primitive key={`gap-${idx}`} object={marker} />
        ))}
      </group>
    </group>
  );
}
