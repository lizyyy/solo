import { useEffect, useRef, useCallback } from 'react';
import { WarehouseScene } from '../three/WarehouseScene';
import { useStore } from '../store/useStore';
import { warehouseData, shelves, aisles, pickingOrders } from '../data/mockData';
import { calculateHeatmap } from '../utils/heatmap';

export function Viewport3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WarehouseScene | null>(null);
  const {
    selectedOrders,
    currentTime,
    showHeatmap,
    showPaths,
    showShelves,
    heatmapIntensity,
    viewMode,
    cameraPosition,
    cameraTarget,
    timeRange,
    setCameraPosition,
  } = useStore();

  const getSceneRef = useCallback(() => sceneRef.current, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new WarehouseScene(
      containerRef.current,
      warehouseData,
      shelves,
      aisles,
      pickingOrders
    );
    sceneRef.current = scene;

    scene.startAnimation(() => {
      const state = scene.getCameraState();
      setCameraPosition(state.position, state.target);
    });

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [setCameraPosition]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setCameraPosition(cameraPosition, cameraTarget);
  }, [viewMode, cameraPosition, cameraTarget]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.updatePaths(selectedOrders, currentTime, showPaths);
  }, [selectedOrders, currentTime, showPaths]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setShelvesVisible(showShelves);
  }, [showShelves]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const visibleOrders = selectedOrders.length === 0
      ? pickingOrders
      : pickingOrders.filter((o) => selectedOrders.includes(o.id));

    const filteredOrders = visibleOrders.filter(
      (order) => order.startTime >= timeRange.start && order.endTime <= timeRange.end
    );

    const heatmapData = calculateHeatmap(
      filteredOrders,
      aisles,
      { start: timeRange.start, end: currentTime },
      1,
      heatmapIntensity
    );

    const maxValue = Math.max(...heatmapData.map((d) => d.value), 1);
    sceneRef.current.updateHeatmap(heatmapData, showHeatmap, maxValue);
  }, [selectedOrders, currentTime, showHeatmap, heatmapIntensity, timeRange]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ top: '56px', bottom: '96px' }}
    />
  );
}
