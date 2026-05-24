import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const Timeline: React.FC = () => {
  const {
    isPlaying,
    currentTime,
    totalDuration,
    setPlayState,
    setCurrentTime,
    sceneData,
  } = useAppStore();

  const formatTime = (seconds: number): string => {
    return `${seconds.toFixed(1)}s`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  const handleReset = () => {
    setPlayState(false);
    setCurrentTime(0);
  };

  const handleStepClick = (startTime: number) => {
    setPlayState(false);
    setCurrentTime(startTime);
  };

  const getCurrentStep = () => {
    return sceneData.timeline.find(
      (step) => currentTime >= step.startTime && currentTime < step.endTime
    );
  };

  const currentStep = getCurrentStep();

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-200px)] max-w-4xl">
      <div className="bg-white rounded-xl shadow-lg p-4">
        {currentStep && (
          <div className="mb-3 px-4 py-2 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-700">{currentStep.name}</p>
            <p className="text-xs text-blue-600">{currentStep.description}</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="重置"
            >
              <RotateCcw className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setCurrentTime(Math.max(0, currentTime - 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="上一步"
            >
              <SkipBack className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setPlayState(!isPlaying)}
              className="p-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="下一步"
            >
              <SkipForward className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex-1">
            <div className="relative">
              <input
                type="range"
                min="0"
                max={totalDuration || 100}
                step="0.1"
                value={currentTime}
                onChange={handleSliderChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              {sceneData.timeline.map((step) => (
                <div
                  key={step.id}
                  className="absolute top-0 h-2 bg-blue-200 rounded cursor-pointer hover:bg-blue-300 transition-colors"
                  style={{
                    left: `${(step.startTime / (totalDuration || 100)) * 100}%`,
                    width: `${((step.endTime - step.startTime) / (totalDuration || 100)) * 100}%`,
                  }}
                  onClick={() => handleStepClick(step.startTime)}
                  title={step.name}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(0)}</span>
              <span className="font-medium text-blue-600">{formatTime(currentTime)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>
        </div>

        {sceneData.timeline.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sceneData.timeline.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(step.startTime)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentStep?.id === step.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <span className="font-medium">{index + 1}.</span> {step.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
