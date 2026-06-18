export function parseLatitude(raw: string): number {
  const cleaned = raw.trim().toUpperCase();
  const match = cleaned.match(/(\d+(?:\.\d+)?)[°度]?\s*(?:(\d+(?:\.\d+)?)[′'分]?)?\s*([NS])?/);
  if (!match) return 0;

  const degrees = parseFloat(match[1]);
  const minutes = match[2] ? parseFloat(match[2]) : 0;
  const direction = match[3] || 'N';

  let decimal = degrees + minutes / 60;
  if (direction === 'S') decimal = -decimal;

  return Math.round(decimal * 100000) / 100000;
}

export function parseLongitude(raw: string): number {
  const cleaned = raw.trim().toUpperCase();
  const match = cleaned.match(/(\d+(?:\.\d+)?)[°度]?\s*(?:(\d+(?:\.\d+)?)[′'分]?)?\s*([EW])?/);
  if (!match) return 0;

  const degrees = parseFloat(match[1]);
  const minutes = match[2] ? parseFloat(match[2]) : 0;
  const direction = match[3] || 'E';

  let decimal = degrees + minutes / 60;
  if (direction === 'W') decimal = -decimal;

  return Math.round(decimal * 100000) / 100000;
}

export function formatLatitude(decimal: number): string {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutes = Math.round((abs - degrees) * 60 * 100) / 100;
  const direction = decimal >= 0 ? 'N' : 'S';
  return `${degrees}°${minutes.toFixed(2)}'${direction}`;
}

export function formatLongitude(decimal: number): string {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutes = Math.round((abs - degrees) * 60 * 100) / 100;
  const direction = decimal >= 0 ? 'E' : 'W';
  return `${degrees}°${minutes.toFixed(2)}'${direction}`;
}

export function detectFormat(raw: string): string {
  if (raw.includes('°') && raw.includes("'")) return '度分格式';
  if (raw.includes('度') && raw.includes('分')) return '中文度分';
  if (/^\d+(\.\d+)?$/.test(raw.trim())) return '十进制度';
  return '其他格式';
}
