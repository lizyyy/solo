import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import type { GapAlert } from '../../shared/types';
import { SeverityBadge } from './StatusBadge';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { gapCheckApi } from '../services/api';
import { useUIStore } from '../store/uiStore';

interface GapAlertListProps {
  alerts: GapAlert[];
  onFixClick?: (field: string) => void;
}

const typeLabels: Record<GapAlert['type'], string> = {
  valuation: '估值',
  contract: '合同',
  transport: '运输',
  insurance: '保险',
};

const severityIcons = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityColors = {
  error: 'border-red-200 bg-red-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
};

export function GapAlertList({ alerts, onFixClick }: GapAlertListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { showToast } = useUIStore();

  const unresolvedAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  const handleResolve = async (alertId: string) => {
    try {
      const response = await gapCheckApi.resolveAlert(alertId);
      if (response.success) {
        showToast('问题已标记为已解决', 'success');
      }
    } catch (err) {
      showToast('操作失败', 'error');
    }
  };

  const renderAlertItem = (alert: GapAlert) => {
    const Icon = severityIcons[alert.severity];
    const isExpanded = expandedId === alert.id;

    return (
      <div
        key={alert.id}
        className={cn(
        'rounded-lg border transition-all duration-200',
        alert.resolved
          ? 'border-stone-200 bg-stone-50 opacity-60'
          : severityColors[alert.severity]
      )}
      >
        <button
          onClick={() => setExpandedId(isExpanded ? null : alert.id)}
          className="w-full flex items-start gap-3 p-3 text-left"
        >
          <Icon
            className={cn(
            'w-5 h-5 flex-shrink-0 mt-0.5',
            alert.severity === 'error' && 'text-red-500',
            alert.severity === 'warning' && 'text-amber-500',
            alert.severity === 'info' && 'text-blue-500',
            alert.resolved && 'text-stone-400'
          )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={alert.severity} />
              <span className="text-xs font-medium text-stone-500">
                {typeLabels[alert.type]}
              </span>
              {alert.resolved && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  已解决
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-stone-800">{alert.message}</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0 mt-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0 mt-1" />
          )}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 pt-0 border-t border-black/5">
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-stone-500">
                创建时间：{new Date(alert.createdAt).toLocaleString('zh-CN')}
              </span>
              <div className="flex gap-2">
                {!alert.resolved && onFixClick && alert.field && (
                  <button
                    onClick={(e) => {
                    e.stopPropagation();
                    onFixClick(alert.field!);
                  }}
                    className="px-3 py-1 text-xs font-medium text-white bg-slate-800 rounded hover:bg-slate-900 transition-colors"
                  >
                    去修复
                  </button>
                )}
                {!alert.resolved && (
                  <button
                    onClick={(e) => {
                    e.stopPropagation();
                    handleResolve(alert.id);
                  }}
                    className="px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors"
                  >
                    标记已解决
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 bg-emerald-50 rounded-xl border border-emerald-100">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <p className="text-emerald-700 font-medium">数据完整，无待解决问题</p>
        <p className="text-emerald-600 text-sm mt-1">所有字段均已正确填写</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unresolvedAlerts.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            待解决问题 ({unresolvedAlerts.length})
          </h4>
          <div className="space-y-2">
            {unresolvedAlerts.map(renderAlertItem)}
          </div>
        </div>
      )}

      {resolvedAlerts.length > 0 && (
        <div className="pt-3 border-t border-stone-200">
          <h4 className="text-sm font-medium text-stone-500 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            已解决 ({resolvedAlerts.length})
          </h4>
          <div className="space-y-2">
            {resolvedAlerts.map(renderAlertItem)}
          </div>
        </div>
      )}
    </div>
  );
}
