import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function Timeline() {
  const loadHistory = useStore((state) => state.loadHistory);
  const currentStep = useStore((state) => state.currentStep);
  const isPlaying = useStore((state) => state.isPlaying);
  const jumpToStep = useStore((state) => state.jumpToStep);
  const togglePlay = useStore((state) => state.togglePlay);
  const cargoList = useStore((state) => state.cargoList);

  const playIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = window.setInterval(() => {
        if (currentStep < loadHistory.length) {
          jumpToStep(currentStep + 1);
        } else {
          togglePlay();
        }
      }, 1000);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, currentStep, loadHistory.length, jumpToStep, togglePlay]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const step = parseInt(e.target.value, 10);
    jumpToStep(step);
  };

  const handleStepBack = () => {
    if (currentStep > 0) {
      jumpToStep(currentStep - 1);
    }
  };

  const handleStepForward = () => {
    if (currentStep < loadHistory.length) {
      jumpToStep(currentStep + 1);
    }
  };

  const getStepLabel = (index: number) => {
    if (index === 0) return '初始状态';
    const record = loadHistory[index - 1];
    const cargo = cargoList.find((c) => c.id === record.cargoId);
    const action = record.action === 'load' ? '装载' : '卸载';
    return `${action}: ${cargo?.name || record.cargoId}`;
  };

  return (
    <div className="bg-gray-900 px-4 py-3 border-t border-gray-700">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">装载步骤</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50"
            onClick={handleStepBack}
            disabled={currentStep === 0}
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            className={`p-1.5 rounded transition-colors ${
              isPlaying
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            onClick={togglePlay}
            disabled={loadHistory.length === 0 || currentStep >= loadHistory.length}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50"
            onClick={handleStepForward}
            disabled={currentStep >= loadHistory.length}
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <input
            type="range"
            min="0"
            max={Math.max(loadHistory.length, 1)}
            value={currentStep}
            onChange={handleSliderChange}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3E92CC 0%, #3E92CC ${(currentStep / Math.max(loadHistory.length, 1)) * 100}%, #374151 ${(currentStep / Math.max(loadHistory.length, 1)) * 100}%, #374151 100%)`,
            }}
          />
          <span className="text-sm text-gray-300 font-mono min-w-16 text-right">
            {currentStep} / {loadHistory.length}
          </span>
        </div>

        {currentStep > 0 && (
          <div className="text-sm text-gray-400 max-w-xs truncate">
            {getStepLabel(currentStep)}
          </div>
        )}
      </div>

      {loadHistory.length > 0 && (
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
          {Array.from({ length: loadHistory.length + 1 }, (_, i) => (
            <button
              key={i}
              className={`w-6 h-6 rounded-full text-xs flex items-center justify-center flex-shrink-0 transition-colors ${
                i === currentStep
                  ? 'bg-blue-600 text-white'
                  : i < currentStep
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              onClick={() => jumpToStep(i)}
              title={getStepLabel(i)}
            >
              {i}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
