import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { exportToPDF, exportToCSV, formatTime, getQualityScoreColor } from '../../utils/exportUtils';
import { STEPS, ERROR_TYPE_INFO } from '../../types';
import { FileText, Download, Filter, Check, X, Music, Disc } from 'lucide-react';

export const ReportPreview = () => {
  const { currentRecord, qualityScore, errorTracking, getFilteredSteps, filterOptions, exportReport } = useGameStore();
  const [isExporting, setIsExporting] = useState(false);

  const filteredSteps = getFilteredSteps();

  const handleExportPDF = async () => {
    if (!currentRecord) return;
    setIsExporting(true);
    try {
      const report = exportReport();
      exportToPDF(report);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!currentRecord) return;
    setIsExporting(true);
    try {
      const report = exportReport();
      exportToCSV(report);
    } finally {
      setIsExporting(false);
    }
  };

  const hasFilters = filterOptions.errorTypes.length > 0 || filterOptions.dataSources.length > 0 || filterOptions.stepTypes.length > 0;

  if (!currentRecord) {
    return (
      <div className="text-center py-16 text-white/40 font-serif">
        <Disc size={48} className="mx-auto mb-4 opacity-50" />
        <p>请先开始游戏以生成修复报告</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-[#D4A574] font-serif flex items-center gap-2">
          <FileText size={24} />
          修复报告
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4A574] text-[#2C1810] font-serif hover:bg-[#E5B685] transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            导出 PDF
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4A574]/30 text-[#D4A574] font-serif hover:bg-[#D4A574]/10 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            导出 CSV
          </button>
        </div>
      </div>

      {hasFilters && (
        <div className="bg-[#1a1a1a] rounded-xl border border-orange-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter size={16} className="text-orange-400" />
            <span className="text-sm text-orange-400 font-serif">报告已按当前筛选条件导出</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {filterOptions.errorTypes.length > 0 && (
              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
                错误类型: {filterOptions.errorTypes.map(t => ERROR_TYPE_INFO[t].name).join(', ')}
              </span>
            )}
            {filterOptions.dataSources.length > 0 && (
              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                数据来源: {filterOptions.dataSources.map(s => s === 'system' ? '系统' : '人工').join(', ')}
              </span>
            )}
            {filterOptions.stepTypes.length > 0 && (
              <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
                步骤类型: {filterOptions.stepTypes.map(t => STEPS.find(s => s.type === t)?.name).join(', ')}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
        <div className="flex items-start gap-6">
          <img
            src={currentRecord.coverImage}
            alt={currentRecord.title}
            className="w-32 h-32 rounded-lg object-cover"
          />
          <div className="flex-1">
            <h3 className="text-xl text-[#D4A574] font-serif mb-2">{currentRecord.title}</h3>
            <p className="text-white/60 text-sm mb-4">艺术家: {currentRecord.artist}</p>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-white/50 mb-1">品相</p>
                <p className="text-white/80 font-serif">{currentRecord.condition}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">难度</p>
                <p className="text-white/80 font-serif">{'★'.repeat(currentRecord.difficulty)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">最终评分</p>
                <p className="text-2xl font-serif" style={{ color: getQualityScoreColor(qualityScore) }}>
                  {qualityScore.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Object.entries(ERROR_TYPE_INFO).map(([key, info]) => {
          const countKey = key === 'scratch_misjudgment'
            ? 'scratchMisjudgment'
            : key === 'over_cleaning'
              ? 'overCleaning'
              : 'missingListeningRecord';
          const count = errorTracking[countKey as 'scratchMisjudgment' | 'overCleaning' | 'missingListeningRecord'];

          return (
            <motion.div
              key={key}
              className="p-4 rounded-xl bg-[#1a1a1a] border"
              style={{ borderColor: `${info.color}30` }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-serif" style={{ color: info.color }}>
                  {info.name}
                </span>
                <span className="text-2xl font-serif" style={{ color: info.color }}>
                  {count}
                </span>
              </div>
              <p className="text-[10px] text-white/50">{info.description}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[#D4A574] font-serif">修复步骤预览</h4>
          <span className="text-xs text-white/50">共 {filteredSteps.length} 条记录</span>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredSteps.map((step, index) => {
            const stepInfo = STEPS.find(s => s.type === step.type);
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 p-3 rounded-lg bg-black/30 border border-white/5"
              >
                <span className="text-xs text-white/40 w-8">{index + 1}</span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#D4A574]/10">
                  <Music size={16} className="text-[#D4A574]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-serif text-sm ${
                      step.isCorrect ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stepInfo?.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      step.dataSource === 'system'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {step.dataSource === 'system' ? '系统' : '人工'}
                    </span>
                    {step.isCorrect ? (
                      <Check size={14} className="text-green-400" />
                    ) : (
                      <X size={14} className="text-red-400" />
                    )}
                  </div>
                  <p className="text-xs text-white/40">{formatTime(step.timestamp)}</p>
                </div>
                {step.params.result?.scoreDelta && (
                  <span className={`text-sm font-serif ${
                    step.params.result.scoreDelta > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {step.params.result.scoreDelta > 0 ? '+' : ''}{step.params.result.scoreDelta}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {filteredSteps.length === 0 && (
          <div className="text-center py-8 text-white/40 font-serif">
            暂无修复记录
          </div>
        )}
      </div>
    </div>
  );
};
