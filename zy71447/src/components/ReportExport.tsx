import { useState } from 'react';
import { FileText, Download, Trash2, Calendar, User, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReportBatch } from '@/types';

interface ReportExportProps {
  batches: ReportBatch[];
  selectedBatchIds: string[];
  onToggleSelection: (id: string) => void;
  onClearSelection: () => void;
  onDelete: (id: string) => void;
  onExport: (batch: ReportBatch) => void;
  onExportSelected: () => void;
  isGenerating: boolean;
  onCreateBatch: () => void;
  reviewer: string;
  onReviewerChange: (name: string) => void;
}

export function ReportExport({
  batches,
  selectedBatchIds,
  onToggleSelection,
  onClearSelection,
  onDelete,
  onExport,
  onExportSelected,
  isGenerating,
  onCreateBatch,
  reviewer,
  onReviewerChange,
}: ReportExportProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const countRisksBySeverity = (batch: ReportBatch) => {
    const high = batch.risks.filter((r) => r.severity === 'high').length;
    const medium = batch.risks.filter((r) => r.severity === 'medium').length;
    const low = batch.risks.filter((r) => r.severity === 'low').length;
    return { high, medium, low, total: batch.risks.length };
  };

  return (
    <div className="card-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-bronze-500" />
          <h3 className="font-serif text-lg text-bronze-400">报告批次</h3>
        </div>
        <button
          onClick={onCreateBatch}
          className="btn-primary flex items-center gap-2"
        >
          <CheckCircle2 size={16} />
          创建批次
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1 font-mono">评审人员</label>
        <input
          type="text"
          value={reviewer}
          onChange={(e) => onReviewerChange(e.target.value)}
          placeholder="请输入评审人员姓名"
          className="input-field"
        />
      </div>

      {selectedBatchIds.length > 0 && (
        <div className="mb-4 p-3 bg-bronze-900/20 border border-bronze-700/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-bronze-300 font-mono">
              已选择 {selectedBatchIds.length} 个批次
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClearSelection}
                className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                清除选择
              </button>
              <button
                onClick={onExportSelected}
                disabled={isGenerating}
                className="btn-primary flex items-center gap-2 text-xs py-1"
              >
                <Download size={14} />
                批量导出
              </button>
            </div>
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 font-mono text-sm">暂无报告批次</p>
          <p className="text-gray-600 font-mono text-xs mt-1">
            点击「创建批次」生成当前状态的检测报告
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
          {batches.map((batch) => {
            const riskCount = countRisksBySeverity(batch);
            const isExpanded = expandedId === batch.id;
            const isSelected = selectedBatchIds.includes(batch.id);

            return (
              <motion.div
                key={batch.id}
                layout
                className={`
                  rounded-lg border transition-all duration-200
                  ${isSelected
                    ? 'bg-walnut-800/30 border-bronze-600/50'
                    : 'bg-charcoal-800/50 border-charcoal-700 hover:border-charcoal-600'
                  }
                `}
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : batch.id)}
                >
                  <div className="flex items-start gap-3">
                    <label
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection(batch.id)}
                        className="w-4 h-4 rounded border-charcoal-600 bg-charcoal-800
                                   text-bronze-500 focus:ring-bronze-500"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif text-bronze-300 truncate">
                          {batch.fileName}
                        </h4>
                        <ChevronRight
                          size={16}
                          className={`text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDateTime(batch.generatedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {batch.reviewer}
                        </span>
                        <span>v{batch.dataVersion}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-acoustic-high" />
                          <span className="text-xs text-gray-500 font-mono">{riskCount.high}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-bronze-500" />
                          <span className="text-xs text-gray-500 font-mono">{riskCount.medium}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-acoustic-mid" />
                          <span className="text-xs text-gray-500 font-mono">{riskCount.low}</span>
                        </div>
                        <span className="text-xs text-gray-600 font-mono ml-auto">
                          共 {riskCount.total} 项风险
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-0 border-t border-charcoal-700/50">
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-xs text-gray-600 font-mono">
                            批次号：{batch.date}_{batch.batchNo}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(batch.id);
                              }}
                              className="p-2 text-gray-500 hover:text-acoustic-high hover:bg-acoustic-high/10 rounded transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExport(batch);
                              }}
                              disabled={isGenerating}
                              className="btn-secondary flex items-center gap-2 text-xs py-1"
                            >
                              <Download size={14} />
                              导出PDF
                            </button>
                          </div>
                        </div>

                        {batch.risks.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-gray-500 font-mono">风险明细：</p>
                            {batch.risks.slice(0, 3).map((risk) => (
                              <div
                                key={risk.id}
                                className="p-2 bg-charcoal-900/50 rounded text-xs text-gray-400 font-mono"
                              >
                                <span
                                  className={`
                                    ${risk.severity === 'high' ? 'text-acoustic-high' : ''}
                                    ${risk.severity === 'medium' ? 'text-bronze-400' : ''}
                                    ${risk.severity === 'low' ? 'text-acoustic-mid' : ''}
                                  `}
                                >
                                  [
                                  {risk.severity === 'high' ? '高' : risk.severity === 'medium' ? '中' : '低'}
                                  ]
                                </span>{' '}
                                {risk.description}
                              </div>
                            ))}
                            {batch.risks.length > 3 && (
                              <p className="text-xs text-gray-600 font-mono text-center">
                                还有 {batch.risks.length - 3} 项风险...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
