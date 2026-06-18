import { Tag } from 'antd';
import type { ReportStatus, AbnormalSeverity, AbnormalStatus } from '@/types';

export const statusConfig: Record<ReportStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  partial: { label: '部分完成', color: 'blue' },
  complete: { label: '已完成', color: 'green' },
  abnormal: { label: '异常', color: 'red' },
};

export const severityConfig: Record<AbnormalSeverity, { label: string; color: string }> = {
  high: { label: '严重', color: 'red' },
  medium: { label: '中等', color: 'orange' },
  low: { label: '轻微', color: 'blue' },
};

export const abnormalStatusConfig: Record<AbnormalStatus, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'red' },
  processing: { label: '处理中', color: 'orange' },
  resolved: { label: '已解决', color: 'green' },
};

interface StatusTagProps {
  status: ReportStatus;
}

export function StatusTag({ status }: StatusTagProps) {
  const config = statusConfig[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}

interface SeverityTagProps {
  severity: AbnormalSeverity;
}

export function SeverityTag({ severity }: SeverityTagProps) {
  const config = severityConfig[severity];
  return <Tag color={config.color}>{config.label}</Tag>;
}

interface AbnormalStatusTagProps {
  status: AbnormalStatus;
}

export function AbnormalStatusTag({ status }: AbnormalStatusTagProps) {
  const config = abnormalStatusConfig[status];
  return <Tag color={config.color}>{config.label}</Tag>;
}
