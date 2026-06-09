import type { SpareRecord, MergeResult, RecordStatus } from "./types";
import { STATUS_LABEL } from "./mapping";

function dedupKey(partNo: string, sourceFile: string): string {
  return `${partNo.trim().toLowerCase()}::${sourceFile.trim().toLowerCase()}`;
}

function genId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseStatus(raw: string | null | undefined): RecordStatus {
  if (!raw) return "pending";
  return STATUS_LABEL[raw.trim()] ?? "pending";
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

export function mergeRecords(
  existing: SpareRecord[],
  incoming: IncomingRecord[]
): MergeResult {
  const existingMap = new Map<string, SpareRecord>();
  for (const r of existing) {
    existingMap.set(dedupKey(r.partNo, r.sourceFile), { ...r });
  }

  let createdCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;
  const now = Date.now();

  for (const inc of incoming) {
    if (!inc.partNo.trim()) {
      skippedCount++;
      continue;
    }
    const key = dedupKey(inc.partNo, inc.sourceFile);
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
    } else {
      const oldRemark = old.remark.trim();
      const newRemark = (inc.remark ?? "").trim();
      if (oldRemark && !newRemark) {
        // 保留旧备注
      } else if (!oldRemark && newRemark) {
        old.remark = newRemark;
      } else if (oldRemark && newRemark && oldRemark !== newRemark) {
        // 两边都有备注且不同：保留旧的，新的追加到原始说法历史
        old.rawRowHistory = [...(old.rawRowHistory ?? []), inc.rawRow];
      }

      if (old.status !== "confirmed") {
        old.status = parseStatus(inc.status);
      }

      old.partDesc = inc.partDesc.trim() || old.partDesc;
      old.sampling = inc.sampling?.trim() ?? old.sampling;
      old.mappedFields = { ...old.mappedFields, ...inc.mappedFields };
      old.sourceBatch = inc.sourceBatch;
      old.updatedAt = now;

      if (!old.rawRowHistory.includes(inc.rawRow)) {
        old.rawRowHistory = [...(old.rawRowHistory ?? [old.rawRow]), inc.rawRow];
      }
      old.rawRow = inc.rawRow;

      existingMap.set(key, old);
      mergedCount++;
    }
  }

  const records = Array.from(existingMap.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );

  return { records, createdCount, mergedCount, skippedCount };
}
