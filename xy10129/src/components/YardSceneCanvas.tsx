import { useEffect, useRef, useCallback } from 'react';
import { YardScene } from '../scene/YardScene';
import { YardConfig, PathPlan, ValidationError, ValidationWarning, PathWaypoint } from '../types';
import * as THREE from 'three';

interface YardSceneCanvasProps {
  yardConfig: YardConfig;
  waypoints: PathWaypoint[];
  pathPlan: PathPlan | null;
  validation: {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } | null;
  drawMode: boolean;
  onAddWaypoint?: (position: THREE.Vector3) => void;
  onUpdateWaypoint?: (id: string, position: { x: number; y: number; z: number }) => void;
}

export const YardSceneCanvas = ({
  yardConfig,
  waypoints,
  pathPlan,
  validation,
  drawMode,
  onAddWaypoint,
  onUpdateWaypoint
}: YardSceneCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<YardScene | null>(null);
  const waypointsRef = useRef<PathWaypoint[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new YardScene(containerRef.current);
    sceneRef.current = scene;

    scene.setYard(yardConfig);
    scene.setDrawMode(drawMode);

    scene.setOnClickHandler((position, _object) => {
      if (position && onAddWaypoint) {
        onAddWaypoint(position);
      }
    });

    scene.setOnDragHandler((id, position) => {
      if (onUpdateWaypoint) {
        onUpdateWaypoint(id, position);
      }
    });

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setYard(yardConfig);
  }, [yardConfig]);

  useEffect(() => {
    sceneRef.current?.setDrawMode(drawMode);
  }, [drawMode]);

  useEffect(() => {
    const waypointsChanged = JSON.stringify(waypoints) !== JSON.stringify(waypointsRef.current);
    
    if (waypointsChanged && waypoints.length >= 2 && pathPlan) {
      sceneRef.current?.setPath(pathPlan);
      waypointsRef.current = waypoints;
    } else if (waypoints.length < 2) {
      sceneRef.current?.setPath(null);
      waypointsRef.current = [];
    }
  }, [waypoints, pathPlan]);

  useEffect(() => {
    if (validation) {
      sceneRef.current?.highlightErrors(validation.errors, validation.warnings);
    } else {
      sceneRef.current?.highlightErrors([], []);
    }
  }, [validation]);

  const onPlay = useCallback(() => {
    sceneRef.current?.playAnimation(1);
  }, []);

  const onPause = useCallback(() => {
    sceneRef.current?.pauseAnimation();
  }, []);

  const onStop = useCallback(() => {
    sceneRef.current?.stopAnimation();
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-gray-800 rounded-lg p-2 bg-opacity-90">
        <button
          onClick={onPlay}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
        >
          ▶ 播放
        </button>
        <button
          onClick={onPause}
          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
        >
          ⏸ 暂停
        </button>
        <button
          onClick={onStop}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
        >
          ⏹ 停止
        </button>
      </div>
    </div>
  );
};
