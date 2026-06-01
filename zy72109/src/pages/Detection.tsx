import { useState } from 'react';
import { useStore } from '@/store';
import { DataCleaner } from '@/utils/dataCleaner';
import { AlertTriangle, Shield, CheckCircle, XCircle, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import type { ConfirmStatus, Severity } from '@/types';

const SEVERITY_STYLE: Record<Severity, string> = {
  low: 'bg-success-50 text-success-700 border-success-300',
  medium: 'bg-warning-50 text-warning-700 border-warning-300',
  high: 'bg-alert-50 text-alert-700 border-alert-300',
  critical: 'bg-alert-100 text-alert-900 border-alert-500',
};
const SEVERITY_LABEL: Record<Severity, string> = { low: '低', medium: '中', high: '高', critical: '严重' };
const TYPE_LABEL: Record<string, string> = {
  threshold_exceed: '阈值超标',
  extreme_value: '极端值',
  data_conflict: '数据冲突',
};
const CONFIRM_STYLE: Record<ConfirmStatus, string> = {
  pending: 'status-badge-pending',
  confirmed: 'status-badge-normal',
  rejected: 'status-badge-old',
};
const CONFIRM_LABEL: Record<ConfirmStatus, string> = { pending: '待确认', confirmed: '已确认', rejected: '已驳回' };

export default function Detection() {
  const currentBatch = useStore(s => s.currentBatch);
  const confirmAbnormal = useStore(s => s.confirmAbnormal);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  if (!currentBatch) {
    return (
      <div className="flex items-center justify-center h-64 text-industrial-400 font-mono text-sm">
        请先选择或创建批次
      </div>
    );
  }

  const { abnormalRecords, calculationResults, thresholds, records } = currentBatch;
  const allLoads = calculationResults.map(r => r.totalLoad);
  const maxLoad = allLoads.length > 0 ? Math.max(...allLoads) : 0;
  const threshold = thresholds.maxCoolingLoad;
  const ratio = threshold > 0 ? maxLoad / threshold : 0;
  const gaugeColor = ratio > 1 ? 'bg-alert-500' : ratio > 0.8 ? 'bg-warning-500' : 'bg-success-500';

  const outlierResult = DataCleaner.detectExtremes(allLoads, thresholds.extremeOutlierThreshold);
  const extremeRecords = records.filter(r => r.recordStatus === 'extreme');

  const severityCount: Record<string, number> = {};
  const confirmCount: Record<string, number> = {};
  abnormalRecords.forEach(a => {
    severityCount[a.severity] = (severityCount[a.severity] || 0) + 1;
    confirmCount[a.confirmStatus] = (confirmCount[a.confirmStatus] || 0) + 1;
  });

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      <div className="industrial-card">
        <div className="industrial-card-header flex items-center gap-2">
          <Shield size={16} /> 负荷阈值仪表
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2 font-mono text-xs">
            <span className="text-industrial-600">当前最大负荷</span>
            <span className="text-primary-700 font-semibold">{maxLoad.toFixed(1)} kW / {threshold} kW</span>
          </div>
          <div className="w-full h-6 bg-primary-100 border border-primary-300 overflow-hidden">
            <div className={`h-full ${gaugeColor} transition-all`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-1 font-mono text-xs text-industrial-400">
            <span>0</span>
            <span className="text-warning-600">80% ({(threshold * 0.8).toFixed(0)})</span>
            <span className="text-alert-600">100% ({threshold})</span>
          </div>
        </div>
      </div>

      {extremeRecords.length > 0 && (
        <div className="industrial-card border-alert-400">
          <div className="industrial-card-header flex items-center gap-2 text-alert-700 bg-alert-50">
            <AlertTriangle size={16} /> 极端值记录
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {extremeRecords.map(r => {
              const result = calculationResults.find(c => c.recordId === r.id);
              return (
                <div key={r.id} className="border border-alert-300 bg-alert-50 p-3">
                  <div className="font-mono text-xs text-alert-800 font-semibold mb-1">
                    {new Date(r.timestamp).toLocaleString('zh-CN')}
                  </div>
                  <div className="font-mono text-sm">
                    实际值: <span className="text-alert-700 font-bold">{result?.totalLoad.toFixed(2) ?? r.temperature} kW</span>
                    {' / '}阈值: <span className="text-industrial-600">{threshold} kW</span>
                  </div>
                  {r.sources[0] && (
                    <div className="mt-1">
                      <span className="data-source-link">{r.sources[0].sourceFile}:{r.sources[0].sourceLine}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allLoads.length >= 4 && (
        <div className="industrial-card">
          <div className="industrial-card-header flex items-center gap-2">
            <BarChart3 size={16} /> IQR异常检测 & 统计
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="formula-box">
              <div className="font-semibold text-primary-700 mb-2">IQR边界</div>
              <div className="text-sm space-y-1">
                <div>Q1 = {outlierResult.stats.q1.toFixed(2)} kW</div>
                <div>Q3 = {outlierResult.stats.q3.toFixed(2)} kW</div>
                <div>IQR = {outlierResult.stats.iqr.toFixed(2)} kW</div>
                <div>下界 = {outlierResult.bounds.lower.toFixed(2)} kW</div>
                <div>上界 = {outlierResult.bounds.upper.toFixed(2)} kW</div>
              </div>
              <div className="mt-2 text-xs text-industrial-500">
                检出离群值: {outlierResult.outliers.length} 个
              </div>
            </div>
            <div className="formula-box">
              <div className="font-semibold text-primary-700 mb-2">均值对比</div>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-success-600" />
                  稳健均值（排除极端值）: <span className="font-bold text-success-700">{outlierResult.stats.robustMean.toFixed(2)} kW</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-industrial-500" />
                  全量均值: <span className="text-industrial-700">{outlierResult.stats.mean.toFixed(2)} kW</span>
                </div>
                <div>中位数: {outlierResult.stats.median.toFixed(2)} kW</div>
              </div>
              <div className="mt-2 text-xs text-alert-600">
                差值: {(outlierResult.stats.mean - outlierResult.stats.robustMean).toFixed(2)} kW（极端值影响）
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="industrial-card">
        <div className="industrial-card-header flex items-center gap-2">
          <AlertTriangle size={16} /> 异常记录列表
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-4 mb-4 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-industrial-600">严重程度:</span>
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map(s => (
                <span key={s} className={`status-badge ${SEVERITY_STYLE[s]}`}>
                  {SEVERITY_LABEL[s]} {severityCount[s] || 0}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-industrial-600">确认状态:</span>
              {(['pending', 'confirmed', 'rejected'] as ConfirmStatus[]).map(s => (
                <span key={s} className={`status-badge ${CONFIRM_STYLE[s]}`}>
                  {CONFIRM_LABEL[s]} {confirmCount[s] || 0}
                </span>
              ))}
            </div>
          </div>

          {abnormalRecords.length === 0 && (
            <div className="text-center py-8 text-industrial-400 font-mono text-sm">无异常记录</div>
          )}

          <div className="space-y-3">
            {abnormalRecords.map(a => {
              const record = records.find(r => r.id === a.recordId);
              return (
                <div key={a.id} className="border border-primary-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="status-badge status-badge-conflict">{TYPE_LABEL[a.type] || a.type}</span>
                    <span className={`status-badge ${SEVERITY_STYLE[a.severity]}`}>{SEVERITY_LABEL[a.severity]}</span>
                    <span className={`status-badge ${CONFIRM_STYLE[a.confirmStatus]}`}>
                      {a.confirmStatus === 'confirmed' && <CheckCircle size={12} className="inline mr-1" />}
                      {a.confirmStatus === 'rejected' && <XCircle size={12} className="inline mr-1" />}
                      {a.confirmStatus === 'pending' && <Clock size={12} className="inline mr-1" />}
                      {CONFIRM_LABEL[a.confirmStatus]}
                    </span>
                  </div>
                  <div className="font-mono text-sm mb-1">
                    实际值: <span className="text-alert-700 font-bold">{a.actualValue.toFixed(2)} kW</span>
                    {' / '}阈值: <span className="text-industrial-600">{a.threshold.toFixed(2)} kW</span>
                    <span className="ml-2 text-xs text-industrial-400">
                      ({((a.actualValue / a.threshold) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="text-sm text-industrial-700 mb-2">{a.description}</div>
                  {record?.sources[0] && (
                    <div className="mb-2">
                      <span className="data-source-link">
                        {record.sources[0].sourceFile}:{record.sources[0].sourceLine}
                      </span>
                    </div>
                  )}
                  {a.confirmStatus !== 'pending' && a.confirmedBy && (
                    <div className="text-xs text-industrial-500 mb-2">
                      {a.confirmedBy} · {a.confirmedAt ? new Date(a.confirmedAt).toLocaleString('zh-CN') : '-'}
                      {a.notes && ` · 备注: ${a.notes}`}
                    </div>
                  )}
                  {a.confirmStatus === 'pending' && (
                    <div className="flex items-center gap-2">
                      <input
                        className="industrial-input flex-1 text-xs"
                        placeholder="备注…"
                        value={notesMap[a.id] || ''}
                        onChange={e => setNotesMap(m => ({ ...m, [a.id]: e.target.value }))}
                      />
                      <button
                        className="industrial-btn-success text-xs px-3 py-1"
                        onClick={() => { confirmAbnormal(currentBatch.id, a.id, 'confirmed', notesMap[a.id] || ''); setNotesMap(m => { const n = { ...m }; delete n[a.id]; return n; }); }}
                      >
                        <CheckCircle size={12} className="inline mr-1" />确认
                      </button>
                      <button
                        className="industrial-btn-danger text-xs px-3 py-1"
                        onClick={() => { confirmAbnormal(currentBatch.id, a.id, 'rejected', notesMap[a.id] || ''); setNotesMap(m => { const n = { ...m }; delete n[a.id]; return n; }); }}
                      >
                        <XCircle size={12} className="inline mr-1" />驳回
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
