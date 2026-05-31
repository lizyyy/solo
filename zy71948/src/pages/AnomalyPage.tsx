import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Zap, FileText, ChevronRight, X } from 'lucide-react';
import { usePowerBudgetStore } from '../store/usePowerBudgetStore';
import { StatusIndicator } from '../components/StatusIndicator';
import { parseAnomalyReason, getAnomalyTypeLabel, getAnomalySeverityLabel } from '../utils/anomalyDetector';
import { Anomaly, AnomalyReason } from '../types';

const filterOptions = [
  { value: 'all', label: '全部异常' },
  { value: 'PENDING', label: '待复核' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'TIME_CONFLICT', label: '时间制冲突' },
  { value: 'DATA_INCONSISTENCY', label: '数据不一致' },
  { value: 'BUDGET_OVERRUN', label: '预算越界' },
];

export const AnomalyPage: React.FC = () => {
  const { anomalies, confirmAnomaly, viewMode, runAnomalyDetection, currentDate } = usePowerBudgetStore();
  const [filter, setFilter] = useState('all');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reviewer, setReviewer] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');

  const filteredAnomalies = anomalies.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'PENDING' || filter === 'CONFIRMED') return a.status === filter;
    return a.type === filter;
  });

  const pendingCount = anomalies.filter(a => a.status === 'PENDING').length;
  const confirmedCount = anomalies.filter(a => a.status === 'CONFIRMED').length;
  const timeConflictCount = anomalies.filter(a => a.type === 'TIME_CONFLICT').length;
  const dataInconsistencyCount = anomalies.filter(a => a.type === 'DATA_INCONSISTENCY').length;
  const budgetOverrunCount = anomalies.filter(a => a.type === 'BUDGET_OVERRUN').length;

  const handleConfirm = () => {
    if (!reviewer.trim()) {
      alert('请填写复核人');
      return;
    }
    if (!selectedAnomaly) return;
    
    confirmAnomaly(selectedAnomaly.id, reviewer, reviewRemark);
    setShowConfirmModal(false);
    setSelectedAnomaly(null);
    setReviewer('');
    setReviewRemark('');
  };

  const renderReason = (reason: AnomalyReason | null) => {
    if (!reason) return <div className="text-console-muted">无法解析异常原因</div>;

    return (
      <div className="space-y-4">
        <div className="p-4 bg-console-bg rounded-lg border border-eng-blue/30">
          <div className="text-xs text-console-muted mb-1">计算公式</div>
          <div className="font-mono text-eng-blue-light">{reason.formula}</div>
        </div>

        <div>
          <div className="text-xs text-console-muted mb-2">原始数据</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-console-border">
                  <th className="text-left py-2 px-3 font-medium text-console-muted">数据源</th>
                  <th className="text-left py-2 px-3 font-medium text-console-muted">数值</th>
                  <th className="text-left py-2 px-3 font-medium text-console-muted">时间</th>
                  <th className="text-left py-2 px-3 font-medium text-console-muted">时间制</th>
                </tr>
              </thead>
              <tbody>
                {reason.rawData.map((item, idx) => (
                  <tr key={idx} className="border-b border-console-border/50">
                    <td className="py-2 px-3 font-medium">{item.source}</td>
                    <td className="py-2 px-3 font-mono">{String(item.value)}</td>
                    <td className="py-2 px-3 font-mono text-console-muted">{item.time}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        item.timeSystem === 'UTC' ? 'bg-eng-blue/20 text-eng-blue-light' :
                        item.timeSystem === 'TAI' ? 'bg-eng-green/20 text-eng-green-light' :
                        'bg-eng-orange/20 text-eng-orange-light'
                      }`}>
                        {item.timeSystem}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-console-bg rounded-lg border border-eng-orange/30">
          <div className="text-xs text-console-muted mb-1">判定依据</div>
          <div className="text-eng-orange-light">{reason.criteria}</div>
        </div>

        <div>
          <div className="text-xs text-console-muted mb-2">计算步骤</div>
          <div className="space-y-1">
            {reason.calculationSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-console-muted font-mono w-6">{idx + 1}.</span>
                <span className="font-mono">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-eng-yellow/10 rounded-lg border border-eng-yellow/30">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-eng-yellow flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-eng-yellow mb-1">复核结论</div>
              <div className="text-console-text">{reason.conclusion}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TIME_CONFLICT': return <Clock className="w-4 h-4" />;
      case 'DATA_INCONSISTENCY': return <FileText className="w-4 h-4" />;
      case 'BUDGET_OVERRUN': return <Zap className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">异常分析</h1>
          <p className="text-sm text-console-muted">自动检测异常并提供可复核的原因说明</p>
        </div>
        <button
          onClick={() => runAnomalyDetection()}
          disabled={viewMode === 'snapshot'}
          className="px-4 py-2 border border-console-border rounded text-sm hover:bg-console-panel transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-4 h-4" />
          重新检测
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-console-panel border border-console-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-eng-orange" />
            <span className="text-2xl font-bold">{anomalies.length}</span>
          </div>
          <div className="text-sm text-console-muted">全部异常</div>
        </div>
        <div className="bg-console-panel border border-console-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-eng-yellow animate-pulse-slow" />
            <span className="text-2xl font-bold text-eng-yellow">{pendingCount}</span>
          </div>
          <div className="text-sm text-console-muted">待复核</div>
        </div>
        <div className="bg-console-panel border border-console-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-eng-green" />
            <span className="text-2xl font-bold text-eng-green-light">{confirmedCount}</span>
          </div>
          <div className="text-sm text-console-muted">已确认</div>
        </div>
        <div className="bg-console-panel border border-console-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-eng-blue" />
            <span className="text-2xl font-bold text-eng-blue-light">{timeConflictCount}</span>
          </div>
          <div className="text-sm text-console-muted">时间制冲突</div>
        </div>
        <div className="bg-console-panel border border-console-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-eng-orange" />
            <span className="text-2xl font-bold text-eng-orange">{budgetOverrunCount}</span>
          </div>
          <div className="text-sm text-console-muted">预算越界</div>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="bg-console-panel border border-console-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-console-border">
              <h2 className="font-bold">异常列表</h2>
              <div className="flex gap-2">
                {filterOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      filter === option.value
                        ? 'bg-eng-blue text-white'
                        : 'bg-console-bg text-console-muted hover:text-console-text'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-console-border/50">
              {filteredAnomalies.length === 0 ? (
                <div className="py-12 text-center text-console-muted">
                  暂无符合条件的异常记录
                </div>
              ) : (
                filteredAnomalies.map(anomaly => (
                  <div
                    key={anomaly.id}
                    onClick={() => setSelectedAnomaly(anomaly)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-console-bg/50 ${
                      selectedAnomaly?.id === anomaly.id ? 'bg-eng-blue/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <StatusIndicator status={anomaly.status} size="md" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                              anomaly.severity === 'ERROR'
                                ? 'bg-eng-orange/20 text-eng-orange-light'
                                : 'bg-eng-yellow/20 text-eng-yellow'
                            }`}>
                              {getTypeIcon(anomaly.type)}
                              {getAnomalyTypeLabel(anomaly.type)}
                            </span>
                            <span className="text-xs text-console-muted">
                              {getAnomalySeverityLabel(anomaly.severity)}
                            </span>
                          </div>
                          <div className="font-medium text-sm">{anomaly.description}</div>
                          <div className="text-xs text-console-muted mt-1">
                            {new Date(anomaly.createdAt).toLocaleString()}
                            {anomaly.reviewer && ` · 复核人: ${anomaly.reviewer}`}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-console-muted" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="w-[480px]">
          <div className="bg-console-panel border border-console-border rounded-lg h-full">
            <div className="flex items-center justify-between p-4 border-b border-console-border">
              <h2 className="font-bold">异常原因详情</h2>
              {selectedAnomaly && (
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="p-1 hover:bg-console-bg rounded transition-colors"
                >
                  <X className="w-4 h-4 text-console-muted" />
                </button>
              )}
            </div>

            <div className="p-4 overflow-auto max-h-[calc(100vh-300px)]">
              {!selectedAnomaly ? (
                <div className="py-12 text-center text-console-muted">
                  选择左侧异常记录查看详情
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <StatusIndicator status={selectedAnomaly.status} size="lg" />
                    <div>
                      <div className="font-bold">{selectedAnomaly.description}</div>
                      <div className="text-xs text-console-muted">
                        {new Date(selectedAnomaly.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {selectedAnomaly.status === 'PENDING' && viewMode !== 'snapshot' && (
                    <button
                      onClick={() => setShowConfirmModal(true)}
                      className="w-full px-4 py-2 bg-eng-green text-white rounded hover:bg-eng-green-light transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      确认已复核
                    </button>
                  )}

                  {selectedAnomaly.status === 'CONFIRMED' && (
                    <div className="p-4 bg-eng-green/10 rounded-lg border border-eng-green/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-eng-green" />
                        <span className="font-medium text-eng-green-light">已复核</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div>复核人: {selectedAnomaly.reviewer}</div>
                        <div>复核时间: {selectedAnomaly.reviewedAt && new Date(selectedAnomaly.reviewedAt).toLocaleString()}</div>
                        {selectedAnomaly.reviewRemark && (
                          <div className="text-console-muted">备注: {selectedAnomaly.reviewRemark}</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-console-border pt-4">
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-eng-blue" />
                      可复核原因
                    </h3>
                    {renderReason(parseAnomalyReason(selectedAnomaly.reason))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConfirmModal && selectedAnomaly && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-console-panel border border-console-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">确认复核</h3>
            <p className="text-sm text-console-muted mb-4">
              确认已复核该异常并记录处理结果：
            </p>
            <div className="mb-4 p-3 bg-console-bg rounded text-sm">
              {selectedAnomaly.description}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-console-muted mb-1">复核人 *</label>
                <input
                  type="text"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                  placeholder="请输入复核人姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-console-muted mb-1">复核备注</label>
                <textarea
                  value={reviewRemark}
                  onChange={(e) => setReviewRemark(e.target.value)}
                  className="w-full px-3 py-2 bg-console-bg border border-console-border rounded text-console-text focus:border-eng-blue focus:outline-none"
                  rows={3}
                  placeholder="请输入处理结果或说明..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setReviewer('');
                  setReviewRemark('');
                }}
                className="px-4 py-2 text-sm border border-console-border rounded text-console-muted hover:bg-console-bg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm bg-eng-green text-white rounded hover:bg-eng-green-light transition-colors"
              >
                确认复核
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
