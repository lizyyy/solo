export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function estimateCapacity(width: number, height: number, fontSize: number = 16): number {
  const lineHeight = fontSize * 1.4;
  const padding = 8 * 2;
  const usableWidth = width - padding;
  const usableHeight = height - padding;
  const charsPerLine = Math.floor(usableWidth / fontSize);
  const lines = Math.floor(usableHeight / lineHeight);
  return Math.max(charsPerLine * lines, 5);
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateOverlapArea(a: Rect, b: Rect): number {
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapX * overlapY;
}

export function getPositionString(x: number, y: number, width: number, height: number): string {
  return `(${x}, ${y}) ${width}×${height}`;
}

export function truncateText(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
