import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Eye,
  Camera,
  Layers,
  Sidebar,
  Zap,
  Download,
  FileJson,
  FileText,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CameraView } from '../../types';

const cameraViews: { id: CameraView; label: string; icon: typeof Eye }[] = [
  { id: 'default', label: '默认视角', icon: Eye },
  { id: 'top', label: '俯视图', icon: Layers },
  { id: 'side', label: '侧视图', icon: Sidebar },
  { id: 'gantry', label: '吊机视角', icon: Camera },
];

const speedOptions = [0.5, 1, 2, 3];

export function BottomBar() {
  const {
    currentTask,
    timeline,
    setTimelineStep,
    setTimelinePlaying,
    setTimelineSpeed,
    cameraView,
    setCameraView,
  } = useStore();

  const totalSteps = currentTask?.moves.length || 0;
  const progress = totalSteps > 0 ? (timeline.currentStep / (totalSteps - 1)) * 100 : 0;

  const handlePlayPause = () => {
    if (!currentTask) return;
    if (timeline.currentStep >= totalSteps - 1) {
      setTimelineStep(0);
    }
    setTimelinePlaying(!timeline.isPlaying);
  };

  const handleStepBack = () => {
    setTimelinePlaying(false);
    setTimelineStep(Math.max(0, timeline.currentStep - 1));
  };

  const handleStepForward = () => {
    setTimelinePlaying(false);
    if (currentTask) {
      setTimelineStep(Math.min(totalSteps - 1, timeline.currentStep + 1));
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTask) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const step = Math.round(percentage * (totalSteps - 1));
    setTimelineStep(Math.max(0, Math.min(totalSteps - 1, step)));
  };

  return (
    <div className="h-20 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 flex items-center px-4 gap-6">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm whitespace-nowrap">视角:</span>
        <div className="flex gap-1">
          {cameraViews.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setCameraView(view.id)}
                className={`p-2 rounded transition-colors ${
                  cameraView === view.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={view.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleStepBack}
            disabled={!currentTask || timeline.currentStep === 0}
            className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={handlePlayPause}
            disabled={!currentTask}
            className={`p-3 rounded transition-colors ${
              timeline.isPlaying
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'bg-green-600 hover:bg-green-500 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {timeline.isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          <button
            onClick={handleStepForward}
            disabled={!currentTask || timeline.currentStep >= totalSteps - 1}
            className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1">
          <div
            className="h-2 bg-gray-700 rounded-full cursor-pointer relative overflow-hidden"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-all"
              style={{ left: `calc(${progress}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500 text-xs">
              {currentTask ? `步骤 ${timeline.currentStep + 1}` : '---'}
            </span>
            <span className="text-gray-500 text-xs">
              {currentTask ? `共 ${totalSteps} 步` : '---'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <select
            value={timeline.speed}
            onChange={(e) => setTimelineSpeed(Number(e.target.value))}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            {speedOptions.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm whitespace-nowrap">导出:</span>
        <button
          onClick={() => {
            const { containers, yard, currentTask } = useStore.getState();
            const data = {
              exportTime: new Date().toISOString(),
              yard,
              containers,
              currentTask,
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yard-analysis-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors flex items-center gap-2"
          title="导出JSON"
        >
          <FileJson className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">JSON</span>
        </button>
        <button
          onClick={() => {
            import('../../utils/exportReport').then(({ exportPDFReport }) => {
              exportPDFReport();
            });
          }}
          className="p-2 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-2"
          title="导出报告"
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">报告</span>
        </button>
      </div>
    </div>
  );
}
