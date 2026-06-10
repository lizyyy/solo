export const STATUS_OPTIONS = [
  { value: 'pending', label: '待复核', badge: 'badge-default' },
  { value: 'reviewing', label: '复核中', badge: 'badge-info' },
  { value: 'need_supplement', label: '需补材料', badge: 'badge-warning' },
  { value: 'approved', label: '可放行', badge: 'badge-success' },
  { value: 'rejected', label: '不予放行', badge: 'badge-danger' }
];

export const SEVERITY_OPTIONS = [
  { value: 'critical', label: '严重', badge: 'badge-danger' },
  { value: 'warning', label: '警告', badge: 'badge-warning' },
  { value: 'info', label: '提示', badge: 'badge-info' }
];

export function getStatusMeta(status) {
  return STATUS_OPTIONS.find(s => s.value === status) || { label: status, badge: 'badge-default' };
}

export function getSeverityMeta(severity) {
  return SEVERITY_OPTIONS.find(s => s.value === severity) || { label: severity, badge: 'badge-default' };
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
