import type { DetectionRecord, TimeBinAggregate, AlgoResult } from "@/data/types";

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface RunAlgoInput {
  rawRecords: DetectionRecord[];
  thresholdMm: number;
}

export function runAnomalyAlgo(input: RunAlgoInput): AlgoResult {
  const { rawRecords, thresholdMm } = input;
  const records: DetectionRecord[] = rawRecords.map((r) => ({ ...r }));
  const byBin = new Map<string, DetectionRecord[]>();
  for (const r of records) {
    if (!byBin.has(r.timeWindow)) byBin.set(r.timeWindow, []);
    byBin.get(r.timeWindow)!.push(r);
  }

  const bins: TimeBinAggregate[] = [];
  for (const [window, list] of byBin) {
    const values = list.map((r) => r.rawValue);
    const rawMean = mean(values);
    const devs = values.map((v) => Math.abs(v - rawMean));
    const sd = stddev(values);
    const p95 = percentile(devs, 0.95);

    const maskFlags = new Map<string, boolean>();
    for (const r of list) {
      const d = Math.abs(r.rawValue - rawMean);
      if (sd > 0 && d > 2 * sd) {
        const others = list.filter((x) => x.id !== r.id).map((x) => x.rawValue);
        const meanWithout = mean(others);
        if (
          others.length &&
          Math.abs(meanWithout - rawMean) / Math.max(rawMean, 0.0001) > 0.15
        ) {
          maskFlags.set(r.id, true);
        }
      }
    }

    const robustValues = list
      .filter((r) => !maskFlags.has(r.id))
      .map((r) => r.rawValue);
    const robustMean = mean(robustValues.length ? robustValues : values);

    const pullAbs: number[] = [];
    for (const r of list) {
      pullAbs.push(Math.abs(r.rawValue - robustMean));
    }

    let anomalousCount = 0;
    let boundaryCount = 0;
    let hasStrongPull = false;

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const absDev = pullAbs[i];
      r.deviation = r.rawValue - robustMean;

      const withinBoundaryBand =
        absDev >= thresholdMm * 0.95 && absDev <= thresholdMm * 1.05;
      const fieldDirty = !Number.isFinite(r.rawValue) || r.rawValue <= 0;
      const isBoundary = withinBoundaryBand || fieldDirty;

      const isStrong = maskFlags.get(r.id) ?? false;
      if (isStrong) hasStrongPull = true;

      let status: DetectionRecord["status"] = "normal";
      let reason: string | undefined;

      if (isBoundary) {
        status = "boundary";
        boundaryCount++;
        if (fieldDirty) reason = "字段异常 / 脏数据";
        else reason = `偏差处于阈值 ±5% 边界带`;
      } else if (absDev > thresholdMm || isStrong || absDev > p95) {
        status = "anomalous";
        anomalousCount++;
        if (isStrong) reason = "强拉动异常（反掩盖：排除后组均值变化>15%）";
        else if (absDev > thresholdMm)
          reason = `绝对偏差 ${absDev.toFixed(2)}mm 超阈值 ${thresholdMm.toFixed(2)}mm`;
        else reason = `偏差位于 P95 以外`;
      }

      r.status = status;
      r.anomalyReason = reason;
      r.isStrongPull = isStrong;
    }

    const totalAbs = pullAbs.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < list.length; i++) {
      list[i].contribution = pullAbs[i] / totalAbs;
    }

    bins.push({
      window,
      mean: rawMean,
      robustMean,
      count: list.length,
      anomalousCount,
      boundaryCount,
      hasStrongPull,
      recordIds: list.map((r) => r.id),
    });
  }

  bins.sort((a, b) => a.window.localeCompare(b.window));

  let anomalous = 0;
  let boundary = 0;
  let normal = 0;
  let strongPullCount = 0;
  let maxContribution = 0;
  for (const r of records) {
    if (r.status === "anomalous") anomalous++;
    else if (r.status === "boundary") boundary++;
    else normal++;
    if (r.isStrongPull) strongPullCount++;
    if ((r.contribution ?? 0) > maxContribution)
      maxContribution = r.contribution ?? 0;
  }

  return {
    records,
    bins,
    summary: {
      total: records.length,
      anomalous,
      boundary,
      normal,
      strongPullCount,
      maxContribution,
    },
  };
}

export function selectRecordsByBin(
  result: AlgoResult,
  window: string,
): DetectionRecord[] {
  const bin = result.bins.find((b) => b.window === window);
  if (!bin) return [];
  const map = new Map(result.records.map((r) => [r.id, r]));
  return bin.recordIds
    .map((id) => map.get(id))
    .filter(Boolean) as DetectionRecord[];
}
