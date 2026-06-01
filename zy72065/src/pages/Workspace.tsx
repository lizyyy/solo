import { useState, useRef } from 'react';
import { Header } from '../components/layout/Header';
import { PointList } from '../components/point-list/PointList';
import { Scene3D } from '../components/viewer3d/Scene3D';
import { DetailPanel } from '../components/detail-panel/DetailPanel';
import { ConflictModal } from '../components/modals/ConflictModal';
import { SaveSolutionModal } from '../components/modals/SaveSolutionModal';
import { useStore } from '../store/useStore';
import { useFilteredPoints } from '../hooks/useFilteredPoints';
import {
  downloadCanvasWithWatermark,
  generatePDFReport,
  formatDate,
  generateExportFilename,
} from '../utils/export';

export function Workspace() {
  const selectPoint = useStore((state) => state.selectPoint);
  const filteredPoints = useFilteredPoints();
  const filters = useStore((state) => state.filters);
  const coordinateSystem = useStore((state) => state.coordinateSystem);
  const solutions = useStore((state) => state.solutions);
  const currentSolutionId = useStore((state) => state.currentSolutionId);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const sceneContainerRef = useRef<HTMLDivElement>(null);

  const currentSolution = solutions.find((s) => s.id === currentSolutionId);

  const handlePointClick = (pointId: string) => {
    selectPoint(pointId);
  };

  const getExportMetadata = () => {
    const warningCount = filteredPoints.filter((p) => p.status === 'warning').length;
    const dangerCount = filteredPoints.filter((p) => p.status === 'danger').length;
    return {
      solutionName: currentSolution?.name || '未命名方案',
      filters,
      coordinateSystem,
      exportedAt: formatDate(new Date()),
      handler: '何工',
      pointCount: filteredPoints.length,
      warningCount,
      dangerCount,
    };
  };

  const handleExport = () => {
    const canvas = sceneContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    downloadCanvasWithWatermark(
      canvas,
      getExportMetadata(),
      `${generateExportFilename('screenshot')}.png`
    );
  };

  const handleExportPDF = () => {
    const canvas = sceneContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    generatePDFReport(
      canvas,
      getExportMetadata(),
      filteredPoints,
      `${generateExportFilename('report')}.pdf`
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <Header
        onSaveSolution={() => setShowSaveModal(true)}
        onExport={handleExport}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 flex-shrink-0">
          <PointList onPointClick={handlePointClick} />
        </div>

        <div
          ref={sceneContainerRef}
          className="flex-1 relative"
          id="scene-container"
        >
          <Scene3D onPointClick={handlePointClick} />

          <div className="absolute top-4 left-4 bg-gray-900/80 rounded-lg p-3 max-w-xs">
            <div className="text-xs text-gray-400 mb-1">快捷操作</div>
            <div className="flex gap-2">
              <button
                onClick={handleExportPDF}
                className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs rounded transition-colors"
              >
                导出PDF报告
              </button>
            </div>
          </div>
        </div>

        <div className="w-80 flex-shrink-0">
          <DetailPanel />
        </div>
      </div>

      <ConflictModal />
      <SaveSolutionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
      />
    </div>
  );
}
