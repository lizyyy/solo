import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Point3D, SliceParams } from '../../types/surface';
import { flattenPoints } from '../../utils/math/geometry';
import { useViewStore } from '../../stores/useViewStore';

interface ParameterSliceProps {
  vertices: Point3D[];
  resolution: number;
}

export function ParameterSlice({ vertices, resolution }: ParameterSliceProps) {
  const uSliceRef = useRef<THREE.Line>(null);
  const vSliceRef = useRef<THREE.Line>(null);
  const { sliceParams, showSurface } = useViewStore();

  const { uSliceGeometry, vSliceGeometry } = useMemo(() => {
    if (vertices.length === 0) {
      return {
        uSliceGeometry: new THREE.BufferGeometry(),
        vSliceGeometry: new THREE.BufferGeometry(),
      };
    }

    const uIdx = Math.floor(sliceParams.uMin * (resolution - 1));
    const vIdx = Math.floor(sliceParams.vMin * (resolution - 1));

    const uSlicePoints: Point3D[] = [];
    for (let i = 0; i < resolution; i++) {
      const idx = i * resolution + uIdx;
      if (idx < vertices.length) {
        uSlicePoints.push(vertices[idx]);
      }
    }

    const vSlicePoints: Point3D[] = [];
    for (let i = 0; i < resolution; i++) {
      const idx = vIdx * resolution + i;
      if (idx < vertices.length) {
        vSlicePoints.push(vertices[idx]);
      }
    }

    const uGeo = new THREE.BufferGeometry();
    uGeo.setAttribute('position', new THREE.BufferAttribute(flattenPoints(uSlicePoints), 3));
    uGeo.setIndex(Array.from({ length: uSlicePoints.length - 1 }, (_, i) => [i, i + 1]).flat());

    const vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.BufferAttribute(flattenPoints(vSlicePoints), 3));
    vGeo.setIndex(Array.from({ length: vSlicePoints.length - 1 }, (_, i) => [i, i + 1]).flat());

    return { uSliceGeometry: uGeo, vSliceGeometry: vGeo };
  }, [vertices, resolution, sliceParams]);

  useFrame(() => {
    const visible = showSurface && (sliceParams.uMin > 0 || sliceParams.vMin > 0);
    if (uSliceRef.current) {
      uSliceRef.current.visible = visible;
    }
    if (vSliceRef.current) {
      vSliceRef.current.visible = visible;
    }
  });

  if (vertices.length === 0) return null;

  return (
    <group>
      <primitive object={new THREE.Line(uSliceGeometry, new THREE.LineBasicMaterial({ color: 0xfbbf24 }))} ref={uSliceRef} />
      <primitive object={new THREE.Line(vSliceGeometry, new THREE.LineBasicMaterial({ color: 0x34d399 }))} ref={vSliceRef} />
    </group>
  );
}
