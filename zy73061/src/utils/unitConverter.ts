export function MPaToBar(mpa: number): number {
  return Number((mpa * 10).toFixed(2));
}

export function barToMPa(bar: number): number {
  return Number((bar / 10).toFixed(2));
}

export function cToF(c: number): number {
  return Number(((c * 9) / 5 + 32).toFixed(1));
}

export function fToC(f: number): number {
  return Number((((f - 32) * 5) / 9).toFixed(1));
}

export function mmpsToInps(mmps: number): number {
  return Number((mmps / 25.4).toFixed(3));
}

export function inpsToMmps(inps: number): number {
  return Number((inps * 25.4).toFixed(2));
}

export function formatValue(value: number, unit: string, digits = 2): string {
  return `${value.toFixed(digits)} ${unit}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysBetween(iso1: string, iso2: string): number {
  const d1 = new Date(iso1).getTime();
  const d2 = new Date(iso2).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}
