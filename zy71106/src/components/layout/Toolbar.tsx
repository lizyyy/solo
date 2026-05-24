import { useState } from 'react';
import {
  Upload,
  RotateCcw,
  Download,
  Eye,
  Sun,
  ChevronDown,
} from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { useTimeStore } from '../../store/useTimeStore';
import { ViewPreset } from '../../types';

interface ToolbarProps {
  onExportReport: () => void;
  onSetViewPreset: (preset: ViewPreset) => void;
}

const viewPresets: { value: ViewPreset; label: string }[] = [
  { value: 'overview', label: '总览' },
  { value: 'top', label: '俯视' },
  { value: 'front', label: '正视' },
  { value: 'side', label: '侧视' },
  { value: 'birdseye', label: '鸟瞰' },
];

export function Toolbar({ onExportReport, onSetViewPreset }: ToolbarProps) {
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const resetScene = useSceneStore((state) => state.reset);
  const loadSample = useSceneStore((state) => state.loadSample);
  const resetTime = useTimeStore((state) => state.reset);

  const handleReset = () => {
    resetScene();
    resetTime();
    setTimeout(() => loadSample(), 100);
  };

  const handleLoadSample = () => {
    loadSample();
    setShowImportMenu(false);
  };

  const handleViewPreset = (preset: ViewPreset) => {
    onSetViewPreset(preset);
    setShowViewMenu(false);
  };

  return (
    <div className="h-14 bg-gray-900/90 backdrop-blur-md border-b border-gray-700 flex items-center px-4 gap-2">
      <div className="flex items-center gap-2 mr-4">
        <Sun className="w-6 h-6 text-orange-500" />
        <span className="text-white font-bold text-lg">光伏阴影分析</span>
      </div>

      <div className="h-6 w-px bg-gray-600 mx-2" />

      <div className="relative">
        <button
          onClick={() => setShowImportMenu(!showImportMenu)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          导入样例
          <ChevronDown className="w-3 h-3" />
        </button>
        {showImportMenu && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 min-w-40 z-50">
            <button
              onClick={handleLoadSample}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              标准院落
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowViewMenu(!showViewMenu)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
        >
          <Eye className="w-4 h-4" />
          视角
          <ChevronDown className="w-3 h-3" />
        </button>
        {showViewMenu && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 min-w-32 z-50">
            {viewPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleViewPreset(preset.value)}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleReset}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
      >
        <RotateCcw className="w-4 h-4" />
        重置
      </button>

      <div className="flex-1" />

      <button
        onClick={onExportReport}
        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        导出报告
      </button>
    </div>
  );
}
