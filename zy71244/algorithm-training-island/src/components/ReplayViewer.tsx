import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { ACTIVITY_NAMES } from '../data/constants';

interface ReplayViewerProps {
  onClose: () => void;
}

export const ReplayViewer: React.FC<ReplayViewerProps> = ({ onClose }) => {
  const { state } = useGame();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);

  const replay = state.replay;
  const steps = replay.steps;

  const currentStep = steps[currentStepIndex];

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
        if (currentStepIndex >= steps.length - 1) {
        setCurrentStepIndex(0);
      }
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, steps.length, playSpeed]);

  const handleStepChange = (index: number) => {
    setIsPlaying(false);
    setCurrentStepIndex(index);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaySpeed(speed);
  };

  const handleExport = () => {
    const data = JSON.stringify(replay, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-2xl w-full border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">🎥 回放查看器</h2>
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-lg">暂无回放数据</p>
            <p className="text-sm mt-2">完成一些训练后才能查看回放</p>
          </div>
          <button onClick={onClose} className="btn-primary w-full mt-6">
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">🎥 回放查看器</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">
          ✕
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleStepChange(Math.max(0, currentStepIndex - 1))}
          disabled={currentStepIndex === 0}
          className="btn-secondary disabled:opacity-50"
        >
          ⏮
        </button>
        <button onClick={handlePlayPause} className="btn-primary">
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button
          onClick={() => handleStepChange(Math.min(steps.length - 1, currentStepIndex + 1))}
          disabled={currentStepIndex === steps.length - 1}
          className="btn-secondary disabled:opacity-50"
        >
          ⏭
        </button>
        <select
          value={playSpeed}
          onChange={e => handleSpeedChange(Number(e.target.value))}
          className="bg-slate-700 text-white rounded-lg px-4 border border-slate-600"
        >
          <option value={2000}>0.5x</option>
          <option value={1000}>1x</option>
          <option value={500}>2x</option>
          <option value={250}>4x</option>
        </select>
        <button onClick={handleExport} className="btn-secondary ml-auto">
          📤 导出
        </button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>第 {currentStep?.day || 0} 天</span>
          <span>{currentStepIndex + 1} / {steps.length}</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden cursor-pointer">
          <div
            className="h-full bg-purple-500 rounded-full transition-all"
            style={{ width: `${((currentStepIndex + 1) / steps.length * 100)}%` }}
          />
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto pb-2">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleStepChange(idx)}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                idx === currentStepIndex
                ? 'bg-purple-600 text-white scale-110'
                : idx < currentStepIndex
                ? 'bg-purple-900 text-purple-300'
                : 'bg-slate-700 text-slate-400'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        {currentStep && (
          <div className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-3">
                📅 第 {currentStep.day} 天
              </h3>

              {currentStep.state.members && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {currentStep.state.members.map((member, idx) => (
                    <div key={idx} className="bg-slate-700 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-2xl">{member.avatar}</div>
                        <div>
                          <div className="font-medium text-white">{member.name}</div>
                          <div className="text-xs text-slate-400">
                            能力: {member.overallAbility} | 疲劳: {Math.round(member.fatigue)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center text-white">
                总得分: <span className="font-bold text-purple-400">{currentStep.state.totalScore}</span>
              </div>
            </div>

            {currentStep.decisions.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">🎯 关键决策</h4>
                <div className="space-y-2">
                  {currentStep.decisions.map((decision, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        decision.riskLevel === 'high'
                          ? 'bg-red-900/30 border-red-700'
                          : decision.riskLevel === 'medium'
                          ? 'bg-yellow-900/30 border-yellow-700'
                          : 'bg-blue-900/30 border-blue-700'
                      }`}
                    >
                      <div className="font-medium text-white">{decision.description}</div>
                      <div className="text-sm text-slate-300">{decision.impact}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep.results.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">📝 训练结果</h4>
                <div className="space-y-2">
                  {currentStep.results.map((result, idx) => {
                  const member = currentStep.state.members?.find(m => m.id === result.memberId);
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        result.isCrash
                          ? 'bg-red-900/30 border-red-700'
                          : result.success
                          ? 'bg-green-900/30 border-green-700'
                          : 'bg-yellow-900/30 border-yellow-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {member?.name} - {ACTIVITY_NAMES[result.type]}
                        </span>
                        {result.isCrash && <span className="badge badge-danger">崩盘!</span>}
                      </div>
                      <div className="text-sm text-slate-300">{result.message}</div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs">
                        {result.fatigueChange !== 0 && (
                          <span className={result.fatigueChange > 0 ? 'text-red-400' : 'text-green-400'}>
                            疲劳: {result.fatigueChange > 0 ? '+' : ''}{result.fatigueChange}
                          </span>
                        )}
                        {result.overallAbilityChange !== 0 && (
                          <span className="text-purple-400">
                            能力: {result.overallAbilityChange > 0 ? '+' : ''}{result.overallAbilityChange}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
        <div className="text-sm text-slate-400">
          版本: {replay.version.dataVersion} | 游戏ID: {replay.gameId}
        </div>
        <div className="text-sm text-slate-400">
          最终结果: {replay.finalResult === 'won' ? '🏆 胜利' : 
                     replay.finalResult === 'lost' ? '😔 失败' : 
                     replay.finalResult === 'crashed' ? '💥 崩盘' : '🎮 进行中'} | 得分: {replay.finalScore}
        </div>
      </div>
      </div>
    </div>
  );
};
