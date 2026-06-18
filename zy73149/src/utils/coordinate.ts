import type { CoordinateFormat } from '@/types';

export function detectCoordinateFormat(raw: string): CoordinateFormat {
  const cleaned = raw.trim().toUpperCase();

  if (cleaned.includes('°') && cleaned.includes("'") && cleaned.includes('"')) {
    return 'dms';
  }

  if (cleaned.includes('°') && cleaned.includes("'") && !cleaned.includes('"')) {
    return 'dm';
  }

  const decimalMatch = cleaned.match(/^[+-]?\d+([.,]\d+)?$/);
  if (decimalMatch) {
    return 'decimal';
  }

  if (cleaned.match(/^[NSWE]?\s*\d+([.,]\d+)?\s*[NSWE]?$/)) {
    return 'decimal';
  }

  return 'decimal';
}

export function parseCoordinate(raw: string, type: 'lat' | 'lng'): number {
  const cleaned = raw.trim().toUpperCase();

  const sign = getDirectionSign(cleaned, type);

  const numericPart = cleaned
    .replace(/[NSWE]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');

  if (numericPart.includes('°') && numericPart.includes("'") && numericPart.includes('"')) {
    return dmsToDecimal(numericPart) * sign;
  }

  if (numericPart.includes('°') && numericPart.includes("'")) {
    return dmToDecimal(numericPart) * sign;
  }

  const decimal = parseFloat(numericPart);
  if (isNaN(decimal)) {
    return 0;
  }
  return decimal * sign;
}

function getDirectionSign(cleaned: string, type: 'lat' | 'lng'): number {
  if (type === 'lat') {
    if (cleaned.includes('S')) return -1;
    return 1;
  } else {
    if (cleaned.includes('W')) return -1;
    return 1;
  }
}

export function dmsToDecimal(dms: string): number {
  const match = dms.match(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)?\'?(\d+(?:\.\d+)?)?\"?/);
  if (!match) return 0;

  const degrees = parseFloat(match[1]) || 0;
  const minutes = parseFloat(match[2]) || 0;
  const seconds = parseFloat(match[3]) || 0;

  return degrees + minutes / 60 + seconds / 3600;
}

export function dmToDecimal(dm: string): number {
  const match = dm.match(/(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)?\'?/);
  if (!match) return 0;

  const degrees = parseFloat(match[1]) || 0;
  const minutes = parseFloat(match[2]) || 0;

  return degrees + minutes / 60;
}

export function decimalToDMS(decimal: number, type: 'lat' | 'lng'): string {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFull = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = ((minutesFull - minutes) * 60).toFixed(1);

  let direction = '';
  if (type === 'lat') {
    direction = decimal >= 0 ? 'N' : 'S';
  } else {
    direction = decimal >= 0 ? 'E' : 'W';
  }

  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

export function decimalToDM(decimal: number, type: 'lat' | 'lng'): string {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutes = ((abs - degrees) * 60).toFixed(2);

  let direction = '';
  if (type === 'lat') {
    direction = decimal >= 0 ? 'N' : 'S';
  } else {
    direction = decimal >= 0 ? 'E' : 'W';
  }

  return `${degrees}°${minutes}'${direction}`;
}

export function formatCoordinate(
  decimal: number,
  type: 'lat' | 'lng',
  format: CoordinateFormat
): string {
  switch (format) {
    case 'dms':
      return decimalToDMS(decimal, type);
    case 'dm':
      return decimalToDM(decimal, type);
    case 'decimal':
    default:
      return decimal.toFixed(6);
  }
}

export function formatLatLng(
  lat: number,
  lng: number,
  format: CoordinateFormat
): string {
  return `${formatCoordinate(lat, 'lat', format)}, ${formatCoordinate(lng, 'lng', format)}`;
}
