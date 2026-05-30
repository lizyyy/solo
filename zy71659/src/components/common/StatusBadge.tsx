import React from 'react';
import { AnomalySeverity, AnomalyStatus, AnomalyType, ANOMALY_SEVERITY_LABELS, ANOMALY_STATUS_LABELS, ANOMALY_TYPE_LABELS } from '@/types/anomalies';
import { AlignmentStatus } from '@/types/samples';
import { HistoryAction, HISTORY_ACTION_LABELS } from '@/types/history';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  type: 'severity' | 'status' | 'anomalyType' | 'alignment' | 'action' | 'source';
  value: string;
  className?: string;
}

const severityStyles: Record<AnomalySeverity, string> = {
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  error: 'bg-red-500/20 text-red-400 border-red-500/50',
  critical: 'bg-red-600/30 text-red-300 border-red-500/70 glow-red',
};

const statusStyles: Record<AnomalyStatus, string> = {
  detected: 'bg-slate-500/20 text-slate-300 border-slate-500/50',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  dismissed: 'bg-slate-600/20 text-slate-400 border-slate-600/50',
};

const alignmentStyles: Record<AlignmentStatus, string> = {
  ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  shifted: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  interpolated: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  missing: 'bg-red-500/20 text-red-400 border-red-500/50',
};

const anomalyTypeStyles: Record<AnomalyType, string> = {
  sampling_shift: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  temp_over_limit: 'bg-red-500/20 text-red-400 border-red-500/50',
  missing_load: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  duplicate_data: 'bg-slate-500/20 text-slate-300 border-slate-500/50',
  supplement_data: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
};

const actionStyles: Record<HistoryAction, string> = {
  created: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  updated: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  confirmed: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  dismissed: 'bg-slate-500/20 text-slate-300 border-slate-500/50',
  corrected: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  exported: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  imported: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  deleted: 'bg-red-500/20 text-red-400 border-red-500/50',
};

const sourceStyles: Record<string, string> = {
  direct: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  duplicate: 'bg-slate-500/20 text-slate-300 border-slate-500/50',
  supplement: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
};

const sourceLabels: Record<string, string> = {
  direct: '直采',
  duplicate: '重复',
  supplement: '补录',
};

const alignmentLabels: Record<AlignmentStatus, string> = {
  ok: '正常',
  shifted: '已偏移',
  interpolated: '已插值',
  missing: '缺失',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, className }) => {
  let label = value;
  let style = 'bg-slate-500/20 text-slate-300 border-slate-500/50';

  switch (type) {
    case 'severity':
      label = ANOMALY_SEVERITY_LABELS[value as AnomalySeverity] || value;
      style = severityStyles[value as AnomalySeverity] || style;
      break;
    case 'status':
      label = ANOMALY_STATUS_LABELS[value as AnomalyStatus] || value;
      style = statusStyles[value as AnomalyStatus] || style;
      break;
    case 'anomalyType':
      label = ANOMALY_TYPE_LABELS[value as AnomalyType] || value;
      style = anomalyTypeStyles[value as AnomalyType] || style;
      break;
    case 'alignment':
      label = alignmentLabels[value as AlignmentStatus] || value;
      style = alignmentStyles[value as AlignmentStatus] || style;
      break;
    case 'action':
      label = HISTORY_ACTION_LABELS[value as HistoryAction] || value;
      style = actionStyles[value as HistoryAction] || style;
      break;
    case 'source':
      label = sourceLabels[value] || value;
      style = sourceStyles[value] || style;
      break;
  }

  return (
    <span className={cn('status-badge', style, className)}>
      {label}
    </span>
  );
};
