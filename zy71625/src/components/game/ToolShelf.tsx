import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLEANER_INFO, CleanerType, ScratchSeverity, NOISE_TYPE_INFO, NoiseType } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { Droplets, Music, Play, SkipForward, Check } from 'lucide-react';

interface ToolShelfProps {
  currentStep: number;
}

export const ToolShelf = ({ currentStep }: ToolShelfProps) => {
  const {
    currentRecord,
    selectedCleanerType,
    cleaningAmount,
    listeningRecorded,
    inventory,
    selectCleaner,
    setCleaningAmount,
    applyCleaning,
    recordListening,
    skipListeningRecord,
    selectedScratchId,
  } = useGameStore();

  const [selectedNoiseTypes, setSelectedNoiseTypes] = useState<NoiseType[]>([]);
  const [qualityScore, setQualityScore] = useState(70);
  const [isDragging, setIsDragging] = useState(false);

  const selectedScratch = currentRecord?.scratches.find(s => s.id === selectedScratchId);

  const handleCleanerSelect = (type: CleanerType) => {
    selectCleaner(type);
  };

  const toggleNoiseType = (type: NoiseType) => {
    setSelectedNoiseTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleRecordListening = () => {
    recordListening(selectedNoiseTypes, qualityScore);
    setSelectedNoiseTypes([]);
    setQualityScore(70);
  };

  const getRecommendedAmount = (severity: ScratchSeverity): number => {
    switch (severity) {
      case 'light': return 3;
      case 'medium': return 5;
      case 'deep': return 8;
    }
  };

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6 space-y-6">
      <h3 className="text-[#D4A574] font-serif text-lg">修复工具架</h3>

      {currentStep === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-white/80 font-serif">选择清洗剂</p>
            {selectedScratch && (
              <span className="text-xs text-white/50">
                目标划痕: {selectedScratch.severity === 'light' ? '轻微' : selectedScratch.severity === 'medium' ? '中等' : '深度'}
              </span>
            )}
          </div>

          {!selectedScratchId && (
            <div className="text-center py-4 text-orange-400 text-sm">
              请先在黑胶盘上选择一个划痕
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {CLEANER_INFO.map(cleaner => {
              const inventoryKey = cleaner.type.replace('type', 'cleaner') as keyof typeof inventory;
              const count = inventory[inventoryKey];
              const isSelected = selectedCleanerType === cleaner.type;
              const isSuitable = selectedScratch && cleaner.suitableFor.includes(selectedScratch.severity);

              return (
                <motion.div
                  key={cleaner.type}
                  onClick={() => selectedScratchId && handleCleanerSelect(cleaner.type)}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#D4A574] bg-[#D4A574]/10'
                      : 'border-white/10 hover:border-white/30'
                  } ${!selectedScratchId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  whileHover={{ scale: selectedScratchId ? 1.02 : 1 }}
                  whileTap={{ scale: selectedScratchId ? 0.98 : 1 }}
                  style={{
                    borderColor: isSelected ? cleaner.color : undefined,
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-12 h-16 rounded-t-full rounded-b-lg relative overflow-hidden"
                      style={{ backgroundColor: `${cleaner.color}40` }}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                        style={{
                          height: `${Math.min(100, (count / 20) * 100)}%`,
                          backgroundColor: cleaner.color,
                        }}
                      />
                      <div className="absolute inset-x-0 top-2 h-2 bg-[#2C1810] rounded-full mx-1" />
                    </div>

                    <p className="text-xs font-serif text-center" style={{ color: cleaner.color }}>
                      {cleaner.name}
                    </p>
                    <p className="text-[10px] text-white/50 text-center">
                      {cleaner.description}
                    </p>

                    <div className="flex items-center gap-1">
                      <Droplets size={12} style={{ color: cleaner.color }} />
                      <span className="text-xs text-white/70">{count}</span>
                    </div>

                    {isSuitable && selectedScratch && (
                      <span className="absolute top-1 right-1 text-green-400">
                        <Check size={14} />
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {selectedCleanerType && selectedScratch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 overflow-hidden"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/80">清洗剂量 (ml)</p>
                  <span className="text-sm text-[#D4A574]">
                    推荐: {getRecommendedAmount(selectedScratch.severity)}ml
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={cleaningAmount}
                    onChange={e => setCleaningAmount(Number(e.target.value))}
                    className="flex-1 h-2 bg-black/50 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #D4A574 0%, #D4A574 ${(cleaningAmount / 20) * 100}%, #333 ${(cleaningAmount / 20) * 100}%, #333 100%)`,
                    }}
                  />
                  <span className="text-lg font-serif text-[#D4A574] w-12 text-center">
                    {cleaningAmount}
                  </span>
                </div>

                {cleaningAmount > getRecommendedAmount(selectedScratch.severity) * 1.5 && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    ⚠ 清洗剂量过大，可能造成损伤
                  </p>
                )}
              </div>

              <div
                className="relative h-8 bg-black/30 rounded-full overflow-hidden"
                onMouseEnter={() => setIsDragging(true)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(cleaningAmount / 20) * 100}%`,
                    backgroundColor: CLEANER_INFO.find(c => c.type === selectedCleanerType)?.color,
                  }}
                  animate={{
                    opacity: isDragging ? [0.7, 1, 0.7] : 1,
                  }}
                  transition={{ duration: 1, repeat: isDragging ? Infinity : 0 }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-white/70 font-serif">
                    拖拽调整剂量
                  </span>
                </div>
              </div>

              <button
                onClick={applyCleaning}
                className="w-full py-3 rounded-lg bg-[#D4A574] text-[#2C1810] font-serif hover:bg-[#E5B685] transition-colors flex items-center justify-center gap-2"
              >
                <Droplets size={18} />
                应用清洗
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {currentStep === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-white/80 font-serif">唱针试听</p>
            {listeningRecorded && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Check size={12} /> 已记录
              </span>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 p-4 bg-black/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Music size={16} className="text-[#D4A574]" />
                <span className="text-sm text-white/80">标准唱针</span>
                <span className="text-xs text-white/50">库存: {inventory.stylusNormal}</span>
              </div>
              <p className="text-[10px] text-white/50">适用于日常播放</p>
            </div>
            <div className="flex-1 p-4 bg-black/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Music size={16} className="text-blue-400" />
                <span className="text-sm text-white/80">精密唱针</span>
                <span className="text-xs text-white/50">库存: {inventory.stylusPrecision}</span>
              </div>
              <p className="text-[10px] text-white/50">适用于深度检测</p>
            </div>
          </div>

          {!listeningRecorded && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-white/80">检测到的噪声类型:</p>
                <div className="flex flex-wrap gap-2">
                  {NOISE_TYPE_INFO.map(info => {
                    const isSelected = selectedNoiseTypes.includes(info.type);
                    return (
                      <button
                        key={info.type}
                        onClick={() => toggleNoiseType(info.type)}
                        className={`px-3 py-1 rounded-full text-xs border transition-all ${
                          isSelected
                            ? 'border-[#D4A574] bg-[#D4A574]/10'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                        style={{
                          borderColor: isSelected ? info.color : undefined,
                          color: isSelected ? info.color : undefined,
                        }}
                      >
                        {info.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/80">音质评分</p>
                  <span className="text-lg font-serif text-[#D4A574]">{qualityScore}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={qualityScore}
                  onChange={e => setQualityScore(Number(e.target.value))}
                  className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #D4A574 0%, #D4A574 ${qualityScore}%, #333 ${qualityScore}%, #333 100%)`,
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRecordListening}
                  className="flex-1 py-2 rounded-lg bg-[#D4A574] text-[#2C1810] font-serif hover:bg-[#E5B685] transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  记录试听结果
                </button>
                <button
                  onClick={skipListeningRecord}
                  className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <SkipForward size={16} />
                  跳过
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {currentStep !== 2 && currentStep !== 3 && (
        <div className="text-center py-8 text-white/40 font-serif">
          请在正确的步骤使用工具
        </div>
      )}
    </div>
  );
};
