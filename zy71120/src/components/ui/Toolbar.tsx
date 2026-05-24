import { useState, useRef } from 'react';
import {
  Upload,
  RotateCcw,
  FileDown,
  Eye,
  Database,
  Maximize2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

export function Toolbar() {
  const {
    loadSampleData,
    resetState,
    importData,
    cameraViews,
    currentCameraView,
    setCurrentCameraView,
    dataCenter,
    timeSeriesData,
    currentTimeIndex,
  } = useAppStore();

  const [showViews, setShowViews] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          importData(data);
        } catch (err) {
          console.error('Failed to parse data:', err);
          alert('数据格式错误，请检查文件');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportReport = async () => {
    const reportData = {
      exportTime: new Date().toISOString(),
      dataCenterName: dataCenter?.name,
      currentTime: timeSeriesData[currentTimeIndex]?.timestamp,
      summary: {
        totalRacks: dataCenter?.racks.length || 0,
        criticalCount: timeSeriesData[currentTimeIndex]?.racks.filter(
          (r) => r.status === 'critical'
        ).length,
        warningCount: timeSeriesData[currentTimeIndex]?.racks.filter(
          (r) => r.status === 'warning'
        ).length,
        offlineCount: timeSeriesData[currentTimeIndex]?.racks.filter(
          (r) => r.status === 'offline'
        ).length,
      },
      racks: timeSeriesData[currentTimeIndex]?.racks,
      alerts: timeSeriesData[currentTimeIndex]?.alerts,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatmap-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md rounded-lg border border-cyan-500/20 shadow-2xl px-4 py-2">
      <button
        onClick={loadSampleData}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors text-sm font-medium"
      >
        <Database size={16} />
        导入样例
      </button>

      <div className="w-px h-6 bg-cyan-500/20" />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 text-gray-300 hover:text-white transition-colors text-sm"
      >
        <Upload size={16} />
        导入数据
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      <button
        onClick={handleExportReport}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 text-gray-300 hover:text-white transition-colors text-sm"
      >
        <FileDown size={16} />
        导出报告
      </button>

      <button
        onClick={resetState}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 text-gray-300 hover:text-white transition-colors text-sm"
      >
        <RotateCcw size={16} />
        重置
      </button>

      <div className="w-px h-6 bg-cyan-500/20" />

      <div className="relative">
        <button
          onClick={() => setShowViews(!showViews)}
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 text-gray-300 hover:text-white transition-colors text-sm"
        >
          <Eye size={16} />
          视角
          <Maximize2 size={12} />
        </button>

        {showViews && (
          <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-md rounded-lg border border-cyan-500/20 shadow-2xl py-2 min-w-32 z-50">
            {cameraViews.map((view) => (
              <button
                key={view.id}
                onClick={() => {
                  setCurrentCameraView(view.id);
                  setShowViews(false);
                }}
                className={cn(
                  'w-full px-4 py-2 text-left text-sm transition-colors',
                  currentCameraView === view.id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-300 hover:bg-slate-800'
                )}
              >
                {view.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
