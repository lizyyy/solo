import type { PayloadPlan, VersionDiff, TimeWindow } from "@/types";

export function computeVersionDiff(
  oldPlan: PayloadPlan,
  newPlan: PayloadPlan,
  affectedConflictIds: string[]
): VersionDiff {
  const oldMap = new Map(oldPlan.windows.map((w) => [w.id, w]));
  const newMap = new Map(newPlan.windows.map((w) => [w.id, w]));

  const added: TimeWindow[] = [];
  const removed: TimeWindow[] = [];
  const modified: TimeWindow[] = [];

  for (const w of newPlan.windows) {
    if (!oldMap.has(w.id)) {
      added.push(w);
    } else {
      const old = oldMap.get(w.id)!;
      if (
        old.startTime !== w.startTime ||
        old.endTime !== w.endTime ||
        old.stationName !== w.stationName ||
        old.timeSystem !== w.timeSystem
      ) {
        modified.push(w);
      }
    }
  }

  for (const w of oldPlan.windows) {
    if (!newMap.has(w.id)) {
      removed.push(w);
    }
  }

  const parts: string[] = [];
  if (added.length > 0) parts.push(`新增${added.length}条窗口`);
  if (removed.length > 0) parts.push(`删除${removed.length}条窗口`);
  if (modified.length > 0) parts.push(`修改${modified.length}条窗口`);

  return {
    id: crypto.randomUUID(),
    planId: newPlan.id,
    oldVersion: oldPlan.version,
    newVersion: newPlan.version,
    added,
    removed,
    modified,
    affectedConflictIds,
    summary: parts.join("，") || "无变更",
  };
}
