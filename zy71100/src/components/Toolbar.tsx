import { useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  Package,
  Layers,
  Map,
  Camera,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileJson,
  FileText,
  Database,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { exportReport, exportHeatmapData } from '../utils/export';
import { calculateHeatmap } from '../utils/heatmap';
import type { Warehouse, Shelf, Aisle, PickingOrder } from '../data/types';

interface ImportedData {
  warehouse?: Warehouse;
  shelves?: Shelf[];
  aisles?: Aisle[];
  pickingOrders?: PickingOrder[];
}

export function Toolbar() {
  const {
    isPlaying,
    togglePlay,
    resetState,
    showHeatmap,
    showPaths,
    showShelves,
    toggleHeatmap,
    togglePaths,
    toggleShelves,
    viewMode,
    setViewMode,
    toggleLeftPanel,
    toggleRightPanel,
    leftPanelOpen,
    rightPanelOpen,
    playbackSpeed,
    setPlaybackSpeed,
    heatmapIntensity,
    timeRange,
    selectedOrders,
    importData,
    loadSampleData,
    pickingOrders,
    aisles,
  } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  const validateImportData = (data: unknown): data is ImportedData => {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;

    if (obj.warehouse && typeof obj.warehouse !== 'object') return false;
    if (obj.shelves && !Array.isArray(obj.shelves)) return false;
    if (obj.aisles && !Array.isArray(obj.aisles)) return false;
    if (obj.pickingOrders && !Array.isArray(obj.pickingOrders)) return false;

    return true;
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (validateImportData(data)) {
            importData(data);
            setShowImportMenu(false);
          } else {
            alert('数据格式不正确，请检查导入文件');
          }
        } catch {
          alert('文件格式错误，请导入有效的 JSON 文件');
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const visibleOrders = selectedOrders.length === 0
    ? pickingOrders
    : pickingOrders.filter((o) => selectedOrders.includes(o.id));

  const timeFilteredOrders = visibleOrders.filter(
    (order) =>
      order.startTime >= timeRange.start && order.endTime <= timeRange.end
  );

  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between px-4 z-20">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 mr-4">
          <Map className="w-6 h-6 text-blue-400" />
          <span className="text-white font-semibold text-lg">仓库拣货热力图</span>
        </div>

        <div className="h-8 w-px bg-slate-700 mx-2" />

        <button
          onClick={toggleLeftPanel}
          className="p-2 rounded hover:bg-slate-700 transition-colors"
          title="切换左侧面板"
        >
          <ChevronLeft className={`w-5 h-5 text-slate-300 transition-transform ${!leftPanelOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="h-6 w-px bg-slate-700 mx-1" />

        <button
          onClick={togglePlay}
          className={`p-2 rounded transition-colors ${isPlaying ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setShowSpeedMenu(!showSpeedMenu);
              setShowViewMenu(false);
              setShowExportMenu(false);
              setShowImportMenu(false);
            }}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-sm text-slate-200"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute top-full left-0 mt-1 bg-slate-800 rounded shadow-lg py-1 min-w-20">
              {[0.5, 1, 2, 4, 8].map((speed) => (
                <button
                  key={speed}
                  onClick={() => {
                    setPlaybackSpeed(speed);
                    setShowSpeedMenu(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-sm hover:bg-slate-700 ${playbackSpeed === speed ? 'text-blue-400' : 'text-slate-300'}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={resetState}
          className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          title="重置状态"
        >
          <RotateCcw className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleHeatmap}
          className={`p-2 rounded transition-colors ${showHeatmap ? 'bg-blue-600/30 border border-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
          title="热力图"
        >
          <Layers className={`w-5 h-5 ${showHeatmap ? 'text-blue-400' : 'text-slate-300'}`} />
        </button>

        <button
          onClick={togglePaths}
          className={`p-2 rounded transition-colors ${showPaths ? 'bg-green-600/30 border border-green-500' : 'bg-slate-700 hover:bg-slate-600'}`}
          title="路径显示"
        >
          {showPaths ? <Eye className="w-5 h-5 text-green-400" /> : <EyeOff className="w-5 h-5 text-slate-300" />}
        </button>

        <button
          onClick={toggleShelves}
          className={`p-2 rounded transition-colors ${showShelves ? 'bg-amber-600/30 border border-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`}
          title="货架显示"
        >
          <Package className={`w-5 h-5 ${showShelves ? 'text-amber-400' : 'text-slate-300'}`} />
        </button>

        <div className="h-6 w-px bg-slate-700 mx-1" />

        <div className="relative">
          <button
            onClick={() => {
              setShowViewMenu(!showViewMenu);
              setShowExportMenu(false);
              setShowSpeedMenu(false);
              setShowImportMenu(false);
            }}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors flex items-center gap-1"
            title="视角切换"
          >
            <Camera className="w-5 h-5 text-slate-300" />
            <span className="text-xs text-slate-300 capitalize">{viewMode}</span>
          </button>
          {showViewMenu && (
            <div className="absolute top-full right-0 mt-1 bg-slate-800 rounded shadow-lg py-1 min-w-32">
              {(['perspective', 'top', 'front', 'side'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    setShowViewMenu(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-sm hover:bg-slate-700 capitalize ${viewMode === mode ? 'text-blue-400' : 'text-slate-300'}`}
                >
                  {mode === 'perspective' && '透视视图'}
                  {mode === 'top' && '俯视图'}
                  {mode === 'front' && '正视图'}
                  {mode === 'side' && '侧视图'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowExportMenu(!showExportMenu);
              setShowViewMenu(false);
              setShowSpeedMenu(false);
              setShowImportMenu(false);
            }}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            title="导出"
          >
            <Download className="w-5 h-5 text-slate-300" />
          </button>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-1 bg-slate-800 rounded shadow-lg py-1 min-w-44 z-30">
              <button
                onClick={() => {
                  const viewport = document.querySelector('[data-viewport]') as HTMLElement;
                  if (viewport) {
                    exportReport(viewport, timeFilteredOrders, aisles, timeRange, heatmapIntensity);
                  }
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-1.5 text-left text-sm hover:bg-slate-700 text-slate-300 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                导出分析报告 (PDF)
              </button>
              <button
                onClick={() => {
                  const heatmapData = calculateHeatmap(timeFilteredOrders, aisles, timeRange, 1, heatmapIntensity);
                  exportHeatmapData(heatmapData, timeRange);
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-1.5 text-left text-sm hover:bg-slate-700 text-slate-300 flex items-center gap-2"
              >
                <FileJson className="w-4 h-4" />
                导出热力数据 (JSON)
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowImportMenu(!showImportMenu);
              setShowExportMenu(false);
              setShowViewMenu(false);
              setShowSpeedMenu(false);
            }}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            title="导入数据"
          >
            <Upload className="w-5 h-5 text-slate-300" />
          </button>
          {showImportMenu && (
            <div className="absolute top-full right-0 mt-1 bg-slate-800 rounded shadow-lg py-1 min-w-44 z-30">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-1.5 text-left text-sm hover:bg-slate-700 text-slate-300 flex items-center gap-2"
              >
                <FileJson className="w-4 h-4" />
                导入 JSON 数据
              </button>
              <button
                onClick={() => {
                  loadSampleData();
                  setShowImportMenu(false);
                }}
                className="w-full px-4 py-1.5 text-left text-sm hover:bg-slate-700 text-slate-300 flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                加载样例数据
              </button>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-700 mx-1" />

        <button
          onClick={toggleRightPanel}
          className="p-2 rounded hover:bg-slate-700 transition-colors"
          title="切换右侧面板"
        >
          <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${!rightPanelOpen ? '-rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
