import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Noise, NoiseType, NOISE_TYPE_INFO } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { Volume2, Edit3, Check, X, Info } from 'lucide-react';

interface NoiseAnalyzerProps {
  isInteractive?: boolean;
}

export const NoiseAnalyzer = ({ isInteractive = true }: NoiseAnalyzerProps) => {
  const { currentRecord, analyzeNoise } = useGameStore();
  const [selectedNoiseId, setSelectedNoiseId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<NoiseType | null>(null);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const handleNoiseClick = (noise: Noise) => {
    if (!isInteractive || noise.analyzed) return;
    setSelectedNoiseId(noise.id);
    setSelectedType(null);
    setNote('');
    setShowNoteInput(false);
  };

  const handleAnalyze = () => {
    if (!selectedNoiseId || !selectedType) return;
    analyzeNoise(selectedNoiseId, selectedType, note || undefined);
    setSelectedNoiseId(null);
    setSelectedType(null);
    setNote('');
    setShowNoteInput(false);
  };

  if (!currentRecord) {
    return (
      <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
        <p className="text-[#D4A574] font-serif text-center">请先选择黑胶唱片</p>
      </div>
    );
  }

  const selectedNoise = currentRecord.noises.find(n => n.id === selectedNoiseId);

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[#D4A574] font-serif text-lg flex items-center gap-2">
          <Volume2 size={20} />
          噪声分析器
        </h3>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">系统数据</span>
          <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">人工备注</span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-white/60 text-sm font-serif">噪声频谱条 - 点击选择噪声进行分析</p>

        <div className="flex items-end justify-between h-[120px] gap-2 bg-black/30 rounded-lg p-4">
          {currentRecord.noises.map((noise, index) => {
            const noiseInfo = NOISE_TYPE_INFO.find(n => n.type === noise.type)!;
            const isSelected = selectedNoiseId === noise.id;
            const barHeight = Math.max(20, noise.amplitude);

            return (
              <div key={noise.id} className="flex flex-col items-center gap-1 flex-1">
                <motion.div
                  className={`w-full rounded-t cursor-pointer relative ${
                    noise.analyzed ? 'opacity-50' : ''
                  }`}
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: isSelected ? noiseInfo.color : `${noiseInfo.color}60`,
                    boxShadow: isSelected ? `0 0 20px ${noiseInfo.color}` : 'none',
                  }}
                  whileHover={{ scale: noise.analyzed ? 1 : 1.05 }}
                  onClick={() => handleNoiseClick(noise)}
                  animate={{
                    y: [0, -2, 0],
                  }}
                  transition={{
                    duration: 2,
                    delay: index * 0.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap"
                        style={{ color: noiseInfo.color }}
                      >
                        {noiseInfo.name}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute -top-1 right-0">
                    {noise.dataSource === 'system' ? (
                      <span className="text-[8px] px-1 rounded bg-blue-500/40 text-blue-300">S</span>
                    ) : (
                      <span className="text-[8px] px-1 rounded bg-orange-500/40 text-orange-300">M</span>
                    )}
                  </div>
                </motion.div>

                <span className="text-[10px] text-white/50 font-mono">
                  {noise.frequency}Hz
                </span>
                <span className="text-[10px] text-white/30 font-mono">
                  {noise.amplitude}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          {currentRecord.noises.map(noise => {
            const noiseInfo = NOISE_TYPE_INFO.find(n => n.type === noise.type)!;
            return (
              <div
                key={noise.id}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                  noise.analyzed
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                {noise.analyzed && <Check size={12} />}
                <span style={{ color: noise.analyzed ? undefined : noiseInfo.color }}>
                  {noiseInfo.name}
                </span>
                {noise.note && <Info size={10} className="text-orange-400" />}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedNoise && !selectedNoise.analyzed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-black/30 rounded-lg p-4 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-[#D4A574] font-serif">分析噪声</h4>
              <button
                onClick={() => setSelectedNoiseId(null)}
                className="text-white/50 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-white/60 space-y-1">
              <p>频率: {selectedNoise.frequency} Hz</p>
              <p>振幅: {selectedNoise.amplitude}%</p>
              <p>数据来源: {selectedNoise.dataSource === 'system' ? '系统检测' : '人工录入'}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-white/80 font-serif">选择噪声类型:</p>
              <div className="grid grid-cols-2 gap-2">
                {NOISE_TYPE_INFO.map(info => (
                  <button
                    key={info.type}
                    onClick={() => setSelectedType(info.type)}
                    className={`p-2 rounded border text-xs text-left transition-all ${
                      selectedType === info.type
                        ? 'border-[#D4A574] bg-[#D4A574]/10'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    style={{
                      borderColor: selectedType === info.type ? info.color : undefined,
                      backgroundColor: selectedType === info.type ? `${info.color}15` : undefined,
                    }}
                  >
                    <span style={{ color: info.color }}>{info.name}</span>
                    <p className="text-[10px] text-white/50 mt-1">{info.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300"
              >
                <Edit3 size={14} />
                {showNoteInput ? '取消备注' : '添加人工备注'}
              </button>

              <AnimatePresence>
                {showNoteInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="输入人工备注..."
                      className="w-full p-2 rounded bg-black/50 border border-orange-500/30 text-white text-sm resize-none h-20 focus:outline-none focus:border-orange-500"
                    />
                    <p className="text-[10px] text-orange-400/70 mt-1">
                      * 添加备注将标记为人工数据源
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!selectedType}
              className="w-full py-2 rounded bg-[#D4A574] text-[#2C1810] font-serif disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E5B685] transition-colors"
            >
              确认分析
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-4 border-t border-[#D4A574]/20">
        <p className="text-xs text-white/40 font-serif">
          已分析: {currentRecord.noises.filter(n => n.analyzed).length} / {currentRecord.noises.length}
        </p>
      </div>
    </div>
  );
};
