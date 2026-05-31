export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    normal: 'bg-green-500',
    late: 'bg-orange-500',
    duplicate: 'bg-red-500',
    pending: 'bg-yellow-500',
  };
  return colors[status] || 'bg-slate-500';
}

export function getStatusBgClass(status: string): string {
  const classes: Record<string, string> = {
    normal: 'status-normal',
    late: 'status-late',
    duplicate: 'status-duplicate',
    pending: 'status-pending',
  };
  return classes[status] || 'bg-slate-100 text-slate-800';
}

export function getSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    model_list: '📋',
    inspection_photo: '📷',
    manual_correction: '✏️',
  };
  return icons[source] || '📄';
}

export function calculateDistance(
  x1: number, y1: number,
  x2: number, y2: number
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function pointToRectDistance(
  px: number, py: number,
  rx: number, ry: number,
  rw: number, rh: number
): number {
  const closestX = Math.max(rx, Math.min(px, rx + rw));
  const closestY = Math.max(ry, Math.min(py, ry + rh));
  return calculateDistance(px, py, closestX, closestY);
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
