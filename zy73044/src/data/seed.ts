import type { SpareRecord } from "@/lib/types";

const now = Date.now();
const H = 3600_000;

export function seedRecords(): SpareRecord[] {
  const base: Omit<SpareRecord, "id" | "createdAt" | "updatedAt">[] = [
    {
      partNo: "PS-2024-0142",
      partDesc: "3号离心泵机械密封组件",
      rawRow: "PS-2024-0142,3号离心泵机械密封组件,24.5,待确认,,06-08白班",
      rawRowHistory: ["PS-2024-0142,3号离心泵机械密封组件,24.5,待确认,,06-08白班"],
      sourceFile: "06-08白班-备件清单.csv",
      sourceBatch: "seed_08",
      status: "confirmed",
      remark: "上一班张工已更换，泄漏量从28滴/分降到5滴/分",
      sampling: "24.5",
      mappedFields: {},
      anomalies: [],
    },
    {
      partNo: "PS-2024-0142",
      partDesc: "3号离心泵机械密封组件",
      rawRow: "物料号,品名,采样,状态,备注,来源\nPS-2024-0142,3号离心泵机械密封组件,58,待确认,,06-09夜班",
      rawRowHistory: ["物料号,品名,采样,状态,备注,来源\nPS-2024-0142,3号离心泵机械密封组件,58,待确认,,06-09夜班"],
      sourceFile: "06-09夜班-备件清单.csv",
      sourceBatch: "seed_09",
      status: "pending",
      remark: "",
      sampling: "58",
      mappedFields: {},
      anomalies: ["gap"],
      gapDetail: { prevRowId: "seed_prev_0142", prevValue: "24.5", currValue: "58" },
    },
    {
      partNo: "VL-1107",
      partDesc: "出口阀电动执行器主板",
      rawRow: "VL-1107,出口阀电动执行器主板,,已确认,4号泵,6-08夜班",
      rawRowHistory: ["VL-1107,出口阀电动执行器主板,,已确认,4号泵,6-08夜班"],
      sourceFile: "06-08夜班-备件清单.csv",
      sourceBatch: "seed_08",
      status: "confirmed",
      remark: "下一班需校准阀门开度反馈",
      sampling: "",
      mappedFields: {},
      anomalies: ["missing"],
    },
    {
      partNo: "FS-0501-A",
      partDesc: "进水流量变送器",
      rawRow: "FS-0501-A,进水流量变送器,720,已确认,06-09凌晨校准,6-09夜班",
      rawRowHistory: ["FS-0501-A,进水流量变送器,720,已确认,06-09凌晨校准,6-09夜班"],
      sourceFile: "06-09夜班-备件清单.csv",
      sourceBatch: "seed_09",
      status: "confirmed",
      remark: "凌晨2点校准完成，当前示值与手持表偏差<0.5%",
      sampling: "720",
      mappedFields: {},
      anomalies: [],
    },
    {
      partNo: "MT-903",
      partDesc: "",
      rawRow: "MT-903,,35.2,待确认,,06-09夜班",
      rawRowHistory: ["MT-903,,35.2,待确认,,06-09夜班"],
      sourceFile: "06-09夜班-备件清单.csv",
      sourceBatch: "seed_09",
      status: "pending",
      remark: "",
      sampling: "35.2",
      mappedFields: {},
      anomalies: ["missing"],
    },
    {
      partNo: "BK-0220",
      partDesc: "2号泵轴承箱温度探头",
      rawRow: "BK-0220,2号泵轴承箱温度探头,67,已撤回,,06-08白班",
      rawRowHistory: ["BK-0220,2号泵轴承箱温度探头,67,已撤回,,06-08白班"],
      sourceFile: "06-08白班-备件清单.csv",
      sourceBatch: "seed_08",
      status: "withdrawn",
      remark: "误报，实为探头接线松动，重新紧固后正常",
      sampling: "67",
      mappedFields: {},
      anomalies: [],
    },
  ];

  return base.map((b, i) => ({
    ...b,
    id: i === 1 ? "seed_prev_0142_companion" : `seed_${i.toString(36)}`,
    createdAt: now - (6 - i) * H,
    updatedAt: now - (6 - i) * H,
  })).map(r => r.id === "seed_prev_0142_companion" ? { ...r, id: "seed_gap_0142" } : r);
}

export const SEED_SAMPLE_ID = "seed_gap_0142";
