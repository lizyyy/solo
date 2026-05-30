import { AlertCircle, AlertTriangle, Info, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { AnomalyRecord, ImpactAssessment } from '@/utils/types';
import TraceBreadcrumb from './TraceBreadcrumb';
import ImpactBadge from './ImpactBadge';

interface AnomalyCardProps {
  anomaly: AnomalyRecord;
  impact?: ImpactAssessment;
  selected: boolean;
  onClick: () => void;
}

export default function AnomalyCard({ anomaly, impact, selected, onClick }: AnomalyCardProps) {
  const severityConfig = {
    critical: { color: '#e74c3c', bgColor: 'rgba(231, 76, 60, 0.1)', Icon: AlertCircle, label: '严重' },
    warning: { color: '#f39c12', bgColor: 'rgba(243, 156, 18, 0.1)', Icon: AlertTriangle, label: '警告' },
    info: { color: '#4a90d9', bgColor: 'rgba(74, 144, 217, 0.1)', Icon: Info, label: '提示' },
  };

  const statusConfig = {
    pending: { Icon: Clock, color: '#f39c12', label: '待处理' },
    confirmed: { Icon: CheckCircle2, color: '#22c55e', label: '已确认' },
    dismissed: { Icon: XCircle, color: '#6b7280', label: '已忽略' },
  };

  const config = severityConfig[anomaly.severity];
  const status = statusConfig[anomaly.status];
  const StatusIcon = status.Icon;
  const SeverityIcon = config.Icon;

  const typeLabels: Record<string, string> = {
    SURFACE_THROUGH_WALL: '反射面穿透',
    ZONE_MAPPING_ERROR: '区域映射错误',
    FREQUENCY_MISSING: '频率数据缺失',
  };

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-72 text-left rounded-lg border transition-all ${
        selected
          ? 'border-hall-amber bg-hall-surface shadow-lg shadow-hall-amber/20'
          : 'border-hall-border bg-hall-panel hover:border-hall-amber/50'
      }`}
      style={{ borderLeftWidth: '4px', borderLeftColor: config.color }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: config.bgColor, color: config.color }}
            >
              <SeverityIcon className="w-3 h-3" />
              {config.label}
            </span>
            <span className="text-xs text-hall-textDim">{typeLabels[anomaly.type] || anomaly.type}</span>
          </div>
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: status.color }}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
        </div>

        <p className="text-sm text-hall-text mb-3 line-clamp-2">{anomaly.description}</p>

        {impact && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <ImpactBadge type="budget" level={impact.budgetImpact} />
            <ImpactBadge type="schedule" level={impact.scheduleImpact} />
            <ImpactBadge type="roster" level={impact.rosterImpact} />
          </div>
        )}

        <TraceBreadcrumb traceChain={anomaly.traceChain} />
      </div>
    </button>
  );
}
