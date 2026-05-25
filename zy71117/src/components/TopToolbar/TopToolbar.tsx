import { useState } from 'react';
import { Play, Pause, RotateCcw, Eye, Download, FileText, Camera, Grid3X3, User, ChevronDown } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { generateDefaultPath, calculateSweepArea } from '../../utils/pathCalculator';
import { detectCollisions } from '../../utils/collision';
import { generateReport, downloadReport } from '../../utils/reportGenerator';
import { Sample, CameraView } from '../../types';

export function TopToolbar() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<'html' | 'pdf'>('pdf');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const {
    samples,
    vehicle,
    scene,
    currentSample,
    simulation,
    setCurrentSample,
    setSimulationStatus,
    setProgress,
    setPath,
    setSweepAreas,
    setCollisionPoints,
    setCameraView,
    resetSimulation,
  } = useSimulationStore();

  const filteredSamples = filterCategory === 'all'
    ? samples
    : samples.filter((s: Sample) => s.category === filterCategory);

  const handleStartSimulation = () => {
    if (simulation.status === 'idle' || simulation.currentPath.length === 0) {
      const path = generateDefaultPath(vehicle, 0, scene.loadingDocks.length);
      const sweepAreas = calculateSweepArea(path, vehicle);
      const collisions = detectCollisions(path, vehicle, scene);

      setPath(path);
      setSweepAreas(sweepAreas);
      setCollisionPoints(collisions);
    }

    if (simulation.status === 'finished') {
      setProgress(0);
    }

    setSimulationStatus('playing');
  };

  const handlePauseSimulation = () => {
    setSimulationStatus('paused');
  };

  const handleReset = () => {
    resetSimulation();
  };

  const handleExportReport = () => {
    const report = generateReport(
      currentSample?.name || '自定义场景',
      vehicle,
      scene,
      simulation.currentPath,
      simulation.collisionPoints
    );
    downloadReport(report, exportFormat);
    setShowExportMenu(false);
  };

  const cameraViews: { id: CameraView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'free', label: '自由', icon: Grid3X3 },
    { id: 'top', label: '俯视', icon: Eye },
    { id: 'side', label: '侧视', icon: Camera },
    { id: 'follow', label: '跟随', icon: Eye },
    { id: 'driver', label: '驾驶舱', icon: User },
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">样例场景:</label>
          <select
            value={currentSample?.id || ''}
            onChange={(e) => {
              const sample = samples.find((s: Sample) => s.id === e.target.value);
              if (sample) setCurrentSample(sample);
            }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {filteredSamples.map((s: Sample) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-gray-600" />

        <div className="flex items-center gap-1">
          {(['all', 'normal', 'collision', 'empty'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filterCategory === cat
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat === 'all' ? '全部' : cat === 'normal' ? '正常' : cat === 'collision' ? '冲突' : '空场地'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 px-4 py-2 flex items-center gap-2">
        {simulation.status === 'playing' ? (
          <button
            onClick={handlePauseSimulation}
            className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
            title="暂停"
          >
            <Pause className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleStartSimulation}
            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            title="开始模拟"
          >
            <Play className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={handleReset}
          className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          title="重置"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-gray-600" />

        <div className="flex items-center gap-1">
          {cameraViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setCameraView(view.id)}
              className={`p-2 rounded-lg transition-colors ${
                simulation.cameraView === view.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
              title={view.label}
            >
              <view.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-600" />

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={simulation.currentPath.length === 0}
            className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-1"
            title="导出报告"
          >
            <Download className="w-5 h-5" />
            <FileText className="w-4 h-4" />
            <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>

          {showExportMenu && (
            <div className="absolute top-full right-0 mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden min-w-[140px]">
              <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
                导出格式
              </div>
              <button
                onClick={() => {
                  setExportFormat('pdf');
                  handleExportReport();
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  exportFormat === 'pdf' ? 'bg-blue-500/20 text-blue-400' : 'text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                PDF 格式
              </button>
              <button
                onClick={() => {
                  setExportFormat('html');
                  handleExportReport();
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  exportFormat === 'html' ? 'bg-blue-500/20 text-blue-400' : 'text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                HTML 格式
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
