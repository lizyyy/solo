import { useState } from 'react';
import { Play, Square, RotateCcw, Download, Eye, ChevronDown } from 'lucide-react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { sampleScenes } from '@/data/sampleScenes';
import { CameraView } from '@/types';
import { exportReport } from '@/utils/reportGenerator';

const cameraViews: { id: CameraView; label: string }[] = [
  { id: 'default', label: '默认视角' },
  { id: 'top', label: '鸟瞰视角' },
  { id: 'front', label: '正视视角' },
  { id: 'side', label: '侧视视角' },
];

export function TopBar() {
  const [sceneDropdownOpen, setSceneDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);

  const {
    currentScene,
    setScene,
    isPlaying,
    setPlaying,
    resetSimulation,
    setCameraView,
    cameraView,
    generateReport,
  } = useSimulationStore();

  const handleExportReport = () => {
    const report = generateReport();
    exportReport(report);
  };

  const handleSceneChange = (sceneId: string) => {
    const scene = sampleScenes.find((s) => s.id === sceneId);
    if (scene) {
      setScene(scene);
      setSceneDropdownOpen(false);
    }
  };

  const handleViewChange = (view: CameraView) => {
    setCameraView(view);
    setViewDropdownOpen(false);
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-gray-900/90 backdrop-blur-md border-b border-gray-700/50 flex items-center justify-between px-4 z-20">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          果园喷药漂移预演
        </h1>

        <div className="relative">
          <button
            onClick={() => setSceneDropdownOpen(!sceneDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
          >
            <span>场景:</span>
            <span className="text-green-400">{currentScene.name}</span>
            <ChevronDown size={16} className={`transition-transform ${sceneDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {sceneDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 min-w-64 overflow-hidden">
              {sampleScenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => handleSceneChange(scene.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                    currentScene.id === scene.id ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="font-medium text-white text-sm">{scene.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{scene.description}</div>
                  <div className="flex gap-1 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      scene.type === 'normal' ? 'bg-green-900 text-green-300' :
                      scene.type === 'conflict' ? 'bg-red-900 text-red-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {scene.type === 'normal' ? '正常' : scene.type === 'conflict' ? '冲突' : '无风'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
          >
            <Eye size={16} />
            <span>{cameraViews.find(v => v.id === cameraView)?.label}</span>
            <ChevronDown size={16} className={`transition-transform ${viewDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {viewDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 min-w-32 overflow-hidden">
              {cameraViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => handleViewChange(view.id)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                    cameraView === view.id ? 'bg-gray-700 text-green-400' : 'text-white'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setPlaying(!isPlaying)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isPlaying
              ? 'bg-orange-600 hover:bg-orange-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isPlaying ? <><Square size={16} /> 暂停</> : <><Play size={16} /> 开始模拟</>}
        </button>

        <button
          onClick={resetSimulation}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
        >
          <RotateCcw size={16} />
          重置
        </button>

        <button
          onClick={handleExportReport}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white transition-colors"
        >
          <Download size={16} />
          导出报告
        </button>
      </div>
    </div>
  );
}