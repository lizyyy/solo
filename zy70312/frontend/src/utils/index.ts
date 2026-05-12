import dayjs from 'dayjs';
import type { ServiceStatus, ReleaseDecision } from '../types';

export const formatTime = (timestamp: number) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

export const formatDateTime = (timestamp: number) => {
  return dayjs(timestamp).format('MM-DD HH:mm');
};

export const formatDate = (timestamp: number) => {
  return dayjs(timestamp).format('YYYY-MM-DD');
};

export const statusLabelMap: Record<ServiceStatus, string> = {
  healthy: '健康',
  warning: '警告',
  critical: '严重',
  frozen: '已冻结',
  missing_metrics: '指标缺失',
};

export const decisionLabelMap: Record<ReleaseDecision, string> = {
  continue: '继续发布',
  observe: '观察',
  freeze: '冻结发布',
  needs_exception: '需例外审批',
};

export const freezeReasonLabelMap: Record<string, string> = {
  budget_exhausted: '预算耗尽',
  rapid_burn: '快速燃烧',
  sustained_burn: '持续燃烧',
  manual: '手动冻结',
};

export const exceptionStatusLabelMap: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  expired: '已过期',
};

export const statusColorMap: Record<ServiceStatus, string> = {
  healthy: '#00B42A',
  warning: '#FF7D00',
  critical: '#F53F3F',
  frozen: '#CB2634',
  missing_metrics: '#86909C',
};

export const getStatusBadgeClass = (status: ServiceStatus) => {
  return `status-badge status-${status}`;
};

export const getDecisionBadgeClass = (decision: ReleaseDecision) => {
  return `status-badge decision-${decision}`;
};

export const getProgressColor = (percent: number) => {
  if (percent > 50) return '#00B42A';
  if (percent > 20) return '#FF7D00';
  return '#F53F3F';
};

export const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  return num.toFixed(0);
};

export const formatPercent = (num: number) => {
  return num.toFixed(2) + '%';
};
