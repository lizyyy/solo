import type { SummarySnapshot } from "@/types";

export function hashString(input: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const out = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return out.toString(16).padStart(14, "0");
}

export function buildSummaryHash(
  s: Omit<SummarySnapshot, "hash">,
): string {
  const payload = JSON.stringify([
    s.sessionId,
    s.coachName,
    s.auditedAt,
    s.paramVersionId,
    s.totalRows,
    s.validRows,
    s.withdrawnRows,
    s.boundaryRows,
    s.missingUnitRows,
    s.highDeviationRows,
    s.formulaLabel,
    s.rSquared.toFixed(6),
    s.rmse.toFixed(6),
    s.verdictLevel,
    s.verdictText,
    s.boundaryNote,
    s.unitNote,
    s.exceptionNote,
    s.handoffNotes.join("|"),
  ]);
  return hashString(payload);
}

export function verifySummary(s: SummarySnapshot): { ok: boolean; actual: string } {
  const { hash: _h, ...rest } = s;
  const actual = buildSummaryHash(rest as Omit<SummarySnapshot, "hash">);
  return { ok: actual === s.hash, actual };
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}
