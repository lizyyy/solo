import type { Reading, Sample } from "@/data/types";

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mo}-${da} ${hh}:${mm}`;
}

export function fmtNum(v: number, digits = 2): string {
  return v.toFixed(digits);
}

export function readingStatusOf(sample: Sample, index: number): Reading["status"] {
  return sample.readings[index]?.status ?? "normal";
}

export function currentReading(sample: Sample | undefined, index: number) {
  if (!sample) return undefined;
  return sample.readings[index];
}

export function sampleRiskScore(sample: Sample): number {
  const blocked = sample.readings.filter((r) => r.status === "blocked").length;
  const warning = sample.readings.filter((r) => r.status === "warning").length;
  return blocked * 3 + warning * 1;
}

export function maxDrift(sample: Sample): number {
  return sample.readings.reduce((m, r) => Math.max(m, r.drift), 0);
}
