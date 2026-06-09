import type { SamplePack, DetectionRecord, MaterialBatch } from "./types";

export const SAMPLE_PACKS: SamplePack[] = [
  {
    id: "pilot-small",
    name: "小包试流程",
    hasBoundary: true,
    description: "含1条边界脏数据，用于验证反掩盖链路",
  },
  {
    id: "full-q2",
    name: "Q2 全量检测",
    hasBoundary: false,
    description: "二季度全部支座检测记录（约 240 条）",
  },
];

export const MATERIAL_BATCHES: Record<string, MaterialBatch> = {
  "B-2025-0411-A": {
    batchId: "B-2025-0411-A",
    supplier: "鞍钢新材有限公司",
    inboundDate: "2025-04-11",
    materialType: "GPZ(II) 盆式橡胶支座",
    sameBatchAnomalies: 3,
    notes: "该批次硫化时间不足，橡胶硬度偏低",
  },
  "B-2025-0422-B": {
    batchId: "B-2025-0422-B",
    supplier: "中交精工股份",
    inboundDate: "2025-04-22",
    materialType: "QZ 球型钢支座",
    sameBatchAnomalies: 0,
  },
  "B-2025-0503-C": {
    batchId: "B-2025-0503-C",
    supplier: "河北恒力橡塑",
    inboundDate: "2025-05-03",
    materialType: "GYZ 板式橡胶支座",
    sameBatchAnomalies: 1,
    notes: "入库抽检时发现厚度偏差 +0.8mm",
  },
  "B-2025-0514-D": {
    batchId: "B-2025-0514-D",
    supplier: "上海振华重工",
    inboundDate: "2025-05-14",
    materialType: "GPZ(KZ) 抗震支座",
    sameBatchAnomalies: 0,
  },
  "B-2025-0527-E": {
    batchId: "B-2025-0527-E",
    supplier: "山东东岳橡胶",
    inboundDate: "2025-05-27",
    materialType: "GYZF4 四氟滑板支座",
    sameBatchAnomalies: 2,
    notes: "疑似脏料混入，同批次出现多个边界样本",
  },
};

function buildRecords(
  packId: string,
  start: string,
  days: number,
  perDay: number,
  seedBase: number,
  injectBoundary: boolean,
): DetectionRecord[] {
  const records: DetectionRecord[] = [];
  const batches = Object.keys(MATERIAL_BATCHES);
  const startTs = new Date(start).getTime();
  let rid = 0;
  for (let d = 0; d < days; d++) {
    for (let p = 0; p < perDay; p++) {
      const hour = 6 + Math.floor((p * 12) / perDay) + ((seedBase + d) % 2);
      const minute = (p * 37 + d * 11) % 60;
      const ts = new Date(startTs + d * 86400000 + hour * 3600000 + minute * 60000);
      const timeWindow = new Date(ts);
      timeWindow.setMinutes(0, 0, 0);
      timeWindow.setHours(Math.floor(timeWindow.getHours() / 4) * 4);
      const pseudo = Math.sin(seedBase + rid * 0.31 + d * 0.17) * 0.5 + 0.5;
      const base = 1.8 + pseudo * 0.8;
      const batch = batches[(d + p) % batches.length];
      let raw = +(base + (pseudo - 0.5) * 0.6).toFixed(3);
      if (batch === "B-2025-0411-A" && pseudo > 0.82) raw = +(raw + 1.6 + pseudo * 0.4).toFixed(3);
      if (batch === "B-2025-0527-E" && pseudo < 0.18) raw = +(raw + 0.9 + pseudo * 0.3).toFixed(3);
      records.push({
        id: `${packId}-r${String(rid).padStart(4, "0")}`,
        packId,
        batchId: batch,
        detectTime: ts.toISOString(),
        timeWindow: timeWindow.toISOString(),
        rawValue: raw,
        status: "normal",
      });
      rid++;
    }
  }
  if (injectBoundary) {
    const target = records[Math.floor(records.length * 0.62)];
    target.rawValue = 4.82;
    target.batchId = "B-2025-0527-E";
  }
  return records;
}

const smallPackRecords = buildRecords("pilot-small", "2025-06-02", 5, 10, 11, true);
const fullPackRecords = buildRecords("full-q2", "2025-04-01", 40, 6, 3, false);

export const DETECTION_RECORDS_BY_PACK: Record<string, DetectionRecord[]> = {
  "pilot-small": smallPackRecords,
  "full-q2": fullPackRecords,
};
