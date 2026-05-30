import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Filter,
  Settings2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';
import { COLORS } from '../../utils/colorMapping';

export function LeftPanel() {
  const { leftPanelOpen, toggleLeftPanel } = useUIStore();
  const {
    visibleLevels,
    toggleLevel,
    showBids,
    showAsks,
    showAnomalies,
    setShowBids,
    setShowAsks,
    setShowAnomalies,
    updateProcessingConfig,
    processingConfig,
  } = useDataStore();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    levels: true,
    display: true,
    processing: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const allLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={false}
        animate={{ width: leftPanelOpen ? 260 : 48 }}
        className="h-full bg-[#0f1419]/90 backdrop-blur-md border-r border-[#1a1f2e] flex flex-col relative"
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleLeftPanel}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#1a1f2e] border border-[#2a3142] flex items-center justify-center text-gray-400 hover:text-white z-10"
        >
          {leftPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </motion.button>

        {leftPanelOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('levels')}
                className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg bg-[#1a1f2e] hover:bg-[#252d3d] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-gray-200">档位筛选</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedSections.levels ? 'rotate-90' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {expandedSections.levels && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 pb-3 px-3 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setShowBids(!showBids)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                            showBids
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-[#1a1f2e] text-gray-400 hover:text-gray-300'
                          }`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          买盘
                        </button>
                        <button
                          onClick={() => setShowAsks(!showAsks)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                            showAsks
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-[#1a1f2e] text-gray-400 hover:text-gray-300'
                          }`}
                        >
                          <TrendingDown className="w-3.5 h-3.5" />
                          卖盘
                        </button>
                      </div>

                      <button
                        onClick={() => setShowAnomalies(!showAnomalies)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                          showAnomalies
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-[#1a1f2e] text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        显示异常标记
                      </button>

                      <div className="pt-2 border-t border-[#2a3142]">
                        <p className="text-xs text-gray-500 mb-2">档位深度</p>
                        <div className="grid grid-cols-5 gap-1">
                          {allLevels.map(level => (
                            <button
                              key={level}
                              onClick={() => toggleLevel(level)}
                              className={`h-7 rounded text-xs font-mono transition-all ${
                                visibleLevels.includes(level)
                                  ? level <= 5
                                    ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                                    : 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                                  : 'bg-[#1a1f2e] text-gray-600 hover:text-gray-400'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => toggleSection('processing')}
                className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg bg-[#1a1f2e] hover:bg-[#252d3d] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-gray-200">数据处理</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedSections.processing ? 'rotate-90' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {expandedSections.processing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 pb-3 px-3 space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">最小价格变动 (tickSize)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={processingConfig.tickSize}
                          onChange={(e) => updateProcessingConfig({ tickSize: parseFloat(e.target.value) || 0.2 })}
                          className="w-full px-3 py-2 bg-[#1a1f2e] border border-[#2a3142] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">预期时间间隔 (ms)</label>
                        <input
                          type="number"
                          step="10"
                          value={processingConfig.expectedInterval}
                          onChange={(e) => updateProcessingConfig({ expectedInterval: parseInt(e.target.value) || 100 })}
                          className="w-full px-3 py-2 bg-[#1a1f2e] border border-[#2a3142] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">空值处理策略</label>
                        <select
                          value={processingConfig.handleNullValues}
                          onChange={(e) => updateProcessingConfig({ 
                            handleNullValues: e.target.value as 'interpolate' | 'drop' | 'zero' 
                          })}
                          className="w-full px-3 py-2 bg-[#1a1f2e] border border-[#2a3142] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value="interpolate">线性插值</option>
                          <option value="drop">删除记录</option>
                          <option value="zero">置为0</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">重复项处理</label>
                        <select
                          value={processingConfig.handleDuplicates}
                          onChange={(e) => updateProcessingConfig({ 
                            handleDuplicates: e.target.value as 'keep_latest' | 'keep_first' | 'merge' 
                          })}
                          className="w-full px-3 py-2 bg-[#1a1f2e] border border-[#2a3142] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value="keep_latest">保留最新</option>
                          <option value="keep_first">保留最早</option>
                          <option value="merge">合并数据</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          异常值σ阈值: {processingConfig.outlierSigma}σ
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="0.5"
                          value={processingConfig.outlierSigma}
                          onChange={(e) => updateProcessingConfig({ outlierSigma: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-[#1a1f2e] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                      </div>

                      <button
                        onClick={() => useDataStore.getState().processData()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all"
                      >
                        <Zap className="w-4 h-4" />
                        重新处理数据
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-4 border-t border-[#1a1f2e]">
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: COLORS.bid.base }} />
                  <span>买盘 (Bid)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: COLORS.ask.base }} />
                  <span>卖盘 (Ask)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded animate-pulse" style={{ background: COLORS.anomaly.base }} />
                  <span>异常标记</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: COLORS.selection.base }} />
                  <span>选中对象</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center py-4 gap-4">
            <button
              onClick={() => setShowBids(!showBids)}
              className={`p-2 rounded-lg transition-all ${
                showBids ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="买盘"
            >
              <TrendingUp className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAsks(!showAsks)}
              className={`p-2 rounded-lg transition-all ${
                showAsks ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="卖盘"
            >
              <TrendingDown className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAnomalies(!showAnomalies)}
              className={`p-2 rounded-lg transition-all ${
                showAnomalies ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="异常"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>
            <div className="w-8 h-px bg-[#1a1f2e]" />
            <button
              onClick={() => toggleSection('levels')}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 transition-all"
              title="档位"
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              onClick={() => toggleSection('processing')}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 transition-all"
              title="设置"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
