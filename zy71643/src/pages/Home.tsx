import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header';
import { StatusBar } from '../components/layout/StatusBar';
import { LeftPanel } from '../components/panels/LeftPanel';
import { RightPanel } from '../components/panels/RightPanel';
import { PipelineScene } from '../components/three/Scene';
import { CollisionModal } from '../components/modals/CollisionModal';
import { ReportModal } from '../components/modals/ReportModal';
import { LogsModal } from '../components/modals/LogsModal';
import { useUIStore } from '../stores/uiStore';
import { usePipelineStore } from '../stores/pipelineStore';
import { useCollisionStore } from '../stores/collisionStore';
import { pileMarkers } from '../data/pileMarkers';
import type { PipelineSegment, CollisionPoint, PileMarker, Point3D } from '../types';
import { logger } from '../utils/logger';

export default function Home() {
  const loadData = usePipelineStore((state) => state.loadData);
  const segments = usePipelineStore((state) => state.segments);
  const visibility = usePipelineStore((state) => state.visibility);
  const transparency = usePipelineStore((state) => state.transparency);
  const isLoading = usePipelineStore((state) => state.isLoading);
  const setSelectedSegment = usePipelineStore((state) => state.setSelectedSegment);

  const runDetection = useCollisionStore((state) => state.runDetection);
  const collisions = useCollisionStore((state) => state.collisions);
  const isDetecting = useCollisionStore((state) => state.isDetecting);
  const setSelectedCollision = useCollisionStore((state) => state.setSelectedCollision);
  const dataIssues = useCollisionStore((state) => state.dataIssues);

  const setShowReportModal = useUIStore((state) => state.setShowReportModal);
  const setShowLogsModal = useUIStore((state) => state.setShowLogsModal);
  const showNotification = useUIStore((state) => state.showNotification);

  const [highlightedPileNo, setHighlightedPileNo] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await loadData();
        logger.info('data', '系统初始化完成');
      } catch (error) {
        console.error('加载数据失败:', error);
        showNotification('数据加载失败，请刷新页面', 'error');
      }
    };
    init();
  }, [loadData, showNotification]);

  const handleRunDetection = async () => {
    try {
      await runDetection(segments);
      const criticalCount = collisions.filter((c) => c.severity === 'critical').length;
      showNotification(
        `检测完成，发现 ${collisions.length} 处碰撞${criticalCount > 0 ? `，其中严重 ${criticalCount} 处` : ''}`,
        criticalCount > 0 ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('检测失败:', error);
      showNotification('碰撞检测失败，请重试', 'error');
    }
  };

  const handleExportReport = () => {
    setShowReportModal(true);
  };

  const handleViewLogs = () => {
    setShowLogsModal(true);
  };

  const handleSelectSegment = (segment: PipelineSegment | null) => {
    setSelectedSegment(segment);
    if (segment) {
      setSelectedCollision(null);
    }
  };

  const handleSelectCollision = (collision: CollisionPoint | null) => {
    setSelectedCollision(collision);
    if (collision) {
      setSelectedSegment(null);
    }
  };

  const handleSelectPile = (marker: PileMarker) => {
    setHighlightedPileNo(marker.no);
    showNotification(`已定位到桩号 ${marker.no}`, 'info');
    setTimeout(() => setHighlightedPileNo(''), 3000);
  };

  const handleCameraMove = (pos: Point3D, target: Point3D) => {
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <Header
        onRunDetection={handleRunDetection}
        onExportReport={handleExportReport}
        onViewLogs={handleViewLogs}
        isDetecting={isDetecting}
        collisionCount={collisions.length}
        segmentCount={segments.length}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftPanel
          pileMarkers={pileMarkers}
          onPileSelect={handleSelectPile}
          highlightedPileNo={highlightedPileNo}
        />

        <main className="flex-1 relative" id="three-scene-container">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400 text-sm">正在加载管线数据...</p>
              </div>
            </div>
          ) : (
            <PipelineScene
              segments={segments}
              collisions={collisions}
              pileMarkers={pileMarkers}
              visibility={visibility}
              transparency={transparency}
              highlightedPileNo={highlightedPileNo}
              onSelectSegment={handleSelectSegment}
              onSelectCollision={handleSelectCollision}
              onSelectPile={handleSelectPile}
              onCameraMove={handleCameraMove}
            />
          )}

          {dataIssues.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-yellow-300 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                检测到 {dataIssues.length} 处数据质量问题，结果可能存在偏差
              </p>
            </div>
          )}
        </main>

        <RightPanel />
      </div>

      <StatusBar />

      <CollisionModal />
      <ReportModal />
      <LogsModal />
    </div>
  );
}
