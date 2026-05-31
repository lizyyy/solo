import type { ItemStatus } from '../types';

interface StatusTagProps {
  status: ItemStatus;
}

export function StatusTag({ status }: StatusTagProps) {
  const statusConfig = {
    normal: { label: '正常', className: 'status-tag status-normal' },
    pending: { label: '待确认', className: 'status-tag status-pending' },
    anomaly: { label: '异常', className: 'status-tag status-anomaly' },
  };

  const config = statusConfig[status];

  return <span className={config.className}>[{config.label}]</span>;
}

export function AnomalyTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    duplicate: '重复入账',
    cross_period: '手续费跨期',
    pending: '退款挂账',
    late_attachment: '晚到附件',
  };

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-data-xs font-mono bg-status-pending/10 text-status-pending border border-status-pending/20">
      {labels[type] || type}
    </span>
  );
}

export function FileTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    invoice: '发票',
    settlement: '结算单',
    proof: '凭证',
  };

  const colors: Record<string, string> = {
    invoice: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    settlement: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    proof: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-data-xs font-mono border ${colors[type] || colors.proof}`}>
      {labels[type] || type}
    </span>
  );
}

export function ConclusionBadge({ conclusion }: { conclusion: string }) {
  const labels: Record<string, string> = {
    valid: '确认有效',
    invalid: '确认无效',
    adjusted: '已调整',
  };

  const colors: Record<string, string> = {
    valid: 'bg-status-normal/10 text-status-normal border-status-normal/20',
    invalid: 'bg-status-anomaly/10 text-status-anomaly border-status-anomaly/20',
    adjusted: 'bg-status-pending/10 text-status-pending border-status-pending/20',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-data-xs font-mono border ${colors[conclusion] || colors.valid}`}>
      {labels[conclusion] || conclusion}
    </span>
  );
}
