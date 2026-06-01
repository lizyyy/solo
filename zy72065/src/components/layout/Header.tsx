import {
  Mountain,
  Upload,
  Save,
  Download,
  FolderOpen,
  Database,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CoordinateSystem } from '../../types';

interface HeaderProps {
  onSaveSolution: () => void;
  onExport: () => void;
}

export function Header({ onSaveSolution, onExport }: HeaderProps) {
  const loadSampleData = useStore((state) => state.loadSampleData);
  const clearAllData = useStore((state) => state.clearAllData);
  const setShowImportModal = useStore((state) => state.setShowImportModal);
  const coordinateSystem = useStore((state) => state.coordinateSystem);
  const setCoordinateSystem = useStore((state) => state.setCoordinateSystem);
  const currentSolutionId = useStore((state) => state.currentSolutionId);
  const solutions = useStore((state) => state.solutions);

  const currentSolution = solutions.find((s) => s.id === currentSolutionId);

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Mountain className="text-blue-500" size={24} />
          <h1 className="text-lg font-bold text-white">矿山边坡滑移预警系统</h1>
        </div>
        {currentSolution && (
          <div className="ml-4 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-400">
            当前方案: {currentSolution.name}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-4">
          <Globe size={14} className="text-gray-400" />
          <select
            value={coordinateSystem}
            onChange={(e) => setCoordinateSystem(e.target.value as CoordinateSystem)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="utm">UTM 坐标系</option>
            <option value="local">地方坐标系</option>
            <option value="wgs84">WGS84 经纬度</option>
          </select>
        </div>

        <div className="h-6 w-px bg-gray-700 mx-2" />

        <div className="flex items-center gap-1">
          <Database size={14} className="text-gray-400" />
          <span className="text-xs text-gray-400 mr-1">样例:</span>
          <button
            onClick={() => loadSampleData('normal')}
            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors"
          >
            顺利处理
          </button>
          <button
            onClick={() => loadSampleData('rework')}
            className="px-2 py-1 text-xs bg-orange-600/20 text-orange-400 rounded hover:bg-orange-600/30 transition-colors flex items-center gap-1"
          >
            <RefreshCw size={10} />
            返工
          </button>
        </div>

        <div className="h-6 w-px bg-gray-700 mx-2" />

        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition-colors border border-gray-700"
        >
          <Upload size={14} />
          导入数据
        </button>

        <button
          onClick={onSaveSolution}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          <Save size={14} />
          保存方案
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
        >
          <Download size={14} />
          导出截图
        </button>

        <button
          onClick={clearAllData}
          className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition-colors"
          title="清空数据"
        >
          <FolderOpen size={16} />
        </button>
      </div>
    </header>
  );
}
