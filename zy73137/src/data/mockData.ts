import type {
  AnomalyEvent,
  BuoyLog,
  CalculationSpec,
  HistoryVersion,
  ManualRecord,
  MetricMeta,
  SupplementaryNote,
} from "@/types";

const BASE = new Date("2026-06-17T08:00:00+08:00").getTime();
const HOUR = 3_600_000;
const MIN = 60_000;

export const TIME_RANGE: [number, number] = [BASE, BASE + 6 * HOUR];

export const METRICS: MetricMeta[] = [
  { key: "dissolvedOxygen", label: "溶解氧", unit: "mg/L", color: "#2EC4B6", domain: [4, 10] },
  { key: "turbidity", label: "浊度", unit: "NTU", color: "#F4A261", domain: [0, 80] },
  { key: "ph", label: "pH", unit: "", color: "#8B9AFF", domain: [6.5, 8.8] },
  { key: "tideLevel", label: "潮位", unit: "m", color: "#60A5FA", domain: [0, 3.5] },
];

export const BUOY_LOGS: BuoyLog[] = [
  mkLog("B-01", BASE + 0 * MIN, 7.8, 18, 7.52, 24.1, 1.23, "m", "normal"),
  mkLog("B-02", BASE + 30 * MIN, 7.6, 22, 7.55, 24.2, 1.48, "m", "normal"),
  mkLog("B-03", BASE + 60 * MIN, 7.4, 28, 7.58, 24.3, 1.72, "m", "normal"),
  mkLog("B-04", BASE + 90 * MIN, 7.2, 35, 7.60, 24.4, 1.95, "m", "normal"),
  mkLog("B-05", BASE + 120 * MIN, 6.9, 48, 7.61, 24.6, 2.18, "m", "warning"),
  mkLog("B-06", BASE + 150 * MIN, 5.1, 62, 7.58, 24.7, 2.35, "m", "error"),
  mkLog("B-07", BASE + 180 * MIN, 6.4, 44, 7.55, 24.8, 2.48, "m", "warning"),
  mkLog("B-08", BASE + 210 * MIN, 7.1, 30, 7.53, 24.9, 2.36, "m", "normal"),
  mkLog("B-09", BASE + 240 * MIN, 7.3, 25, 7.50, 25.0, 2.12, "cm", "normal"),
  mkLog("B-10", BASE + 270 * MIN, 7.5, 21, 7.48, 25.0, 1.88, "cm", "normal"),
  mkLog("B-11", BASE + 300 * MIN, 7.7, 19, 7.46, 25.1, 1.64, "m", "normal"),
  mkLog("B-12", BASE + 330 * MIN, 7.8, 17, 7.45, 25.1, 1.38, "m", "normal"),
];

function mkLog(
  id: string,
  t: number,
  do_: number,
  turb: number,
  ph: number,
  temp: number,
  tide: number,
  unit: "m" | "cm",
  status: "normal" | "warning" | "error",
): BuoyLog {
  return {
    id,
    timestamp: t,
    deviceId: "FB-QS-007",
    dissolvedOxygen: do_,
    turbidity: turb,
    ph,
    temperature: temp,
    tideLevel: tide,
    tideUnit: unit,
    rawPayload: `$$FBQS007,${new Date(t).toISOString()},DO=${do_.toFixed(2)},TUR=${turb.toFixed(
      1,
    )},PH=${ph.toFixed(2)},T=${temp.toFixed(1)},TIDE=${tide.toFixed(2)}${unit}*00`,
    status,
  };
}

export const MANUAL_RECORDS: ManualRecord[] = [
  {
    id: "M-01",
    recordedAt: BASE + 155 * MIN,
    arrivedAt: BASE + 260 * MIN,
    location: "前山航道#3浮筒",
    sampleDO: 5.4,
    sampleTurbidity: 58,
    operator: "老陈",
    remark: "现场看到疏浚船作业，水样略浑浊，晚到原因：船载网络故障，回港后补发。",
  },
];

export const SUPPLEMENTARY_NOTES: SupplementaryNote[] = [
  {
    id: "N-01",
    attachedAt: BASE + 295 * MIN,
    author: "数据组 · 小林",
    content:
      "11:30-12:00 时段溶解氧突降，已与港航调度确认是临时疏浚船路过，属于正常干扰，非水质恶化。潮位单位在 B-09/B-10 两条日志中被传感器误写为 cm，已标记待确认，后续由数据运维统一修正。",
    relatedTimeRange: [BASE + 90 * MIN, BASE + 270 * MIN],
  },
];

