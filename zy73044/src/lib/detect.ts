import type { SpareRecord, AnomalyType, GapDetail } from "./types";

const GAP_THRESHOLD_NUMERIC = 30;

function tryNumber(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export interface DetectResult {
  records: SpareRecord[];
  gapCount: number;
  missingCount: number;
  conflictCount: number;
}

export function detectAnomalies(input: SpareRecord[]): DetectResult {
  const records = input.map((r) => ({ ...r, anomalies: [] as AnomalyType[], gapDetail: undefined as GapDetail | undefined }));

  let gapCount = 0;
  let missingCount = 0;
  let conflictCount = 0;

  const byPart = new Map<string, SpareRecord[]>();
  for (const r of records) {
    const list = byPart.get(r.partNo) ?? [];
    list.push(r);
    byPart.set(r.partNo, list);
  }

  for (const r of records) {
    if (!r.partNo.trim() || !r.partDesc.trim()) {
      r.anomalies.push("missing");
      missingCount++;
    }
  }

  for (const [, list] of byPart) {
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const pn = tryNumber(prev.sampling);
      const cn = tryNumber(curr.sampling);
      let isGap = false;

      if (prev.sampling == null || prev.sampling === "" || curr.sampling == null || curr.sampling === "") {
        isGap = true;
      } else if (pn !== null && cn !== null && Math.abs(cn - pn) > GAP_THRESHOLD_NUMERIC) {
        isGap = true;
      } else if (prev.sampling.trim() !== curr.sampling.trim() && pn === null) {
        isGap = Math.abs(prev.sampling.length - curr.sampling.length) > 10;
      }

      if (isGap && !curr.anomalies.includes("gap")) {
        curr.anomalies.push("gap");
        curr.gapDetail = {
          prevRowId: prev.id,
          prevValue: prev.sampling,
          currValue: curr.sampling,
        };
        gapCount++;
      }
    }
  }

  const statusByPartSource = new Map<string, Map<string, SpareRecord["status"]>>();
  for (const r of records) {
    const key = r.partNo + "::" + r.sourceFile;
    const inner = statusByPartSource.get(r.partNo) ?? new Map();
    const prev = inner.get(r.sourceFile);
    if (prev && prev !== r.status && !r.anomalies.includes("conflict")) {
      r.anomalies.push("conflict");
      conflictCount++;
    }
    inner.set(r.sourceFile, r.status);
    statusByPartSource.set(r.partNo, inner);
  }

  return { records, gapCount, missingCount, conflictCount };
}
