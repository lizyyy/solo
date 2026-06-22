import type { SpareRecord, MergeResult, RecordStatus } from "./types";
import { STATUS_LABEL } from "./mapping";

function dedupKey(partNo: string): string {
  return partNo.trim().toLowerCase();
}

function genId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseStatus(raw: string | null | undefined): RecordStatus {
  if (!raw) return "pending";
  return STATUS_LABEL[raw.trim()] ?? "pending";
}

function isManualStatus(status: RecordStatus): boolean {
  return status === "confirmed" || status === "withdrawn";
}

export interface IncomingRecord {
  partNo: string;
  partDesc: string;
  status?: string | null;
  remark?: string | null;
  sampling?: string | null;
  rawRow: string;
  sourceFile: string;
  sourceBatch: string;
  mappedFields: Record<string, string>;
}

export interface MergeFieldDecision {
  field: "status" | "remark" | "partDesc" | "sampling" | "sourceFile";
  action: "overwrite" | "keep_old" | "append_history";
  reason: string;
}

export function mergeRecords(
  existing: SpareRecord[],
  incoming: IncomingRecord[]
): MergeResult & { decisions: Map<string, MergeFieldDecision[]> } {
  const existingMap = new Map<string, SpareRecord>();
  for (const r of existing) {
    existingMap.set(dedupKey(r.partNo), { ...r });
  }

  let createdCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;
  const now = Date.now();
  const decisions = new Map<string, MergeFieldDecision[]>();

  for (const inc of incoming) {
    if (!inc.partNo.trim()) {
      skippedCount++;
      continue;
    }
    const key = dedupKey(inc.partNo);
    const old = existingMap.get(key);

    if (!old) {
      const newRec: SpareRecord = {
        id: genId(),
        partNo: inc.partNo.trim(),
        partDesc: inc.partDesc.trim(),
        rawRow: inc.rawRow,
        rawRowHistory: [inc.rawRow],
        sourceFile: inc.sourceFile,
        sourceBatch: inc.sourceBatch,
        status: parseStatus(inc.status),
        remark: (inc.remark ?? "").trim(),
        sampling: inc.sampling?.trim() ?? null,
        mappedFields: inc.mappedFields,
        anomalies: [],
        createdAt: now,
        updatedAt: now,
      };
      existingMap.set(key, newRec);
      createdCount++;
      decisions.set(newRec.id, [
        { field: "status", action: "overwrite", reason: "新记录，使用CSV原始状态" },
        { field: "remark", action: "overwrite", reason: "新记录，使用CSV原始备注" },
      ]);
    } else {
      const recordDecisions: MergeFieldDecision[] = [];
      const recordId = old.id;

      const oldRemark = old.remark.trim();
      const newRemark = (inc.remark ?? "").trim();
      if (oldRemark) {
        if (newRemark && oldRemark !== newRemark) {
          old.rawRowHistory = [...(old.rawRowHistory ?? []), inc.rawRow];
          recordDecisions.push({
            field: "remark",
            action: "append_history",
            reason: "本地已有备注（人工锁定），新备注追加到原始说法历史，永不覆盖",
          });
        } else {
          recordDecisions.push({
            field: "remark",
            action: "keep_old",
            reason: "本地已有备注（人工锁定），新备注为空或相同，保留原值",
          });
        }
      } else if (newRemark) {
        old.remark = newRemark;
        recordDecisions.push({
          field: "remark",
          action: "overwrite",
          reason: "本地无备注，使用CSV备注",
        });
      }

      if (isManualStatus(old.status)) {
        recordDecisions.push({
          field: "status",
          action: "keep_old",
          reason: `本地状态"${old.status}"为人工处理结果（确认/撤回），永不被CSV原始状态覆盖`,
        });
      } else {
        const newStatus = parseStatus(inc.status);
        if (newStatus !== old.status) {
          old.status = newStatus;
          recordDecisions.push({
            field: "status",
            action: "overwrite",
            reason: `本地状态"${old.status}"非人工处理，更新为CSV状态"${newStatus}"`,
          });
        } else {
          recordDecisions.push({
            field: "status",
            action: "keep_old",
            reason: `本地状态"${old.status}"与CSV状态一致，无需更新`,
          });
        }
      }

      if (inc.partDesc.trim() && inc.partDesc.trim() !== old.partDesc) {
        old.partDesc = inc.partDesc.trim();
        recordDecisions.push({
          field: "partDesc",
          action: "overwrite",
          reason: "CSV备件描述有更新，覆盖本地（不影响人工处理状态）",
        });
      }

      const newSampling = inc.sampling?.trim() ?? null;
      if (newSampling !== old.sampling) {
        old.sampling = newSampling;
        recordDecisions.push({
          field: "sampling",
          action: "overwrite",
          reason: "CSV采样值有更新，覆盖本地（不影响人工处理状态）",
        });
      }

      old.mappedFields = { ...old.mappedFields, ...inc.mappedFields };
      old.sourceBatch = inc.sourceBatch;
      if (inc.sourceFile && inc.sourceFile !== old.sourceFile) {
        old.sourceFile = inc.sourceFile;
        recordDecisions.push({
          field: "sourceFile",
          action: "overwrite",
          reason: "更新为最新导入来源文件（仅作展示，不影响合并判定）",
        });
      }
      old.updatedAt = now;

      if (!old.rawRowHistory.includes(inc.rawRow)) {
        old.rawRowHistory = [...(old.rawRowHistory ?? [old.rawRow]), inc.rawRow];
      }
      old.rawRow = inc.rawRow;

      existingMap.set(key, old);
      mergedCount++;
      decisions.set(recordId, recordDecisions);
    }
  }

  const records = Array.from(existingMap.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );

  return { records, createdCount, mergedCount, skippedCount, decisions };
}
