import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { SceneElement, Signage, Column, VisibilityResult, Vector3Tuple } from '@/types';

export function useVisibilityCheck() {
  const { scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const viewerHeight = 1.7;

  const checkVisibility = useCallback((
    viewerPosition: Vector3Tuple,
    signages: Signage[],
    occluders: (Column | SceneElement)[],
    viewAngle: number = 60,
    maxDistance: number = 30
  ): VisibilityResult[] => {
    const results: VisibilityResult[] = [];
    const viewerPos = new THREE.Vector3(
      viewerPosition[0],
      viewerHeight,
      viewerPosition[2]
    );

    const occluderMeshes: THREE.Mesh[] = [];
    occluders.forEach(occluder => {
      if (occluder.type === 'column') {
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(
            (occluder as Column).radius,
            (occluder as Column).radius,
            (occluder as Column).height,
            16
          )
        );
        mesh.position.set(
          occluder.position[0],
          (occluder as Column).height / 2,
          occluder.position[2]
        );
        occluderMeshes.push(mesh);
      } else if (occluder.type === 'barrier') {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1)
        );
        mesh.position.set(
          occluder.position[0],
          1.25,
          occluder.position[2]
        );
        occluderMeshes.push(mesh);
      }
    });

    signages.forEach(signage => {
      const signagePos = new THREE.Vector3(
        signage.position[0],
        signage.position[1],
        signage.position[2]
      );

      const direction = new THREE.Vector3()
        .subVectors(signagePos, viewerPos)
        .normalize();
      
      const distance = viewerPos.distanceTo(signagePos);

      if (distance > maxDistance) {
        results.push({
          signageId: signage.id,
          isVisible: false,
          distance,
        });
        return;
      }

      const angle = Math.atan2(
        Math.sqrt(direction.x ** 2 + direction.z ** 2),
        direction.y
      ) * (180 / Math.PI);
      
      const horizontalAngle = Math.abs(Math.atan2(direction.x, direction.z)) * (180 / Math.PI);

      raycaster.current.set(viewerPos, direction);

      const intersects = raycaster.current.intersectObjects(occluderMeshes);
      const hasOcclusion = intersects.some(
        intersect => intersect.distance < distance - 0.5
      );

      const isInViewAngle = horizontalAngle < viewAngle / 2;

      results.push({
        signageId: signage.id,
        isVisible: !hasOcclusion && isInViewAngle,
        occlusionBy: hasOcclusion ? 'column' : undefined,
        viewAngle: horizontalAngle,
        distance,
      });
    });

    return results;
  }, []);

  const checkPathVisibility = useCallback((
    pathPoints: Vector3Tuple[],
    signages: Signage[],
    occluders: (Column | SceneElement)[]
  ): Map<number, VisibilityResult[]> => {
    const results = new Map<number, VisibilityResult[]>();
    
    pathPoints.forEach((point, index) => {
      const visibility = checkVisibility(point, signages, occluders);
      results.set(index, visibility);
    });

    return results;
  }, [checkVisibility]);

  return {
    checkVisibility,
    checkPathVisibility,
  };
}
