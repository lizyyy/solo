import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobeScene } from '../components/Globe/GlobeScene';
import { ActionBar } from '../components/TopBar/ActionBar';
import { FilterTabs } from '../components/Sidebar/FilterTabs';
import { PointList } from '../components/Sidebar/PointList';
import { PlanManager } from '../components/Sidebar/PlanManager';
import { PointDetail } from '../components/DetailPanel/PointDetail';
import { usePointStore } from '../store/usePointStore';
import { usePlanStore } from '../store/usePlanStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useScreenshot } from '../hooks/useScreenshot';
import type { Point, PointStatus, CameraState } from '../types';

export default function Home() {
  const appContainerRef = useRef<HTMLDivElement>(null);
  const [flyToTarget, setFlyToTarget] = useState<CameraState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    points,
    selectedPointId,
    filteredStatus,
    selectPoint,
    updatePointStatus,
    addRemark,
    setFilteredStatus,
    getFilteredPoints,
    initializeFromStorage: initPoints,
  } = usePointStore();

  const {
    plans,
    currentPlanId,
    createPlan,
    updatePlan,
    deletePlan,
    setCurrentPlan,
    saveCurrentState,
    getCurrentPlan,
    loadPlan,
    initializeFromStorage: initPlans,
  } = usePlanStore();

  const {
    autoRotate,
    lastCameraState,
    setAutoRotate,
    setLastCameraState,
    initializeFromStorage: initSettings,
  } = useSettingsStore();

  const { targetRef, exportScreenshot } = useScreenshot();

  useEffect(() => {
    initPoints();
    initPlans();
    initSettings();
    setIsInitialized(true);
  }, [initPoints, initPlans, initSettings]);

  useEffect(() => {
    if (isInitialized && lastCameraState) {
      setFlyToTarget(lastCameraState);
    }
  }, [isInitialized, lastCameraState]);

  const filteredPoints = getFilteredPoints();
  const currentPlan = getCurrentPlan();
  const selectedPoint = points.find(p => p.id === selectedPointId) || null;

  const counts = {
    all: points.length,
    success: points.filter(p => p.status === 'success').length,
    pending: points.filter(p => p.status === 'pending').length,
    legacy: points.filter(p => p.status === 'legacy').length,
  };

  const handlePointClick = useCallback((point: Point | null) => {
    if (point) {
      selectPoint(point.id);
      setFlyToTarget(point.cameraState);
    } else {
      selectPoint(null);
    }
  }, [selectPoint]);

  const handleCameraChange = useCallback((state: CameraState) => {
    setLastCameraState(state);
  }, [setLastCameraState]);

  const handleSavePlan = useCallback(() => {
    const pointStates: Record<string, { status: PointStatus; isAnomaly: boolean }> = {};
    points.forEach(p => {
      pointStates[p.id] = { status: p.status, isAnomaly: p.isAnomaly };
    });
    
    const currentCameraState = lastCameraState || { lat: 30, lng: 105, altitude: 4 };
    saveCurrentState(currentCameraState, pointStates);
  }, [points, lastCameraState, saveCurrentState]);

  const handleExportScreenshot = useCallback(async () => {
    await exportScreenshot(currentPlan, selectedPoint || undefined, appContainerRef.current || undefined);
  }, [currentPlan, selectedPoint, exportScreenshot]);

  const handleExportPointScreenshot = useCallback(async (point: Point) => {
    selectPoint(point.id);
    setFlyToTarget(point.cameraState);
    setTimeout(async () => {
      await exportScreenshot(currentPlan, point, appContainerRef.current || undefined);
    }, 1600);
  }, [selectPoint, currentPlan, exportScreenshot]);

  const handleResetView = useCallback(() => {
    const defaultState: CameraState = { lat: 30, lng: 105, altitude: 4 };
    setFlyToTarget(defaultState);
  }, []);

  const handleSelectPlan = useCallback((id: string) => {
    const plan = loadPlan(id);
    if (plan) {
      setFlyToTarget(plan.cameraState);
    }
  }, [loadPlan]);

  const handleCreatePlan = useCallback((name: string, description: string) => {
    const currentCameraState = lastCameraState || { lat: 30, lng: 105, altitude: 4 };
    createPlan(name, description, currentCameraState);
  }, [lastCameraState, createPlan]);

  const handleUpdatePlanName = useCallback((name: string) => {
    if (currentPlanId) {
      updatePlan(currentPlanId, { name });
    }
  }, [currentPlanId, updatePlan]);

  const handleUpdatePointStatus = useCallback((id: string, status: PointStatus, isAnomaly: boolean) => {
    updatePointStatus(id, status, isAnomaly);
  }, [updatePointStatus]);

  const handleAddRemark = useCallback((pointId: string, content: string, author: string) => {
    addRemark(pointId, { content, author });
  }, [addRemark]);

  const handleFilterChange = useCallback((status: PointStatus | 'all') => {
    setFilteredStatus(status);
  }, [setFilteredStatus]);

  if (!isInitialized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ backgroundColor: '#0a1628' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">正在加载遥感地块变化地球仪...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={(el) => { 
      appContainerRef.current = el;
      (targetRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }} className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: '#0a1628' }}>
      <GlobeScene
        points={filteredPoints}
        selectedPointId={selectedPointId}
        autoRotate={autoRotate}
        onPointClick={handlePointClick}
        onCameraChange={handleCameraChange}
        flyToTarget={flyToTarget}
      />

      <ActionBar
        currentPlan={currentPlan}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
        onSavePlan={handleSavePlan}
        onExportScreenshot={handleExportScreenshot}
        onResetView={handleResetView}
        onUpdatePlanName={handleUpdatePlanName}
      />

      <div
        className="absolute top-4 left-4 bottom-4 w-[280px] flex flex-col gap-3 z-10"
        style={{
          backgroundColor: 'rgba(15, 28, 54, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          padding: '16px',
        }}
      >
        <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            }}
          >
            <span className="text-white text-lg">🌍</span>
          </div>
          <div>
            <h2
              className="text-sm font-bold text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              遥感地块变化地球仪
            </h2>
            <p className="text-[10px] text-gray-400">
              共 {points.length} 个监测点位
            </p>
          </div>
        </div>

        <PlanManager
          plans={plans}
          currentPlanId={currentPlanId}
          onSelectPlan={handleSelectPlan}
          onDeletePlan={deletePlan}
          onCreatePlan={handleCreatePlan}
        />

        <div className="border-t pt-3" style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}>
          <FilterTabs
            currentFilter={filteredStatus}
            onFilterChange={handleFilterChange}
            counts={counts}
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          <PointList
            points={filteredPoints}
            selectedPointId={selectedPointId}
            onPointClick={handlePointClick}
          />
        </div>

        <div
          className="pt-3 border-t text-[10px] text-gray-500 text-center"
          style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}
        >
          <p>💡 点击点位查看详情 | 拖拽旋转地球 | 滚轮缩放</p>
          <p className="mt-1">数据自动保存在本地，刷新不丢失</p>
        </div>
      </div>

      <PointDetail
        point={selectedPoint}
        onClose={() => selectPoint(null)}
        onExport={handleExportPointScreenshot}
        onUpdateStatus={handleUpdatePointStatus}
        onAddRemark={handleAddRemark}
      />
    </div>
  );
}
