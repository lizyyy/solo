import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RescueRoute as RescueRouteType } from '../../types';

interface RescueRouteProps {
  route: RescueRouteType;
  isSelected: boolean;
  onClick: () => void;
  terrainHeightmap?: number[][];
  terrainScale?: number;
}

export function RescueRoute({
  route,
  isSelected,
  onClick,
  terrainHeightmap,
  terrainScale = 1
}: RescueRouteProps) {
  const lineRef = useRef<THREE.Line>(null);
  const arrowRef = useRef<THREE.Group>(null);

  const { lineGeometry } = useMemo(() => {
    const points = route.points.map(p => {
      let height = 0.5;
      if (terrainHeightmap && terrainHeightmap.length > 0) {
        const xIdx = Math.floor(p.x / 2);
        const zIdx = Math.floor(p.z / 2);
        if (terrainHeightmap[zIdx] && terrainHeightmap[zIdx][xIdx] !== undefined) {
          height = terrainHeightmap[zIdx][xIdx] * terrainScale * 0.5 + 1;
        }
      }
      return new THREE.Vector3(p.x, height, p.z);
    });

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
    const curvePoints = curve.getPoints(50);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

    return { lineGeometry };
  }, [route.points, terrainHeightmap, terrainScale]);

  useFrame((state) => {
    if (arrowRef.current) {
      const time = state.clock.elapsedTime;
      arrowRef.current.children.forEach((arrow, i) => {
        const offset = (i / arrowRef.current!.children.length + time * 0.3) % 1;
        const points = route.points;
        const totalSegments = points.length - 1;
        const currentSegment = Math.floor(offset * totalSegments);
        const segmentProgress = (offset * totalSegments) % 1;
        
        if (currentSegment < totalSegments) {
          const p1 = points[currentSegment];
          const p2 = points[currentSegment + 1];
          
          let h1 = 0.5, h2 = 0.5;
          if (terrainHeightmap && terrainHeightmap.length > 0) {
            const x1Idx = Math.floor(p1.x / 2);
            const z1Idx = Math.floor(p1.z / 2);
            const x2Idx = Math.floor(p2.x / 2);
            const z2Idx = Math.floor(p2.z / 2);
            if (terrainHeightmap[z1Idx]?.[x1Idx] !== undefined) {
              h1 = terrainHeightmap[z1Idx][x1Idx] * terrainScale * 0.5 + 1.5;
            }
            if (terrainHeightmap[z2Idx]?.[x2Idx] !== undefined) {
              h2 = terrainHeightmap[z2Idx][x2Idx] * terrainScale * 0.5 + 1.5;
            }
          }
          
          arrow.position.set(
            p1.x + (p2.x - p1.x) * segmentProgress,
            h1 + (h2 - h1) * segmentProgress,
            p1.z + (p2.z - p1.z) * segmentProgress
          );
        }
      });
    }
  });

  const mainLine = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: route.color, linewidth: isSelected ? 4 : 2 })
  );

  const highlightLine = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: '#ffffff', linewidth: 1, transparent: true, opacity: 0.5 })
  );

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <primitive object={mainLine} />
      
      {isSelected && <primitive object={highlightLine} />}

      <group ref={arrowRef}>
        {[0, 0.33, 0.66].map((offset, i) => (
          <mesh key={i} rotation={[0, 0, 0]}>
            <coneGeometry args={[0.5, 1.5, 4]} />
            <meshBasicMaterial color={route.color} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default RescueRoute;
