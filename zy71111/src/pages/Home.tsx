
import { useState } from 'react';
import { Scene3D } from '../components/Scene3D/Scene3D';
import { ControlPanel } from '../components/ControlPanel/ControlPanel';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { Timeline } from '../components/Timeline/Timeline';
import { AnnotationModal } from '../components/Modal/AnnotationModal';
import { useInspectionStore } from '../store/useInspectionStore';
import { exportAsHTML } from '../utils/exporter';

export default function Home() {
  const [exporting, setExporting] = useState(false);

  const inspectionData = useInspectionStore((state) => state.inspectionData);
  const cameraPosition = useInspectionStore((state) => state.cameraPosition);
  const cameraTarget = useInspectionStore((state) => state.cameraTarget);
  const currentTime = useInspectionStore((state) => state.currentTime);

  const handleExport = async () => {
    if (!inspectionData) return;
    setExporting(true);

    try {
      const state = useInspectionStore.getState();
      const filteredAnnotations = state.inspectionData?.annotations.filter(
        (ann) =>
          state.filterLevel.includes(ann.crackLevel) &&
          state.filterStatus.includes(ann.recheckStatus) &&
          ann.timestamp >= state.timeRange[0] &&
          ann.timestamp <= state.timeRange[1]
      ) || [];

      await exportAsHTML({
        bladeId: inspectionData.bladeId,
        exportTime: Date.now(),
        cameraPosition: state.cameraPosition,
        cameraTarget: state.cameraTarget,
        currentTime: state.currentTime,
        timeRange: state.timeRange,
        filterLevel: state.filterLevel,
        filterStatus: state.filterStatus,
        annotations: filteredAnnotations,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0">
        <Scene3D />
      </div>

      <Toolbar onExport={handleExport} />
      <ControlPanel />
      <Timeline />
      <AnnotationModal />

      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="flex items-center gap-3 px-6 py-4 bg-slate-800 rounded-xl">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white">正在生成报告...</span>
          </div>
        </div>
      )}

      {!inspectionData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-6xl mb-4">🌀</div>
            <h2 className="text-2xl font-bold text-white mb-2">风机叶片巡检标注系统</h2>
            <p className="text-slate-400">点击左侧「导入样例数据」开始使用</p>
          </div>
        </div>
      )}
    </div>
  );
}
