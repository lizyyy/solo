import { useState, useEffect } from 'react';
import { X, Clock, Calculator, GitBranch } from 'lucide-react';
import { traceApi } from '../lib/api';
import type { FieldTrace } from '../../shared/types';

interface TraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  setlistId: string;
  field: string;
  fieldLabel: string;
  songId?: string;
}

export default function TraceModal({
  isOpen,
  onClose,
  setlistId,
  field,
  fieldLabel,
  songId,
}: TraceModalProps) {
  const [trace, setTrace] = useState<FieldTrace | null>(null);
  const [breakdown, setBreakdown] = useState<{
    rule: string;
    components: Array<{ label: string; value: number; explanation: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  };

  const formatDurationValue = (value: unknown): string => {
    if (typeof value === 'number' && field.includes('Duration')) {
      return `${Math.floor(value / 60)}分${(value % 60)}秒`;
    }
    return renderValue(value);
  };

  useEffect(() => {
    if (isOpen) {
      fetchTrace();
    }
  }, [isOpen, setlistId, field, songId]);

  const fetchTrace = async () => {
    setLoading(true);
    try {
      if (songId) {
        const data = await traceApi.traceSongField(setlistId, songId, field);
        setTrace(data);
      } else {
        const [traceData, breakdownData] = await Promise.all([
          traceApi.traceField(setlistId, field),
          traceApi.getBreakdown(setlistId, field).catch(() => null),
        ]);
        setTrace(traceData);
        setBreakdown(breakdownData);
      }
    } catch (error) {
      console.error('获取追溯信息失败', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-500" />
            数据追溯：{fieldLabel}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : trace ? (
            <div className="space-y-6">
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">当前值</div>
                <div className="text-2xl font-bold text-indigo-700">
                  {formatDurationValue(trace.currentValue)}
                </div>
              </div>

              {trace.calculationRule && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-gray-400" />
                    计算规则
                  </h4>
                  <p className="text-sm text-gray-600">{trace.calculationRule}</p>
                </div>
              )}

              {breakdown && breakdown.components.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-gray-400" />
                    计算分解
                  </h4>
                  <div className="space-y-2">
                    {breakdown.components.map((comp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">{comp.label}</div>
                          <div className="text-xs text-gray-500">{comp.explanation}</div>
                        </div>
                        <div className="text-sm font-semibold text-gray-700">
                          {field.includes('Duration')
                            ? `${Math.floor(comp.value / 60)}分${comp.value % 60}秒`
                            : comp.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trace.changeHistory && trace.changeHistory.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    变更历史
                  </h4>
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {trace.changeHistory.map((change, idx) => (
                        <div key={idx} className="relative pl-8">
                          <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-indigo-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                v{change.version} · {change.updatedBy}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(change.timestamp).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            {change.oldValue !== undefined && change.oldValue !== null && (
                              <div className="text-xs text-gray-500">
                                <span className="line-through text-red-500">
                                  {formatDurationValue(change.oldValue)}
                                </span>
                                {' → '}
                                <span className="text-green-600 font-medium">
                                  {formatDurationValue(change.newValue)}
                                </span>
                              </div>
                            )}
                            {change.reason && (
                              <div className="text-xs text-gray-600 mt-1">{change.reason}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">暂无追溯信息</div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
