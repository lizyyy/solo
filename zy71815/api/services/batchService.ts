import db from "../db.js";
import crypto from "crypto";
import type { BatchRequest, BatchResult } from "../../shared/types.js";

export function executeBatch(request: BatchRequest): BatchResult {
  const batchId = crypto.randomUUID();
  const details: BatchResult["details"] = [];

  const getRecordStmt = db.prepare("SELECT * FROM settlement_records WHERE id = ?");
  const checkBatchStmt = db.prepare(
    "SELECT id FROM batch_operations WHERE batch_id = ? AND record_id = ?"
  );
  const insertBatchOpStmt = db.prepare(`
    INSERT INTO batch_operations (id, batch_id, record_id, operation, status, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const confirmStmt = db.prepare(
    "UPDATE settlement_records SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
  );
  const withdrawStmt = db.prepare(
    "UPDATE settlement_records SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ? AND status = 'confirmed'"
  );
  const logStmt = db.prepare(`
    INSERT INTO operation_logs (id, record_id, operation_type, operator, before_value, after_value, reason, created_at)
    VALUES (?, ?, ?, 'system', ?, ?, ?, datetime('now'))
  `);

  const tx = db.transaction(() => {
    for (const recordId of request.record_ids) {
      const alreadyProcessed = checkBatchStmt.get(batchId, recordId);
      if (alreadyProcessed) {
        details.push({
          record_id: recordId,
          status: "skipped",
          message: "该记录已在本批次中处理",
        });
        continue;
      }

      const record = getRecordStmt.get(recordId) as
        | { id: string; status: string; [key: string]: unknown }
        | undefined;

      if (!record) {
        insertBatchOpStmt.run(
          crypto.randomUUID(),
          batchId,
          recordId,
          request.operation,
          "failed",
          "记录不存在"
        );
        details.push({
          record_id: recordId,
          status: "failed",
          message: "记录不存在",
        });
        continue;
      }

      if (request.operation === "confirm") {
        if (record.status !== "pending") {
          insertBatchOpStmt.run(
            crypto.randomUUID(),
            batchId,
            recordId,
            request.operation,
            "skipped",
            "只有待确认的记录才能确认"
          );
          details.push({
            record_id: recordId,
            status: "skipped",
            message: "只有待确认的记录才能确认",
          });
          continue;
        }

        const before = JSON.stringify({ status: record.status });
        confirmStmt.run(recordId);
        const after = JSON.stringify({ status: "confirmed" });
        logStmt.run(
          crypto.randomUUID(),
          recordId,
          "confirm",
          before,
          after,
          request.reason || "批量确认"
        );
        insertBatchOpStmt.run(
          crypto.randomUUID(),
          batchId,
          recordId,
          request.operation,
          "success",
          "确认成功"
        );
        details.push({
          record_id: recordId,
          status: "success",
          message: "确认成功",
        });
      } else if (request.operation === "withdraw") {
        if (record.status !== "confirmed") {
          insertBatchOpStmt.run(
            crypto.randomUUID(),
            batchId,
            recordId,
            request.operation,
            "skipped",
            "只有已确认的记录才能撤回"
          );
          details.push({
            record_id: recordId,
            status: "skipped",
            message: "只有已确认的记录才能撤回",
          });
          continue;
        }

        const before = JSON.stringify({ status: record.status });
        withdrawStmt.run(recordId);
        const after = JSON.stringify({ status: "withdrawn" });
        logStmt.run(
          crypto.randomUUID(),
          recordId,
          "withdraw",
          before,
          after,
          request.reason || "批量撤回"
        );
        insertBatchOpStmt.run(
          crypto.randomUUID(),
          batchId,
          recordId,
          request.operation,
          "success",
          "撤回成功"
        );
        details.push({
          record_id: recordId,
          status: "success",
          message: "撤回成功",
        });
      }
    }
  });

  tx();

  const successCount = details.filter((d) => d.status === "success").length;
  const skippedCount = details.filter((d) => d.status === "skipped").length;
  const failedCount = details.filter((d) => d.status === "failed").length;

  return {
    batch_id: batchId,
    total: request.record_ids.length,
    success_count: successCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
    details,
  };
}
