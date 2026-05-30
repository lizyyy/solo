import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { STEPS, ERROR_TYPE_INFO } from '../../types';
import { formatTime } from '../../utils/exportUtils';
import { Play, Pause, SkipBack, SkipForward, Filter, ZoomIn, ZoomOut } from 'lucide-react';

export const Timeline = () => {
  const {
    repairSteps, playbackIndex, playbackSpeed, setPlaybackIndex, setPlaybackSpeed,
    filterOptions, setFilterOptions, getFilteredSteps, currentRecord
  } = useGameStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const filteredSteps = getFilteredSteps();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && playbackIndex < filteredSteps.length - 1) {
      interval = setInterval(() => {
        setPlaybackIndex(playbackIndex + 1);
      }, 2000 / playbackSpeed);
    } else if (playbackIndex >= filteredSteps.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackIndex, playbackSpeed, filteredSteps.length, setPlaybackIndex]);

  const togglePlay = () => {
    if (playbackIndex >= filteredSteps.length - 1) {
      setPlaybackIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const stepIcons: Record<string, string> = {
    noise_analysis: '🎵',
    scratch_detection: '🔍',
    cleaning: '🧴',
    listening: '🎧',
    reporting: '📋',
  };

  const selectedStep = selectedStepId ? filteredSteps.find(s => s.id === selectedStepId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-[#D4A574] font-serif">操作时间轴</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="p-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-white/60 w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
            className="p-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaybackIndex(Math.max(0, playbackIndex - 1))}
              className="p-2 rounded-full hover:bg-white/5 text-[#D4A574]"
              disabled={playbackIndex <= 0}
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-[#D4A574] text-[#2C1810] hover:bg-[#E5B685] transition-colors"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              onClick={() => setPlaybackIndex(Math.min(filteredSteps.length - 1, playbackIndex + 1))}
              className="p-2 rounded-full hover:bg-white/5 text-[#D4A574]"
              disabled={playbackIndex >= filteredSteps.length - 1}
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">速度:</span>
            {[0.5, 1, 1.5, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-[#D4A574] text-[#2C1810]'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="text-center text-sm text-white/60 mb-2">
          {playbackIndex + 1} / {filteredSteps.length}
        </div>
      </div>

      {filterOptions.errorTypes.length > 0 || filterOptions.dataSources.length > 0 || filterOptions.stepTypes.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} className="text-[#D4A574]" />
            <span className="text-sm text-white/80 font-serif">筛选条件</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ERROR_TYPE_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => {
                  const current = filterOptions.errorTypes;
                  const next = current.includes(key as any)
                    ? current.filter(t => t !== key)
                    : [...current, key as any];
                  setFilterOptions({ errorTypes: next });
                }}
                className={`px-2 py-1 rounded text-xs border transition-all ${
                  filterOptions.errorTypes.includes(key as any)
                    ? 'border-[#D4A574] bg-[#D4A574]/10'
                    : 'border-white/10 hover:border-white/30'
                }`}
                style={{
                  borderColor: filterOptions.errorTypes.includes(key as any) ? info.color : undefined,
                  color: filterOptions.errorTypes.includes(key as any) ? info.color : undefined,
                }}
              >
                {info.name}
              </button>
            ))}

            <div className="w-px bg-white/10 mx-2" />

            {['system', 'manual'].map((source) => (
              <button
                key={source}
                onClick={() => {
                  const current = filterOptions.dataSources;
                  const next = current.includes(source as any)
                    ? current.filter(s => s !== source)
                    : [...current, source as any];
                  setFilterOptions({ dataSources: next });
                }}
                className={`px-2 py-1 rounded text-xs border transition-all ${
                  filterOptions.dataSources.includes(source as any)
                    ? 'border-[#D4A574] bg-[#D4A574]/10 text-[#D4A574]'
                    : 'border-white/10 hover:border-white/30 text-white/60'
                }`}
              >
                {source === 'system' ? '系统数据' : '人工备注'}
              </button>
            ))}

            <div className="w-px bg-white/10 mx-2" />

            {STEPS.map((step) => (
              <button
                key={step.type}
                onClick={() => {
                  const current = filterOptions.stepTypes;
                  const next = current.includes(step.type)
                    ? current.filter(t => t !== step.type)
                    : [...current, step.type];
                  setFilterOptions({ stepTypes: next });
                }}
                className={`px-2 py-1 rounded text-xs border transition-all ${
                  filterOptions.stepTypes.includes(step.type)
                    ? 'border-[#D4A574] bg-[#D4A574]/10 text-[#D4A574]'
                    : 'border-white/10 hover:border-white/30 text-white/60'
                }`}
              >
                {step.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setFilterOptions({ errorTypes: [], dataSources: [], stepTypes: [] })}
            className="mt-3 text-xs text-white/40 hover:text-white/60"
          >
            清除所有筛选
          </button>
        </div>
      )}

      <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
        <div className="relative">
          <div className="absolute left-[60px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-[#D4A574]/50 to-transparent" />

          <div className="space-y-4">
            {filteredSteps.map((step, index) => {
              const stepInfo = STEPS.find(s => s.type === step.type);
              const isActive = index === playbackIndex;
              const isPast = index < playbackIndex;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex gap-4 relative pl-16`}
                >
                  <div className="absolute left-[52px] top-1/2 transform -translate-y-1/2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 ${
                        isActive
                          ? 'bg-[#D4A574] border-[#D4A574]'
                          : isPast
                            ? 'bg-green-500/30 border-green-500'
                            : 'bg-white/10 border-white/30'
                      }`}
                      style={{
                        boxShadow: isActive ? '0 0 20px #D4A574' : 'none',
                      }}
                    />
                  </div>

                  <div
                    onClick={() => setSelectedStepId(step.id)}
                    className={`flex-1 p-4 rounded-lg cursor-pointer transition-all ${
                      selectedStepId === step.id
                        ? 'bg-[#D4A574]/10 border-[#D4A574]/50'
                        : 'bg-black/30 border-transparent hover:bg-white/5'
                    } border`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{stepIcons[step.type]}</span>
                        <span className={`font-serif ${
                          step.isCorrect ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {stepInfo?.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          step.dataSource === 'system'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {step.dataSource === 'system' ? '系统' : '人工'}
                        </span>
                      </div>
                      <span className="text-xs text-white/40">
                        {formatTime(step.timestamp)}
                      </span>
                    </div>

                    <div className="text-xs text-white/60">
                      {step.isCorrect ? (
                        <span className="text-green-400">✓ 操作正确</span>
                      ) : (
                        <span className="text-red-400">✗ {step.params.result?.errorDescription || '操作错误'}</span>
                      )}
                    </div>

                    {step.snapshot.qualityScore !== undefined && (
                      <div className="mt-2 flex gap-4 text-[10px] text-white/40">
                        <span>评分: {step.snapshot.qualityScore.toFixed(1)}</span>
                        <span>耐心: {step.snapshot.customerPatience?.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {filteredSteps.length === 0 && (
          <div className="text-center py-12 text-white/40 font-serif">
            暂无操作记录
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedStep && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#D4A574] font-serif">步骤详情</h3>
              <button
                onClick={() => setSelectedStepId(null)}
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/50">步骤类型</p>
                <p className="text-white/80">{STEPS.find(s => s.type === selectedStep.type)?.name}</p>
              </div>
              <div>
                <p className="text-white/50">操作时间</p>
                <p className="text-white/80">{formatTime(selectedStep.timestamp)}</p>
              </div>
              <div>
                <p className="text-white/50">数据来源</p>
                <p className={selectedStep.dataSource === 'system' ? 'text-blue-400' : 'text-orange-400'}>
                  {selectedStep.dataSource === 'system' ? '系统数据' : '人工备注'}
                </p>
              </div>
              <div>
                <p className="text-white/50">操作结果</p>
                <p className={selectedStep.isCorrect ? 'text-green-400' : 'text-red-400'}>
                  {selectedStep.isCorrect ? '正确' : '错误'}
                </p>
              </div>
              {selectedStep.params.result?.scoreDelta && (
                <div>
                  <p className="text-white/50">评分变化</p>
                  <p className={selectedStep.params.result.scoreDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                    {selectedStep.params.result.scoreDelta > 0 ? '+' : ''}{selectedStep.params.result.scoreDelta}
                  </p>
                </div>
              )}

              <div className="col-span-2 mt-4">
                <p className="text-white/50 mb-2">操作参数</p>
                <pre className="bg-black/30 rounded-lg p-3 text-[10px] text-white/60 overflow-x-auto">
                  {JSON.stringify(selectedStep.params, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
