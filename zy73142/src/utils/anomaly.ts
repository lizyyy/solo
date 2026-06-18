import type {
  RunParams,
  SurveyRecord,
  TideUnit,
  ParamSnapshot,
  ParamDiff,
  ImportResult,
  ImportDetail,
} from '@/types';

export const CANONICAL_SITE_NAMES = [
  '海沟湾站1号',
  '海沟湾站2号',
  '海沟湾站3号',
  '青礁堤站A',
  '青礁堤站B',
];

const TIDE_UNIT_NORMALIZE: Record<TideUnit, number> = {
  m: 1,
  cm: 0.01,
  ft: 0.3048,
};

export function normalizeTideToMeters(value: number, unit: TideUnit): number {
  return Number((value * TIDE_UNIT_NORMALIZE[unit]).toFixed(3));
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function fuzzyScore(name: string, canonical: string): number {
  const dist = levenshtein(name, canonical);
  const maxLen = Math.max(name.length, canonical.length);
  return Math.round((1 - dist / maxLen) * 100);
}

export function matchCanonicalName(
  name: string,
  threshold: number
): { matched: boolean; best: string; score: number } {
  let bestName = CANONICAL_SITE_NAMES[0];
  let bestScore = -1;
  for (const c of CANONICAL_SITE_NAMES) {
    const s = fuzzyScore(name, c);
    if (s > bestScore) {
      bestScore = s;
      bestName = c;
    }
  }
  return { matched: bestScore >= threshold, best: bestName, score: bestScore };
}

function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function smooth(values: number[], window: number): number[] {
  if (window <= 1) return values.slice();
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const slice = values.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export interface AnomalyReport {
  outlierIds: string[];
  unitMismatchIds: string[];
  nameMismatchIds: string[];
  changedFromPrevIds: string[];
}

export function detectAnomalies(
  records: SurveyRecord[],
  params: RunParams,
  prevFlagMap?: Record<string, SurveyRecord['flags']>
): { records: SurveyRecord[]; report: AnomalyReport } {
  const coverageValues = records.map((r) => r.coverage);
  const smoothed = smooth(coverageValues, params.smoothWindow);

  const q1 = quantile(smoothed, 0.25);
  const q3 = quantile(smoothed, 0.75);
  const iqr = q3 - q1;
  const upper = q3 + params.outlierThreshold * iqr;
  const lower = q1 - params.outlierThreshold * iqr;

  const units = records.map((r) => r.tideUnit);
  const dominantUnit = (['m', 'cm', 'ft'] as TideUnit[]).reduce((best, u) => {
    const c = units.filter((x) => x === u).length;
    const bestC = units.filter((x) => x === best).length;
    return c > bestC ? u : best;
  }, 'm' as TideUnit);

  const report: AnomalyReport = {
    outlierIds: [],
    unitMismatchIds: [],
    nameMismatchIds: [],
    changedFromPrevIds: [],
  };

  const updated = records.map((r, idx) => {
    const val = smoothed[idx];
    const isOutlier = params.keepSuspicious
      ? val > upper || val < lower
      : false;
    const isUnitMismatch = params.normalizeUnit
      ? false
      : r.tideUnit !== dominantUnit;
    const { matched } = matchCanonicalName(r.siteName, params.nameFuzzyMatch);
    const isNameMismatch = !matched;

    const flags: SurveyRecord['flags'] = {
      isOutlier,
      isUnitMismatch,
      isNameMismatch,
      isPendingMaterial: r.flags.isPendingMaterial,
    };

    const anomalyTags: string[] = [];
    if (isOutlier) anomalyTags.push('疑似离群/噪声');
    if (isUnitMismatch) anomalyTags.push(`潮位单位 ${r.tideUnit} 混写`);
    if (isNameMismatch) anomalyTags.push('站点命名对不上');
    if (r.flags.isPendingMaterial) anomalyTags.push(r.pendingNote ?? '缺材料');

    const prevFlags = prevFlagMap?.[r.id];
    if (prevFlags) {
      const changed =
        prevFlags.isOutlier !== flags.isOutlier ||
        prevFlags.isUnitMismatch !== flags.isUnitMismatch ||
        prevFlags.isNameMismatch !== flags.isNameMismatch;
      if (changed) report.changedFromPrevIds.push(r.id);
    }

    if (isOutlier) report.outlierIds.push(r.id);
    if (isUnitMismatch) report.unitMismatchIds.push(r.id);
    if (isNameMismatch) report.nameMismatchIds.push(r.id);

    return {
      ...r,
      flags,
      anomalyTags,
    } as SurveyRecord;
  });

  return { records: updated, report };
}

export function diffParams(
  prev: RunParams,
  curr: RunParams
): ParamDiff[] {
  const keys = Object.keys(curr) as (keyof RunParams)[];
  const diffs: ParamDiff[] = [];
  for (const k of keys) {
    if (prev[k] !== curr[k]) {
      diffs.push({ paramKey: k, oldValue: prev[k], newValue: curr[k] });
    }
  }
  return diffs;
}

export function buildFingerprint(r: SurveyRecord): string {
  const day = r.timestamp.slice(0, 10);
  const cov = Math.round(r.coverage * 100) / 100;
  return `${r.siteName}|${day}|${cov}`;
}

export function simulateImport(
  existing: SurveyRecord[],
  incoming: SurveyRecord[]
): { merged: SurveyRecord[]; result: ImportResult } {
  const existingByFp = new Map<string, SurveyRecord>();
  for (const r of existing) existingByFp.set(buildFingerprint(r), r);

  const details: ImportDetail[] = [];
  const merged: SurveyRecord[] = [...existing];
  let skippedDuplicate = 0;
  let remarkPreserved = 0;
  let inserted = 0;

  for (const inc of incoming) {
    const fp = buildFingerprint(inc);
    const old = existingByFp.get(fp);
    if (!old) {
      merged.push(inc);
      inserted += 1;
      details.push({ fingerprint: fp, action: 'insert', recordId: inc.id });
      continue;
    }
    if (old.remark && !inc.remark) {
      skippedDuplicate += 1;
      remarkPreserved += 1;
      details.push({
        fingerprint: fp,
        action: 'preserve_remark',
        recordId: old.id,
      });
      continue;
    }
    if (old.remark && inc.remark) {
      skippedDuplicate += 1;
      remarkPreserved += 1;
      details.push({
        fingerprint: fp,
        action: 'preserve_remark',
        recordId: old.id,
      });
      continue;
    }
    skippedDuplicate += 1;
    details.push({
      fingerprint: fp,
      action: 'skip_duplicate',
      recordId: old.id,
    });
  }

  return {
    merged,
    result: {
      totalIncoming: incoming.length,
      skippedDuplicate,
      remarkPreserved,
      merged: inserted,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

export function nextVersion(prev: string): string {
  const m = prev.match(/v(\d+)/);
  if (!m) return 'v1';
  return `v${Number(m[1]) + 1}`;
}

export function buildSnapshot(
  version: string,
  params: RunParams,
  affected: string[],
  diffFromPrev?: ParamDiff[]
): ParamSnapshot {
  return {
    version,
    createdAt: new Date().toISOString(),
    params: { ...params },
    affectedRecordIds: affected,
    diffFromPrev,
  };
}
