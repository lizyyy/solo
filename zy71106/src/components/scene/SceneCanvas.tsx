import { useEffect } from 'react';
import { useThreeScene } from '../../hooks/useThreeScene';
import { useSceneStore } from '../../store/useSceneStore';

interface SceneCanvasProps {
  onCapture: (captureFn: () => string | null) => void;
  onSetViewPreset: (fn: (preset: any) => void) => void;
}

export function SceneCanvas({ onCapture, onSetViewPreset }: SceneCanvasProps) {
  const { containerRef, captureScreenshot, setViewPreset } = useThreeScene();
  const loadSample = useSceneStore((state) => state.loadSample);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  useEffect(() => {
    onCapture(captureScreenshot);
    onSetViewPreset(setViewPreset);
  }, [onCapture, onSetViewPreset, captureScreenshot, setViewPreset]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#1a1a2e' }}
    />
  );
}
