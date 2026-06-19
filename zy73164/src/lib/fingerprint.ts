import type { ReplayRequest } from '@/types';

const PRECISION = 6;

function round(n: number): number {
  return Number(n.toFixed(PRECISION));
}

function canonicalMatrix(m: number[][]): string {
  return m.map((row) => row.map((v) => round(v).toString()).join(',')).join(';');
}

export function canonicalize(req: Pick<ReplayRequest, 'matrix' | 'method' | 'pivot' | 'tolerance'>): string {
  return [
    req.method,
    req.pivot,
    round(req.tolerance).toString(),
    canonicalMatrix(req.matrix),
  ].join('|');
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function fingerprint(req: Pick<ReplayRequest, 'matrix' | 'method' | 'pivot' | 'tolerance'>): string {
  return djb2(canonicalize(req));
}

export function shortFingerprint(fp: string): string {
  if (fp.length <= 8) return fp;
  return `${fp.slice(0, 4)}…${fp.slice(-4)}`;
}
