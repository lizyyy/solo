import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useHallStore } from '@/store/useHallStore';

export function useCameraFocus() {
  const { camera } = useThree();
  const focusTarget = useHallStore((s) => s.focusTarget);
  const surfaces = useHallStore((s) => s.surfaces);
  const sources = useHallStore((s) => s.sources);
  const zones = useHallStore((s) => s.zones);
  const hall = useHallStore((s) => s.hall);

  useEffect(() => {
    if (!focusTarget) return;

    let targetPos: [number, number, number] | null = null;

    switch (focusTarget.type) {
      case 'surface':
        const surface = surfaces.find((s) => s.id === focusTarget.id);
        if (surface) targetPos = surface.position;
        break;
      case 'source':
        const source = sources.find((s) => s.id === focusTarget.id);
        if (source) targetPos = source.position;
        break;
      case 'zone':
        const zone = zones.find((z) => z.id === focusTarget.id);
        if (zone) {
          targetPos = [
            (zone.bounds.min[0] + zone.bounds.max[0]) / 2,
            (zone.bounds.min[1] + zone.bounds.max[1]) / 2,
            (zone.bounds.min[2] + zone.bounds.max[2]) / 2,
          ];
        }
        break;
      case 'hall':
        if (hall) {
          targetPos = [0, hall.height / 2, 0];
        }
        break;
    }

    if (!targetPos) return;

    const target = new THREE.Vector3(...targetPos);
    const startPos = camera.position.clone();
    const offset = new THREE.Vector3(5, 5, 5);
    const endPos = target.clone().add(offset);

    let startTime: number | null = null;
    const duration = 800;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeT = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(startPos, endPos, easeT);
      camera.lookAt(target);

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [focusTarget, camera, surfaces, sources, zones, hall]);
}
