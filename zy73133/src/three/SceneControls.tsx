import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTidalStore, annotationToWorld, type ViewPreset } from '@/store/useTidalStore';

const PRESETS: Record<ViewPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [22, 22, 26], target: [0, 2, 0] },
  side: { pos: [0, 6, 34], target: [0, 3, 0] },
  orbit: { pos: [18, 14, 18], target: [0, 3, 0] },
};

export function SceneControls() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const viewPreset = useTidalStore((s) => s.viewPreset);
  const focusAnnotationId = useTidalStore((s) => s.focusAnnotationId);
  const batch = useTidalStore((s) => s.batch);
  const targetPos = useRef(new THREE.Vector3(...PRESETS.overview.pos));
  const targetLook = useRef(new THREE.Vector3(...PRESETS.overview.target));

  useEffect(() => {
    const preset = PRESETS[viewPreset];
    targetPos.current.set(...preset.pos);
    targetLook.current.set(...preset.target);
  }, [viewPreset]);

  useEffect(() => {
    if (!focusAnnotationId || !batch) return;
    const idx = batch.annotations.findIndex((a) => a.annotationId === focusAnnotationId);
    if (idx < 0) return;
    const wp = annotationToWorld(batch.annotations[idx], idx, batch.annotations.length);
    targetPos.current.set(wp.x + 6, wp.y + 7, wp.z + 8);
    targetLook.current.set(wp.x, wp.y + 1.5, wp.z);
  }, [focusAnnotationId, batch]);

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.06);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.06);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={6}
      maxDistance={70}
      maxPolarAngle={Math.PI / 2.05}
      makeDefault
    />
  );
}
