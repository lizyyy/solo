import { X, AlertTriangle, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { compareRecords, formatDiffForDisplay } from '../../utils/diff';
import { StatusBadge } from '../common/StatusBadge';
import { SourceIcon } from '../common/SourceIcon';
import { RiskIndicator } from '../common/RiskIndicator';
import {
  LOCATION_LABELS,
  CRACK_TYPE_LABELS,
  STATUS_LABELS,
  RISK_LABELS,
  SOURCE_LABELS
} from '../../types';

const FieldValue = ({ field, value }: { field: string; value: string | boolean }) => {
  if (typeof value === 'boolean') {
    return (
      <span className={value ? 'text-amber-400' : 'text-success-400'}>
        {value ? '旧口径' : '新口径'}
      </span>
    );
  }

  const formatMap: Record<string, (v: string) => string> = {
    status: v => STATUS_LABELS[v as keyof typeof STATUS_LABELS] || v,
    source: v => SOURCE_LABELS[v as keyof typeof SOURCE_LABELS] || v,
    crackType: v => CRACK_TYPE_LABELS[v as keyof typeof CRACK_TYPE_LABELS] || v,
    riskLevel: v => RISK_LABELS[v as keyof typeof RISK_LABELS] || v,
    location: v => LOCATION_LABELS[v as keyof typeof LOCATION_LABELS] || v
  };

  return <span>{formatMap[field] ? formatMap[field](value) : value}</span>;
};

export const DiffPanel = () => {
  const { showDiffPanel, diffRecords, toggleDiffPanel } = useAppStore();

  if (!showDiffPanel || diffRecords.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="glass border-t border-white/10 mx-4 mb-4 rounded-t-xl shadow-2xl overflow-hidden">
        <div className="p-3 border-b border-white/10 flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-400">新旧口径差异对比</h3>
              <p className="text-xs text-gray-400">
                周会截图补录数据与当前标准的差异分析
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 px-2 py-1 bg-dark-700 rounded">
              {diffRecords.length} 条存在差异
            </span>
            <button
              onClick={() => toggleDiffPanel(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-4">
          {diffRecords.map(({ old: oldRec, new: newRec }, idx) => {
            const diffs = compareRecords(oldRec, newRec);
            const formattedDiffs = diffs.map(formatDiffForDisplay);

            return (
              <div key={idx} className="bg-dark-800/50 rounded-lg p-4 mb-3 last:mb-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <span className="text-xs text-gray-500 block mb-1">旧口径记录</span>
                      <StatusBadge status={oldRec.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {oldRec.createdAt} → {newRec.updatedAt}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-gray-500 block mb-1">新口径记录</span>
                      <StatusBadge status={newRec.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SourceIcon source={newRec.source} showLabel />
                    <RiskIndicator level={newRec.riskLevel} showLabel />
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-mono text-white mb-1">{newRec.code}</p>
                  <p className="text-sm text-gray-300">{newRec.description}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400 mb-2">差异字段：</p>
                  {formattedDiffs.map((diff, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg ${
                        diff.type === 'add' ? 'diff-add' :
                        diff.type === 'remove' ? 'diff-remove' :
                        'diff-modify'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-400 w-20">
                          {diff.fieldLabel}
                        </span>
                        {diff.type !== 'add' && (
                          <span className="text-sm text-red-400 line-through">
                            <FieldValue field={diff.field} value={diff.oldValue} />
                          </span>
                        )}
                        <ArrowRight className={`w-4 h-4 ${
                          diff.type === 'add' ? 'text-success-400' :
                          diff.type === 'remove' ? 'text-red-400' :
                          'text-warning-400'
                        }`} />
                        {diff.type !== 'remove' && (
                          <span className="text-sm text-success-400 font-medium">
                            <FieldValue field={diff.field} value={diff.newValue} />
                          </span>
                        )}
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                          diff.type === 'add' ? 'bg-success-500/20 text-success-400' :
                          diff.type === 'remove' ? 'bg-red-500/20 text-red-400' :
                          'bg-warning-500/20 text-warning-400'
                        }`}>
                          {diff.type === 'add' ? '新增' : diff.type === 'remove' ? '移除' : '修改'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-200 mb-1">处理建议说明</p>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {newRec.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
