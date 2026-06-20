import type { RedlineNote, FieldChange } from "../../shared/types";

export function diffRedline(before: RedlineNote, after: Partial<RedlineNote>): FieldChange[] {
  const labelMap: Record<string, string> = {
    areaName: "区域名称",
    remark: "备注信息",
    boundaryCoords: "边界坐标",
    recordDate: "记录日期",
    source: "数据口径",
  };
  const changes: FieldChange[] = [];
  for (const key of Object.keys(after) as (keyof RedlineNote)[]) {
    const beforeVal = String(before[key] ?? "");
    const afterVal = String(after[key] ?? "");
    if (beforeVal !== afterVal) {
      changes.push({
        field: key,
        fieldLabel: labelMap[key] || key,
        before: beforeVal,
        after: afterVal,
      });
    }
  }
  return changes;
}
