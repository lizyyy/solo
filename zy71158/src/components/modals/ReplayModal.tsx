import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { X, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export default function ReplayModal() {
  const { history, level, setPhase } = useGameStore();
  const [currentIndex, setCurrentIndex] = useState(history.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= history.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, history.length]);

  const currentFrame = history[currentIndex];

  const handleClose = () => {
    setPhase('settlement');
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(history.length - 1, prev + 1));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(parseInt(e.target.value));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-night-panel rounded-2xl border border-night-border max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-night-panel border-b border-night-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neon-purple">🎬 历史回放</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-night-border transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {currentFrame ? (
            <>
              <div className="bg-night-card rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-neon-yellow font-bold">
                    回合 {currentFrame.round}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {currentFrame.action}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-2 bg-night-bg rounded">
                    <div className="text-xs text-gray-500">用电</div>
                    <div className="text-lg font-bold text-neon-cyan">
                      {Math.round(currentFrame.snapshot.totalElectricity)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-night-bg rounded">
                    <div className="text-xs text-gray-500">油烟</div>
                    <div className="text-lg font-bold text-neon-orange">
                      {Math.round(currentFrame.snapshot.totalSmoke)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-night-bg rounded">
                    <div className="text-xs text-gray-500">投诉</div>
                    <div className="text-lg font-bold text-neon-red">
                      {currentFrame.snapshot.complaints}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-night-bg rounded">
                    <div className="text-xs text-gray-500">资金</div>
                    <div className="text-lg font-bold text-neon-yellow">
                      ¥{currentFrame.snapshot.money}
                    </div>
                  </div>
                </div>

                <div className="border-t border-night-border pt-4">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">摊位状态</h4>
                  <div className="space-y-2">
                    {currentFrame.snapshot.stalls.map((stall, idx) => (
                      <div
                        key={stall.id}
                        className="flex items-center justify-between text-sm bg-night-bg rounded px-3 py-2"
                      >
                        <span className="text-gray-300">摊位 {idx + 1}</span>
                        <div className="flex items-center gap-3">
                          <span
                            className={stall.isOn ? 'text-neon-cyan' : 'text-gray-500'}
                          >
                            {stall.isOn ? 'ON' : 'OFF'}
                          </span>
                          <span className="text-gray-400">
                            功率: {stall.power}%
                          </span>
                          <span className="text-gray-400">
                            排烟: {stall.exhaustLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-night-card rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">时间轴</h4>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePrev}
                    className="p-2 rounded-lg bg-night-border hover:bg-night-card transition-colors"
                  >
                    <SkipBack size={16} className="text-gray-400" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded-lg bg-neon-purple/20 hover:bg-neon-purple/30 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause size={16} className="text-neon-purple" />
                    ) : (
                      <Play size={16} className="text-neon-purple" />
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-2 rounded-lg bg-night-border hover:bg-night-card transition-colors"
                  >
                    <SkipForward size={16} className="text-gray-400" />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max={history.length - 1}
                    value={currentIndex}
                    onChange={handleSliderChange}
                    className="flex-1 h-1 bg-night-border rounded-lg appearance-none cursor-pointer"
                  />
                  <select
                    value={playSpeed}
                    onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
                    className="bg-night-card border border-night-border rounded px-2 py-1 text-sm text-gray-300"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={4}>4x</option>
                  </select>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>0%</span>
                  <span>
                    {Math.round((currentIndex / (history.length - 1)) * 100)}%
                  </span>
                  <span>100%</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">暂无历史数据</div>
          )}
        </div>

        <div className="border-t border-night-border p-4 flex justify-center">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-night-border text-gray-300 rounded-lg hover:bg-night-card transition-colors"
          >
            返回结算
          </button>
        </div>
      </div>
    </div>
  );
}