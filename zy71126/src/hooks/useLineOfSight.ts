import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useAppStore } from '@/store/appStore';
import { LineOfSightResult, Seat, Obstacle } from '@/types';

export function useLineOfSight() {
  const raycasterRef = useRef(new THREE.Raycaster());
  const resultsRef = useRef<LineOfSightResult[]>([]);

  const checkLineOfSight = useCallback(
    (
      seats: Seat[],
      obstacles: Obstacle[],
      platformTargetPoint: { x: number; y: number; z: number },
      eyeHeight: number
    ): LineOfSightResult[] => {
      const obstacleMeshes: THREE.Mesh[] = [];
      obstacles.forEach((obstacle) => {
        const geometry = new THREE.BoxGeometry(
          obstacle.size.width,
          obstacle.size.height,
          obstacle.size.depth
        );
        const mesh = new THREE.Mesh(geometry);
        mesh.position.set(
          obstacle.position.x,
          obstacle.position.y,
          obstacle.position.z
        );
        mesh.userData = { obstacleId: obstacle.id };
        mesh.updateMatrixWorld(true);
        obstacleMeshes.push(mesh);
      });

      const results: LineOfSightResult[] = [];
      const targetPoint = new THREE.Vector3(
        platformTargetPoint.x,
        platformTargetPoint.y,
        platformTargetPoint.z
      );

      seats.forEach((seat) => {
        const eyePosition = new THREE.Vector3(
          seat.position.x,
          eyeHeight,
          seat.position.z
        );

        const direction = new THREE.Vector3()
          .subVectors(targetPoint, eyePosition)
          .normalize();

        raycasterRef.current.set(eyePosition, direction);
        const distance = eyePosition.distanceTo(targetPoint);
        raycasterRef.current.far = distance;

        const intersects = raycasterRef.current.intersectObjects(
          obstacleMeshes,
          false
        );

        if (intersects.length > 0) {
          results.push({
            seatId: seat.id,
            isBlocked: true,
            blockingObstacleId: intersects[0].object.userData.obstacleId,
            hitPoint: {
              x: intersects[0].point.x,
              y: intersects[0].point.y,
              z: intersects[0].point.z,
            },
          });
        } else {
          results.push({
            seatId: seat.id,
            isBlocked: false,
          });
        }
      });

      obstacleMeshes.forEach((m) => {
        m.geometry.dispose();
      });

      return results;
    },
    []
  );

  const resultsEqual = (
    a: LineOfSightResult[],
    b: LineOfSightResult[]
  ): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].seatId !== b[i].seatId || a[i].isBlocked !== b[i].isBlocked) {
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useAppStore.getState();
      if (!state.showLineOfSight) return;

      const newResults = checkLineOfSight(
        state.seats,
        state.obstacles,
        state.platform.targetPoint,
        state.eyeHeight
      );

      if (!resultsEqual(resultsRef.current, newResults)) {
        resultsRef.current = newResults;
        useAppStore.getState().updateLineOfSightResults(newResults);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [checkLineOfSight]);

  return { checkLineOfSight };
}