export const ANOMALIES: AnomalyEvent[] = [
  {
    id: "A-01",
    timestamp: BASE + 150 * MIN,
    type: "anomaly",
    severity: "high",
    reason: "溶解氧突降",
    detail: "DO 从 6.9 → 5.1 mg/L，15 分钟内下跌 26%，超阈值下限 (5.5 mg/L)。",
    relatedBuoyLogIds: ["B-05", "B-06", "B-07"],
    relatedManualIds: ["M-01"],
    confirmed: true,
    confirmedBy: "小林",
  },
  {
    id: "A-02",
    timestamp: BASE + 240 * MIN,
    type: "pending_confirmation",
    severity: "medium",
    reason: "潮位单位混写",
    detail:
      "B-08 单位为 m (2.36)，B-09 突变为 cm (2.12)，B-10 仍为 cm (1.88)，B-11 恢复为 m (1.64)。单位不一致，已自动进入待确认。",
    relatedBuoyLogIds: ["B-08", "B-09", "B-10", "B-11"],
    relatedManualIds: [],
    confirmed: false,
  },
];

export const SPEC_V1: CalculationSpec = {
  id: "SPEC-V1",
  version: "v1",
  timestamp: BASE + 10 * MIN,
  formula: "WQI = 0.4·DO_norm + 0.3·TURB_norm + 0.3·PH_norm",
  unitConversions: { tideLevel: "m", turbidity: "NTU", dissolvedOxygen: "mg/L" },
  involvedFields: ["dissolvedOxygen", "turbidity", "ph", "tideLevel"],
  thresholds: {
    dissolvedOxygen: [5.5, 9.0],
    turbidity: [0, 50],
    ph: [6.8, 8.5],
    tideLevel: [0.5, 3.0],
  },
};

export const SPEC_V2: CalculationSpec = {
  ...SPEC_V1,
  id: "SPEC-V2",
  version: "v2",
  timestamp: BASE + 265 * MIN,
  involvedFields: [...SPEC_V1.involvedFields, "manual.sampleDO", "manual.sampleTurbidity"],
  formula:
    "WQI = 0.4·DO_norm + 0.3·TURB_norm + 0.3·PH_norm；异常段用船上记录线性插值修正",
};

export const SPEC_V3: CalculationSpec = {
  ...SPEC_V2,
  id: "SPEC-V3",
  version: "v3",
  timestamp: BASE + 310 * MIN,
  unitConversions: { ...SPEC_V2.unitConversions, tideLevel: "m (cm 自动 ×0.01)" },
  thresholds: { ...SPEC_V2.thresholds, turbidity: [0, 70] },
  formula:
    "WQI = 0.4·DO_norm + 0.3·TURB_norm + 0.3·PH_norm；异常段用船上记录线性插值修正；潮位单位 cm 自动换算为 m",
};

export const HISTORY_VERSIONS: HistoryVersion[] = [
  {
    id: "H-V1",
    versionTag: "v1",
    createdAt: BASE + 10 * MIN,
    createdBy: "系统自动",
    trigger: "auto",
    hasManualEdit: false,
    spec: SPEC_V1,
    continuityReport: {
      hasGaps: false,
      gaps: [],
    },
  },
  {
    id: "H-V2",
    versionTag: "v2",
    createdAt: BASE + 265 * MIN,
    createdBy: "数据组 · 小林",
    trigger: "supplement_rerun",
    hasManualEdit: true,
    manualEditFields: ["involvedFields", "formula"],
    spec: SPEC_V2,
    continuityReport: {
      hasGaps: true,
      gaps: [{ from: BASE + 145 * MIN, to: BASE + 165 * MIN, durationMs: 20 * MIN }],
    },
  },
  {
    id: "H-V3",
    versionTag: "v3",
    createdAt: BASE + 310 * MIN,
    createdBy: "数据组 · 小林",
    trigger: "manual_rerun",
    hasManualEdit: true,
    manualEditFields: ["unitConversions.tideLevel", "thresholds.turbidity", "formula"],
    spec: SPEC_V3,
    continuityReport: {
      hasGaps: false,
      gaps: [],
    },
  },
];
