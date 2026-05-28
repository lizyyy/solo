import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Filter, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store';
import AnomalyCard from '@/components/AnomalyCard';
import DrillDownDrawer from '@/components/DrillDownDrawer';
import { ANOMALY_LABELS } from '@/types';
import type { AnomalyType, Severity } from '@/types';

export default function AnomalyPage() {
  const {
    anomalies,
    isLoading,
    selectedCell,
    drillDownRecords,
    resolveAnomaly,
    setSelectedCell,
    updateRecordConfirmation,
    recalculateMatrix,
  } = useAppStore();
  
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [showResolved, setShowResolved] = useState(false);

  const stats = useMemo(() => {
    const unresolved = anomalies.filter(a => !a.isResolved);
    return {
      total: unresolved.length,
      high: unresolved.filter(a => a.severity === 'HIGH').length,
      medium: unresolved.filter(a => a.severity === 'MEDIUM').length,
      low: unresolved.filter(a => a.severity === 'LOW').length,
      byType: {
        MISSING_SAMPLE: unresolved.filter(a => a.type === 'MISSING_SAMPLE').length,
        PROMO_DISTORT: unresolved.filter(a => a.type === 'PROMO_DISTORT').length,
        ABSORBING_MISSET: unresolved.filter(a => a.type === 'ABSORBING_MISSET').length,
      },
    };
  }, [anomalies]);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter(a => {
      if (a.isResolved && !showResolved) return false;
      if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      return true;
    }).sort((a, b) => {
      const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      if (a.isResolved !== b.isResolved) return a.isResolved ? 1 : -1;
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [anomalies, typeFilter, severityFilter, showResolved]);

  const typeOptions: (AnomalyType | 'ALL')[] = ['ALL', 'MISSING_SAMPLE', 'PROMO_DISTORT', 'ABSORBING_MISSET'];
  const severityOptions: (Severity | 'ALL')[] = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-navy-500">
          <div className="text-4xl mb-2 animate-pulse">🔍</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="section-title">异常诊断台</h2>
          <p className="section-subtitle">
            自动检测状态跳转缺样、促销干扰、吸收态误设三类异常，点击查看原始记录并标记处理
          </p>
        </div>
        <button
          onClick={recalculateMatrix}
          disabled={isLoading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          重新检测
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-danger-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-danger-50 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <div className="stat-value text-danger-600">{stats.high}</div>
              <div className="stat-label">高风险异常</div>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-warning-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-warning-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <div className="stat-value text-warning-600">{stats.medium}</div>
              <div className="stat-label">中风险异常</div>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-success-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <div className="stat-value text-success-600">{stats.low}</div>
              <div className="stat-label">低风险异常</div>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-navy-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-navy-500" />
            </div>
            <div>
              <div className="stat-value text-navy-600">{stats.total}</div>
              <div className="stat-label">待处理总计</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-sm text-navy-500 mb-2">状态跳转缺样</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-navy-900">{stats.byType.MISSING_SAMPLE}</span>
            <span className="text-xs text-navy-500">项</span>
          </div>
          <div className="mt-2 w-full bg-navy-100 rounded-full h-2">
            <div
              className="bg-navy-500 h-2 rounded-full transition-all"
              style={{ width: stats.total > 0 ? `${(stats.byType.MISSING_SAMPLE / stats.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-navy-500 mb-2">促销干扰</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-brand-600">{stats.byType.PROMO_DISTORT}</span>
            <span className="text-xs text-navy-500">项</span>
          </div>
          <div className="mt-2 w-full bg-navy-100 rounded-full h-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all"
              style={{ width: stats.total > 0 ? `${(stats.byType.PROMO_DISTORT / stats.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-navy-500 mb-2">吸收态误设</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-danger-600">{stats.byType.ABSORBING_MISSET}</span>
            <span className="text-xs text-navy-500">项</span>
          </div>
          <div className="mt-2 w-full bg-navy-100 rounded-full h-2">
            <div
              className="bg-danger-500 h-2 rounded-full transition-all"
              style={{ width: stats.total > 0 ? `${(stats.byType.ABSORBING_MISSET / stats.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl shadow-card p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-navy-500" />
            <span className="text-sm text-navy-600">异常类型：</span>
            <div className="flex items-center gap-2">
              {typeOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setTypeFilter(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    typeFilter === opt
                      ? 'bg-navy-800 text-white'
                      : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                  }`}
                >
                  {opt === 'ALL' ? '全部' : ANOMALY_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>

          <div className="h-8 w-px bg-navy-200" />

          <div className="flex items-center gap-3">
            <span className="text-sm text-navy-600">严重程度：</span>
            <div className="flex items-center gap-2">
              {severityOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSeverityFilter(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    severityFilter === opt
                      ? 'bg-navy-800 text-white'
                      : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                  }`}
                >
                  {opt === 'ALL' ? '全部' : opt === 'HIGH' ? '高风险' : opt === 'MEDIUM' ? '中风险' : '低风险'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
            className="w-4 h-4 rounded border-navy-300 text-navy-600 focus:ring-navy-500"
          />
          <span className="text-sm text-navy-600">显示已处理</span>
        </label>
      </div>

      {filteredAnomalies.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="font-display text-xl font-semibold text-navy-900 mb-2">
              暂无待处理异常
            </h3>
            <p className="text-navy-500">
              当前筛选条件下没有检测到异常，数据质量良好
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAnomalies.map(anomaly => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onResolve={resolveAnomaly}
              onDrillDown={(a) => {
                if (a.fromStatus && a.toStatus) {
                  setSelectedCell({ from: a.fromStatus, to: a.toStatus });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>

    <DrillDownDrawer
      isOpen={!!selectedCell}
      onClose={() => setSelectedCell(null)}
      fromStatus={selectedCell?.from || 'NEW'}
      toStatus={selectedCell?.to || 'NEW'}
      records={drillDownRecords}
      onUpdateConfirmation={updateRecordConfirmation}
    />
    </>
  );
}
