import type { Anomaly, AnomalyType, SurveyRecord } from "../data/types";

export function buildAnomaly(
  id: string,
  recordId: string,
  type: AnomalyType,
  description: string
): Anomaly {
  return { id, recordId, type, description, resolved: false };
}

const UNIT_RE: [string, RegExp][] = [
  ["m", /\d\s*m\b(?!s)/i],
  ["米", /米/],
  ["cm", /\d\s*cm\b/i],
  ["厘米", /厘米/],
  ["ft", /\d\s*ft\b/i],
  ["英尺", /英尺/],
];

function detectUnitsInField(tide: string): string[] {
  const found: string[] = [];
  for (const [name, re] of UNIT_RE) {
    if (re.test(tide)) found.push(name);
  }
  if (found.length === 0 && /^[\d.]+$/.test(tide.trim())) {
    found.push("none");
  }
  return found;
}

export function detectTideUnitMix(records: SurveyRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const batchUnits = new Set<string>();

  const recordUnits = new Map<string, string[]>();
  for (const r of records) {
    const units = detectUnitsInField(r.tideLevel ?? "");
    recordUnits.set(r.id, units);
    for (const u of units) {
      if (u !== "none") batchUnits.add(u);
    }
  }

  for (const r of records) {
    const units = recordUnits.get(r.id) ?? [];
    if (units.includes("none")) {
      anomalies.push(
        buildAnomaly(
          `${r.id}-tum`,
          r.id,
          "tide_unit_mix",
          `潮位值「${r.tideLevel}」缺少单位标识`
        )
      );
    } else if (units.length > 1) {
      anomalies.push(
        buildAnomaly(
          `${r.id}-tum`,
          r.id,
          "tide_unit_mix",
          `潮位值「${r.tideLevel}」包含多种单位：${units.join("、")}`
        )
      );
    }
  }

  if (batchUnits.size >= 2) {
    for (const r of records) {
      const units = recordUnits.get(r.id) ?? [];
      const hasAnomaly = anomalies.some((a) => a.recordId === r.id && a.type === "tide_unit_mix");
      if (!hasAnomaly && units.length === 1 && !units.includes("none")) {
        anomalies.push(
          buildAnomaly(
            `${r.id}-tum-batch`,
            r.id,
            "tide_unit_mix",
            `同批次检测到 ${batchUnits.size} 种潮位单位（${Array.from(batchUnits).join("、")}），当前记录「${r.tideLevel}」`
          )
        );
      }
    }
  }

  return anomalies;
}

export function detectTimeMismatch(records: SurveyRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const THRESHOLD = 24 * 60 * 60 * 1000;

  for (const r of records) {
    if (!r.sampledAt || !r.createdAt) continue;
    if (r.notes.length > 0) continue;
    const sampled = new Date(r.sampledAt).getTime();
    const created = new Date(r.createdAt).getTime();
    if (isNaN(sampled) || isNaN(created)) continue;
    const diff = Math.abs(sampled - created);
    if (diff > THRESHOLD) {
      anomalies.push(
        buildAnomaly(
          `${r.id}-tm`,
          r.id,
          "time_mismatch",
          `采样时间与记录时间相差 ${Math.round(diff / 3600000)} 小时，超过 24 小时且无后补备注`
        )
      );
    }
  }
  return anomalies;
}

export function detectMissing(records: SurveyRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  for (const r of records) {
    const missing: string[] = [];
    if (!r.station?.trim()) missing.push("站点");
    if (!r.sampledAt?.trim()) missing.push("采样时间");
    if (r.bleachingRate === null || r.bleachingRate === undefined) missing.push("白化率");
    if (r.waterTemp === null || r.waterTemp === undefined) missing.push("水温");
    if (missing.length > 0) {
      anomalies.push(
        buildAnomaly(
          `${r.id}-mv`,
          r.id,
          "missing_value",
          `缺失字段：${missing.join("、")}`
        )
      );
    }
  }
  return anomalies;
}

export function detectOutlier(records: SurveyRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const temps = records
    .map((r) => r.waterTemp)
    .filter((v): v is number => v !== null && v !== undefined);
  const rates = records
    .map((r) => r.bleachingRate)
    .filter((v): v is number => v !== null && v !== undefined);

  function stats(vals: number[]) {
    if (vals.length < 3) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    return { mean, std, lo: mean - 3 * std, hi: mean + 3 * std };
  }

  const ts = stats(temps);
  const rs = stats(rates);

  for (const r of records) {
    if (r.waterTemp !== null && r.waterTemp !== undefined && ts) {
      if (r.waterTemp < ts.lo || r.waterTemp > ts.hi) {
        anomalies.push(
          buildAnomaly(
            `${r.id}-ov-wt`,
            r.id,
            "outlier_value",
            `水温 ${r.waterTemp}°C 超出 3σ 范围 [${ts.lo.toFixed(1)}, ${ts.hi.toFixed(1)}]`
          )
        );
      }
    }
    if (r.bleachingRate !== null && r.bleachingRate !== undefined && rs) {
      if (r.bleachingRate < rs.lo || r.bleachingRate > rs.hi) {
        anomalies.push(
          buildAnomaly(
            `${r.id}-ov-br`,
            r.id,
            "outlier_value",
            `白化率 ${r.bleachingRate}% 超出 3σ 范围 [${rs.lo.toFixed(1)}, ${rs.hi.toFixed(1)}]`
          )
        );
      }
    }
  }
  return anomalies;
}

export function detectAll(records: SurveyRecord[]): Anomaly[] {
  const all = [
    ...detectTideUnitMix(records),
    ...detectTimeMismatch(records),
    ...detectMissing(records),
    ...detectOutlier(records),
  ];
  const seen = new Set<string>();
  return all.filter((a) => {
    const key = `${a.recordId}-${a.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function applyAnomalies(records: SurveyRecord[], anomalies: Anomaly[]): SurveyRecord[] {
  const map = new Map<string, Anomaly[]>();
  for (const a of anomalies) {
    const list = map.get(a.recordId) ?? [];
    list.push(a);
    map.set(a.recordId, list);
  }
  return records.map((r) => ({
    ...r,
    anomalies: map.get(r.id) ?? r.anomalies,
  }));
}
