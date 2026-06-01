import { format } from 'date-fns';
import { GitCompareArrows, CheckCircle, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { useHistoryCompare } from '../hooks/useHistoryCompare';
import { useAppStore } from '../store/useAppStore';
import { BATCH_STATUS_LABELS, ASSESSMENT_LABELS, UNIT_LABELS } from '../types';
import {
  formatDiffValue,
  getDiffTypeLabel,
  getSignificanceLabel,
  getFieldLabel,
} from '../utils/diffComparator';

export const HistoryCompare = () => {
  const { batches } = useAppStore();
  const {
    selectedBatches,
    selectedBatchIds,
    toggleBatchSelection,
    clearSelection,
    compareSelectedBatches,
    getBatchComparisonSummary,
  } = useHistoryCompare();

  const diffs = compareSelectedBatches();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">历史对比中心</h2>
          <p className="text-slate-500 text-sm mt-1">选择两个批次并排对比，差异高亮标注</p>
        </div>
        <button
          onClick={clearSelection}
          className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-all"
        >
          清除选择
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {batches.map((batch) => {
          const isSelected = selectedBatchIds.includes(batch.id);
          return (
            <button
              key={batch.id}
              onClick={() => toggleBatchSelection(batch.id)}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    isSelected ? 'bg-blue-500' : 'bg-slate-300'
                  }`} />
                  <span className="font-semibold text-sm text-slate-800">{batch.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  batch.status === 'completed' ? 'bg-green-100 text-green-700' :
                  batch.status === 'rework' ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {BATCH_STATUS_LABELS[batch.status]}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-slate-400">型号</p>
                  <p className="font-medium text-slate-700">{batch.experimentRecord.droneModel}</p>
                </div>
                <div>
                  <p className="text-slate-400">创建时间</p>
                  <p className="font-medium text-slate-700">{format(new Date(batch.createdAt), 'MM-dd HH:mm')}</p>
                </div>
                {batch.result ? (
                  <div>
                    <p className="text-slate-400">噪声级</p>
                    <p className={`font-mono font-bold ${
                      batch.result.assessment === 'critical' ? 'text-red-600' :
                      batch.result.assessment === 'warning' ? 'text-amber-600' :
                      'text-green-600'
                    }`}>
                      {batch.result.overallNoiseLevel.toFixed(1)} {UNIT_LABELS[batch.result.unit]}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-400">噪声级</p>
                    <p className="text-slate-400">未计算</p>
                  </div>
                )}
              </div>

              {batch.result && (
                <div className="mt-3 pt-3 border-t border-slate-200/50">
                  <div className="flex items-center gap-4 text-xs">
                    <span>评估: <span className={`font-medium ${
                      batch.result.assessment === 'critical' ? 'text-red-600' :
                      batch.result.assessment === 'warning' ? 'text-amber-600' :
                      'text-green-600'
                    }`}>{ASSESSMENT_LABELS[batch.result.assessment]}</span></span>
                    <span>频率: <span className="font-mono">{batch.result.dominantFrequency.toFixed(1)}Hz</span></span>
                    <span>冲突: <span className="font-medium">{batch.conflicts.length}</span></span>
                    <span>备注: <span className="font-medium">{batch.notes.length}</span></span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedBatches.length === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-violet-700 to-violet-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <GitCompareArrows className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">批次对比结果</h3>
                <p className="text-violet-200 text-sm">{getBatchComparisonSummary()}</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {selectedBatches[0].result && selectedBatches[1].result && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[selectedBatches[0], selectedBatches[1]].map((batch, idx) => (
                  <div key={batch.id} className={`p-4 rounded-lg border ${
                    idx === 0 ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'
                  }`}>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">
                      {idx === 0 ? '历史批次' : '新批次'}: {batch.name}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">总噪声级</span>
                        <span className="font-mono font-bold">{batch.result.overallNoiseLevel.toFixed(1)} {UNIT_LABELS[batch.result.unit]}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">评估等级</span>
                        <span className={`font-medium ${
                          batch.result.assessment === 'critical' ? 'text-red-600' :
                          batch.result.assessment === 'warning' ? 'text-amber-600' :
                          'text-green-600'
                        }`}>{ASSESSMENT_LABELS[batch.result.assessment]}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">主导频率</span>
                        <span className="font-mono">{batch.result.dominantFrequency.toFixed(1)} Hz</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">指向性指数</span>
                        <span className="font-mono">{batch.result.directionalityIndex.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">置信度</span>
                        <span className="font-mono">{(batch.result.confidenceLevel * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {diffs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  差异明细
                </h4>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">字段</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">类型</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">旧值</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">新值</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">影响</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffs.map((diff, idx) => (
                        <tr key={idx} className={`border-t border-slate-100 ${
                          diff.significance === 'high' ? 'bg-red-50' :
                          diff.significance === 'medium' ? 'bg-amber-50' :
                          ''
                        }`}>
                          <td className="px-4 py-2 font-medium">{getFieldLabel(diff.field)}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              diff.diffType === 'added' ? 'bg-green-100 text-green-700' :
                              diff.diffType === 'removed' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {getDiffTypeLabel(diff.diffType)}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-sm">{formatDiffValue(diff.oldValue)}</td>
                          <td className="px-4 py-2 font-mono text-sm font-semibold">{formatDiffValue(diff.newValue)}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              diff.significance === 'high' ? 'bg-red-100 text-red-700' :
                              diff.significance === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {getSignificanceLabel(diff.significance)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {diffs.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                <p className="font-medium">两个批次完全一致</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedBatchIds.length < 2 && (
        <div className="text-center py-12 text-slate-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2" />
          <p className="font-medium">请选择两个批次进行对比</p>
          <p className="text-sm mt-1">点击上方批次卡片选择，最多选择2个</p>
        </div>
      )}
    </div>
  );
};
