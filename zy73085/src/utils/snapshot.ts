import { Anomaly, Snapshot, Note } from "@/types";

export function makeSnapshot(params: {
  anomalyId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  operator: string;
  note?: string;
}): Snapshot {
  return {
    id: `SNAP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    anomalyId: params.anomalyId,
    fieldName: params.fieldName,
    oldValue: params.oldValue == null ? "" : String(params.oldValue),
    newValue: params.newValue == null ? "" : String(params.newValue),
    operator: params.operator,
    note: params.note || "",
    createdAt: new Date().toISOString(),
  };
}

export function makeNote(params: {
  anomalyId: string;
  content: string;
  author: string;
  isProtected?: boolean;
}): Note {
  return {
    id: `NOTE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    anomalyId: params.anomalyId,
    content: params.content,
    author: params.author,
    isProtected: params.isProtected ?? true,
    createdAt: new Date().toISOString(),
  };
}

export function generateRunId(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `RUN_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export interface RerunMergeResult {
  keptAnomalies: Anomaly[];
  newAnomalies: Anomaly[];
  changedSnapshots: Snapshot[];
  preservedNoteIds: string[];
  countBefore: number;
  countAfter: number;
}

export function mergeRerunAnomalies(params: {
  existingAnomalies: Anomaly[];
  newAnomalies: Anomaly[];
  existingNotes: Note[];
  existingSnapshots: Snapshot[];
  runId: string;
  operator: string;
}): {
  mergedAnomalies: Anomaly[];
  mergedSnapshots: Snapshot[];
  mergedNotes: Note[];
  report: RerunMergeResult;
} {
  const { existingAnomalies, newAnomalies, existingNotes, existingSnapshots, runId, operator } = params;

  const matchedKeys = new Set<string>();
  const keyOf = (a: Anomaly) => `${a.annotationId}::${a.type}`;

  const mergedAnomalies: Anomaly[] = [];
  const newSnapshots: Snapshot[] = [];
  const changedAnomalyIds: string[] = [];

  for (const existing of existingAnomalies) {
    const k = keyOf(existing);
    const newer = newAnomalies.find((n) => keyOf(n) === k);
    if (newer) {
      matchedKeys.add(k);
      const updated: Anomaly = { ...existing };
      let changed = false;

      if (newer.status !== existing.status) {
        newSnapshots.push(
          makeSnapshot({
            anomalyId: existing.id,
            fieldName: "status",
            oldValue: existing.status,
            newValue: newer.status,
            operator,
            note: `重跑（${runId}）检测到状态变化`,
          })
        );
        updated.status = newer.status;
        changed = true;
      }
      if (newer.conclusionAfter !== existing.conclusionAfter) {
        newSnapshots.push(
          makeSnapshot({
            anomalyId: existing.id,
            fieldName: "conclusion",
            oldValue: existing.conclusionAfter || "",
            newValue: newer.conclusionAfter || "",
            operator,
            note: `重跑（${runId}）结论变更`,
          })
        );
        updated.conclusionBefore = existing.conclusionAfter;
        updated.conclusionAfter = newer.conclusionAfter;
        changed = true;
      }
      if (newer.holdDecision !== existing.holdDecision) {
        newSnapshots.push(
          makeSnapshot({
            anomalyId: existing.id,
            fieldName: "holdDecision",
            oldValue: existing.holdDecision || "",
            newValue: newer.holdDecision || "",
            operator,
            note: `重跑（${runId}）挂起决策变化`,
          })
        );
        updated.holdDecision = newer.holdDecision;
        updated.holdReason = newer.holdReason;
        changed = true;
      }
      if (newer.description !== existing.description) {
        updated.description = newer.description;
      }
      updated.updatedAt = new Date().toISOString();
      if (changed) changedAnomalyIds.push(existing.id);
      mergedAnomalies.push(updated);
    } else {
      mergedAnomalies.push(existing);
    }
  }

  const brandNew = newAnomalies
    .filter((n) => !matchedKeys.has(keyOf(n)))
    .map((n) => ({ ...n, isRerunGenerated: true, runId }));
  mergedAnomalies.push(...brandNew);

  const preservedNoteIds = existingNotes.map((n) => n.id);

  return {
    mergedAnomalies,
    mergedSnapshots: [...existingSnapshots, ...newSnapshots],
    mergedNotes: existingNotes,
    report: {
      keptAnomalies: existingAnomalies,
      newAnomalies: brandNew,
      changedSnapshots: newSnapshots,
      preservedNoteIds,
      countBefore: existingAnomalies.length,
      countAfter: mergedAnomalies.length,
    },
  };
}
