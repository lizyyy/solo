
import { useState } from 'react';
import {
  Upload,
  Play,
  RotateCcw,
  Download,
  Grid3X3,
  Layers,
  Box,
  RefreshCw,
  FileText,
  Image,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { useModelStore } from '../../store/useModelStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useCollisionStore } from '../../store/useCollisionStore';
import { useFilterStore } from '../../store/useFilterStore';
import { exportScreenshot, exportCollisionList, downloadCSV } from '../../utils/export';
import { SceneManager } from '../../three/SceneManager';

interface ToolbarProps {
  sceneManager: SceneManager | null;
  onDetectCollisions: () => void;
}

export function Toolbar({ sceneManager, onDetectCollisions }: ToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  
  const { loadSampleData, loaded, getFilteredElements } = useModelStore();
  const { showGrid, setShowGrid, showAxes, setShowAxes, showElevationLines, setShowElevationLines, wireframeMode, setWireframeMode, resetCamera, autoRotate, setAutoRotate } = useSceneStore();
  const { collisions, getStatistics, isDetecting } = useCollisionStore();
  const { resetFilters } = useFilterStore();

  const stats = getStatistics();

  const handleLoadSample = async () => {
    setIsLoadingSample(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    loadSampleData();
    setIsLoadingSample(false);
  };

  const handleExportImage = async () => {
    if (!sceneManager) return;
    const canvas = sceneManager.getRenderer().domElement;
    await exportScreenshot(canvas, `碰撞视图_${new Date().toISOString().split('T')[0]}.png`);
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    const csv = exportCollisionList(collisions, getFilteredElements());
    downloadCSV(csv, `碰撞报告_${new Date().toISOString().split('T')[0]}.csv`);
    setShowExportMenu(false);
  };

  const handleReset = () => {
    resetCamera();
    resetFilters();
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Box className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-white font-semibold text-sm hidden sm:block">管线碰撞检查系统</h1>
        </div>

        <div className="h-6 w-px bg-slate-700 mx-2" />

        <button
          onClick={handleLoadSample}
          disabled={isLoadingSample || loaded}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">导入样例</span>
        </button>

        <button
          onClick={onDetectCollisions}
          disabled={!loaded || isDetecting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
        >
          {isDetecting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">碰撞检测</span>
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-md transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">重置</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {loaded && (
          <div className="hidden md:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">碰撞:</span>
              <span className="text-orange-400 font-semibold">{stats.total}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-orange-400">硬: {stats.hard}</span>
              <span className="text-yellow-400">软: {stats.soft}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-md transition-colors ${showGrid ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="显示网格"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAxes(!showAxes)}
            className={`p-1.5 rounded-md transition-colors ${showAxes ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="显示坐标轴"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowElevationLines(!showElevationLines)}
            className={`p-1.5 rounded-md transition-colors ${showElevationLines ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="显示标高面"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`p-1.5 rounded-md transition-colors ${wireframeMode ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="线框模式"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-md transition-colors ${autoRotate ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="自动旋转"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>

        <div className="h-6 w-px bg-slate-700 mx-1" />

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">导出</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1 min-w-[140px] z-20">
              <button
                onClick={handleExportImage}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <Image className="w-3.5 h-3.5" />
                截图导出
              </button>
              <button
                onClick={handleExportCSV}
                disabled={collisions.length === 0}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV 报表
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
