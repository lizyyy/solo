export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function convertToMeters(value: number, unit: string): number {
  switch (unit) {
    case 'cm':
      return value / 100;
    case 'ft':
      return value * 0.3048;
    default:
      return value;
  }
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    confirmed: '已确认',
    pending: '待补件',
    returned: '退回',
    all: '全部',
  };
  return map[status] || status;
}

export function getAnomalyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    outlier: '离群值',
    unit_mismatch: '单位混写',
    bottle_mismatch: '编号版本',
    manual_change: '人工改判',
    none: '正常',
  };
  return map[type] || type;
}

export function getSourceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    original: '原始采集',
    old_bottle_id: '旧版编号',
    manual_review: '人工改判',
    verbal_note: '口头备注',
  };
  return map[type] || type;
}

export function getUnitLabel(unit: string): string {
  const map: Record<string, string> = {
    m: '米 (m)',
    cm: '厘米 (cm)',
    ft: '英尺 (ft)',
    mixed: '单位混写',
    all: '全部',
  };
  return map[unit] || unit;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadFile(filename: string, content: string, mimeType = 'text/markdown'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
