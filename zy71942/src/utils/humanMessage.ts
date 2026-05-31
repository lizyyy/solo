import type { ConflictStatus, ConflictType, TimeSystem } from "@/types";

export function formatConflictType(type: ConflictType): string {
  const map: Record<ConflictType, string> = {
    window_overlap: "窗口重叠",
    telemetry_frame_drop: "遥测缺帧",
    time_system_mixed: "时间制混用",
  };
  return map[type];
}

export function formatConflictStatus(status: ConflictStatus): string {
  const map: Record<ConflictStatus, string> = {
    pending: "待确认",
    confirmed: "已确认",
    ignored: "已忽略",
  };
  return map[status];
}

export function formatTimeSystem(ts: TimeSystem): string {
  const map: Record<TimeSystem, string> = {
    UTC: "UTC",
    BJT: "北京时间(BJT)",
    UNKNOWN: "未知",
  };
  return map[ts];
}
