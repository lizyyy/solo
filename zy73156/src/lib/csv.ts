import type { Reading, Sample } from "@/data/types";
import { fmtNum } from "./format";

export interface CsvRow {
  sampleCode: string;
  station: string;
  anomalyType: string;
  depth: string;
  time: string;
  value: string;
  avg: string;
  max: string;
  min: string;
  drift: string;
  status: string;
}

const STATUS_CN: Record<Reading["status"], string> = {
  normal: "正常",
  warning: "预警",
  blocked: "拦截",
};

function toRow(sample: Sample, reading: Reading): CsvRow {
  return {
    sampleCode: sample.code,
    station: sample.label,
    anomalyType: sample.anomalyTypeLabel,
    depth: String(sample.depth),
    time: reading.timeLabel,
    value: fmtNum(reading.value),
    avg: fmtNum(reading.avg),
    max: fmtNum(reading.max),
    min: fmtNum(reading.min),
    drift: fmtNum(reading.drift),
    status: STATUS_CN[reading.status],
  };
}

export function buildCsv(samples: Sample[]): string {
  const header = [
    "采样编号",
    "站点",
    "异常类型",
    "深度(m)",
    "时刻",
    "读数",
    "平均值",
    "最大值",
    "最小值",
    "漂移",
    "状态",
  ];
  const lines = [header.join(",")];
  for (const s of samples) {
    for (const r of s.readings) {
      const row = toRow(s, r);
      lines.push(
        [
          row.sampleCode,
          `"${row.station}"`,
          row.anomalyType,
          row.depth,
          row.time,
          row.value,
          row.avg,
          row.max,
          row.min,
          row.drift,
          row.status,
        ].join(","),
      );
    }
  }
  return "\uFEFF" + lines.join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
