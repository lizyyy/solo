import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Point3D, ProjectionPlane as ProjectionPlaneType } from '../../types/surface';
import { flattenPoints } from '../../utils/math/geometry';
import { useViewStore } from '../../stores/useViewStore';
import { computeBoundingBox } from '../../utils/math/geometry';

interface ProjectionPlaneProps {
  surfacePoints: Point3D[];
  plane: ProjectionPlaneType;
}

export function ProjectionPlane({ surfacePoints, plane }: ProjectionPlaneProps) {
  const planeRef = useRef<THREE.Mesh>(null);
  const projectionRef = useRef<THREE.Points>(null);
  const outlineRef = useRef<THREE.LineLoop>(null);
  const { showProjection } = useViewStore();

  const { planeGeometry, projectionGeometry, outlineGeometry, planePosition } = useMemo(() => {
    if (surfacePoints.length === 0) {
      return {
        planeGeometry: new THREE.PlaneGeometry(1, 1),
        projectionGeometry: new THREE.BufferGeometry(),
        outlineGeometry: new THREE.BufferGeometry(),
        planePosition: [0, 0, 0] as [number, number, number],
      };
    }

    const bbox = computeBoundingBox(surfacePoints);
    const padding = 0.2;

    let width = 0, height = 0;
    let planePos: [number, number, number] = [0, 0, 0];
    let projectedPoints: Point3D[] = [];

    switch (plane) {
      case 'xy':
        width = bbox.max.x - bbox.min.x + padding * 2;
        height = bbox.max.y - bbox.min.y + padding * 2;
        planePos = [(bbox.min.x + bbox.max.x) / 2, (bbox.min.y + bbox.max.y) / 2, bbox.min.z - padding];
        projectedPoints = surfacePoints.map((p) => ({ x: p.x, y: p.y, z: planePos[2] }));
        break;
      case 'xz':
        width = bbox.max.x - bbox.min.x + padding * 2;
        height = bbox.max.z - bbox.min.z + padding * 2;
        planePos = [(bbox.min.x + bbox.max.x) / 2, bbox.min.y - padding, (bbox.min.z + bbox.max.z) / 2];
        projectedPoints = surfacePoints.map((p) => ({ x: p.x, y: planePos[1], z: p.z }));
        break;
      case 'yz':
        width = bbox.max.y - bbox.min.y + padding * 2;
        height = bbox.max.z - bbox.min.z + padding * 2;
        planePos = [bbox.min.x - padding, (bbox.min.y + bbox.max.y) / 2, (bbox.min.z + bbox.max.z) / 2];
        projectedPoints = surfacePoints.map((p) => ({ x: planePos[0], y: p.y, z: p.z }));
        break;
    }

    const planeGeo = new THREE.PlaneGeometry(width, height);
    const projGeo = new THREE.BufferGeometry();
    projGeo.setAttribute('position', new THREE.BufferAttribute(flattenPoints(projectedPoints), 3));

    const outlinePoints = [
      { x: bbox.min.x, y: bbox.min.y, z: planePos[2] },
      { x: bbox.max.x, y: bbox.min.y, z: planePos[2] },
      { x: bbox.max.x, y: bbox.max.y, z: planePos[2] },
      { x: bbox.min.x, y: bbox.max.y, z: planePos[2] },
    ];
    const outlineGeo = new THREE.BufferGeometry();
    outlineGeo.setAttribute('position', new THREE.BufferAttribute(flattenPoints(outlinePoints), 3));

    return {
      planeGeometry: planeGeo,
      projectionGeometry: projGeo,
      outlineGeometry: outlineGeo,
      planePosition: planePos,
    };
  }, [surfacePoints, plane]);

  useFrame(() => {
    if (planeRef.current) {
      planeRef.current.visible = showProjection;
    }
    if (projectionRef.current) {
      projectionRef.current.visible = showProjection;
    }
    if (outlineRef.current) {
      outlineRef.current.visible = showProjection;
    }
  });

  if (surfacePoints.length === 0) return null;

  return (
    <group>
      <mesh ref={planeRef} position={planePosition} geometry={planeGeometry}>
        <meshBasicMaterial
          color="#7c3aed"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      <points ref={projectionRef} geometry={projectionGeometry}>
        <pointsMaterial size={0.03} color="#a855f7" transparent opacity={0.6} />
      </points>
      <primitive 
        object={new THREE.LineLoop(
          outlineGeometry, 
          new THREE.LineDashedMaterial({ color: 0x8b5cf6, dashSize: 0.1, gapSize: 0.05 })
        )} 
        ref={outlineRef as any} 
      />
    </group>
  );
}
