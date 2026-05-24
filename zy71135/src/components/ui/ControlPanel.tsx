import { RotateCcw, Download, Eye, Play, Upload } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { downloadReport } from '../../utils/export';
import { CameraView } from '../../types';

const viewOptions: { value: CameraView; label: string }[] = [
  { value: 'overview', label: '总览' },
  { value: 'bow', label: '船首' },
  { value: 'stern', label: '船尾' },
  { value: 'side', label: '侧面' },
];

export function ControlPanel() {
  const cameraView = useStore((state) => state.cameraView);
  const setCameraView = useStore((state) => state.setCameraView);
  const resetState = useStore((state) => state.resetState);
  const loadSampleData = useStore((state) => state.loadSampleData);
  const exportReport = useStore((state) => state.exportReport);

  const handleExport = () => {
    const report = exportReport();
    downloadReport(report);
  };

  return (
    <div className="bg-gray-900 p-4 border-b border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            onClick={loadSampleData}
          >
            <Upload className="w-4 h-4" />
            导入样例
          </button>

          <button
            className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            onClick={resetState}
          >
            <RotateCcw className="w-4 h-4" />
            重置状态
          </button>

          <button
            className="flex items-center gap-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition-colors"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">视角:</span>
          {viewOptions.map((option) => (
            <button
              key={option.value}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                cameraView === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setCameraView(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
