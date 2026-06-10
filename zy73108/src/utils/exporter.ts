import type { ChangeLog, FilterOptions, MaterialRecord } from "@/types";
import { formatDate } from "./validators";

const escapeCsv = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export interface TimelineExportItem {
  timestamp: string;
  batchNo: string;
  action: string;
  operator: string;
  materialNo: string;
  title: string;
  detail: string;
  recordId: string;
}

const ACTION_LABEL: Record<string, string> = {
  import: "导入",
  confirm: "确认",
  revoke: "撤回",
  remark: "修改备注",
  mark_late: "标记晚到变更",
  unmark_late: "取消晚到标记",
  update: "更新",
  supplement: "后补新版本",
};

export const buildTimelineRows = (
  logs: ChangeLog[],
  records: MaterialRecord[],
  filter: FilterOptions
): TimelineExportItem[] => {
  const recMap = new Map(records.map((r) => [r.id, r]));
  return logs
    .filter((log) => {
      if (filter.batchNo && filter.batchNo.trim()) {
        if (!log.batchNo.includes(filter.batchNo.trim())) return false;
      }
      if (filter.action && filter.action !== "all" && log.action !== filter.action) {
        return false;
      }
      if (filter.operator && filter.operator.trim()) {
        if (!log.operator.includes(filter.operator.trim())) return false;
      }
      if (filter.materialNo && filter.materialNo.trim()) {
        const mno = log.materialNo || recMap.get(log.recordId)?.materialNo || "";
        if (!mno.includes(filter.materialNo.trim())) return false;
      }
      if (filter.keyword && filter.keyword.trim()) {
        const kw = filter.keyword.trim().toLowerCase();
        const hay = [
          log.detail,
          log.operator,
          log.batchNo,
          log.materialNo,
          log.title,
          recMap.get(log.recordId)?.title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (filter.dateFrom) {
        if (log.timestamp < filter.dateFrom + "T00:00:00") return false;
      }
      if (filter.dateTo) {
        if (log.timestamp > filter.dateTo + "T23:59:59") return false;
      }
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((log) => {
      const r = recMap.get(log.recordId);
      return {
        timestamp: formatDate(log.timestamp),
        batchNo: log.batchNo,
        action: ACTION_LABEL[log.action] || log.action,
        operator: log.operator,
        materialNo: log.materialNo || r?.materialNo || "",
        title: log.title || r?.title || "",
        detail: log.detail,
        recordId: log.recordId,
      };
    });
};

export const exportTimelineJson = (rows: TimelineExportItem[]): Blob => {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: rows.length,
    rows,
  };
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
};

export const exportTimelineCsv = (rows: TimelineExportItem[]): Blob => {
  const headers = [
    "时间",
    "批次号",
    "操作",
    "操作人",
    "材料编号",
    "标题",
    "详情",
    "记录ID",
  ];
  const head = headers.map(escapeCsv).join(",");
  const body = rows
    .map((r) =>
      [
        r.timestamp,
        r.batchNo,
        r.action,
        r.operator,
        r.materialNo,
        r.title,
        r.detail,
        r.recordId,
      ]
        .map(escapeCsv)
        .join(",")
    )
    .join("\n");
  const bom = "\uFEFF";
  return new Blob([bom + head + "\n" + body], {
    type: "text/csv;charset=utf-8",
  });
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const buildBatchFilterUrl = (batchNo: string): string => {
  const params = new URLSearchParams();
  params.set("batchNo", batchNo);
  return `/timeline?${params.toString()}`;
};

export const parseFilterFromUrl = (): FilterOptions => {
  const params = new URLSearchParams(window.location.search);
  const filter: FilterOptions = {};
  const keys: (keyof FilterOptions)[] = [
    "keyword",
    "batchNo",
    "status",
    "operator",
    "action",
    "dateFrom",
    "dateTo",
    "materialNo",
  ];
  keys.forEach((k) => {
    const v = params.get(k as string);
    if (v) (filter as Record<string, string>)[k] = v;
  });
  return filter;
};
