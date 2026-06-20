import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const r = Math.round(n * 1e4) / 1e4;
  return String(r);
}

export function formatTs(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

export function shortHash(hash: string): string {
  return hash.length > 10 ? `${hash.slice(0, 10)}…` : hash;
}
