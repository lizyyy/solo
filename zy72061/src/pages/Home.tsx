import { useState } from 'react';
import { Upload, RotateCcw, Download, AlertCircle } from 'lucide-react';
import FilterPanel from '../components/sidebar/FilterPanel';
import DetailPanel from '../components/sidebar/DetailPanel';
import SkeletonViewer from '../components/viewer/SkeletonViewer';
import Timeline from '../components/timeline/Timeline';
import DataImportModal from '../components/import/DataImportModal';
import { useGaitStore } from '../store/useGaitStore';

export default function Home() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const { importReport, frames, setFrames } = useGaitStore();

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？这将清除所有标记的异常和备注。')) {
      localStorage.removeItem('gait-skeleton-storage');
      window.location.reload();
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(frames, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gait-skeleton-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAnomalies = frames.reduce(
    (sum, frame) => sum + frame.points.filter((p) => p.isAnomaly).length,
    0,
  );

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="4" r="2" />
              <line x1="12" y1="6" x2="12" y2="12" />
              <line x1="12" y1="9" x2="8" y2="7" />
              <line x1="12" y1="9" x2="16" y2="7" />
              <line x1="12" y1="12" x2="8" y2="18" />
              <line x1="12" y1="12" x2="16" y2="18" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">人体步态康复骨架</h1>
            <p className="text-xs text-gray-500">Gait Skeleton Visualizer</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {totalAnomalies > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle size={16} className="text-orange-500" />
              <span className="text-sm text-orange-700 font-medium">
                共 {totalAnomalies} 个异常标记
              </span>
            </div>
          )}

          {importReport && (
            <div className="text-xs text-gray-500">
              数据来源：{importReport.fileName} · {new Date(importReport.importedAt).toLocaleDateString('zh-CN')}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Upload size={16} />
              导入数据
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Download size={16} />
              导出
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              title="重置所有数据"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <FilterPanel />
        <main className="flex-1 flex flex-col">
          <div className="flex-1">
            <SkeletonViewer />
          </div>
          <Timeline />
        </main>
        <DetailPanel />
      </div>

      <DataImportModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} />
    </div>
  );
}
