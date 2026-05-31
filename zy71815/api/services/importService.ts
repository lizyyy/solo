import db from "../db.js";
import crypto from "crypto";
import xlsx from "xlsx";
import type {
  SettlementRecord,
  ImportResult,
  ImportSession,
} from "../../shared/types.js";

interface ParsedRow {
  store_name: string;
  activity_name: string;
  settlement_period: string;
  serial_number: string;
  amount: number;
  handling_fee: number;
  handling_fee_period: string;
}

const stagedImports = new Map<string, SettlementRecord[]>();

export function computeDedupHash(
  store_name: string,
  activity_name: string,
  settlement_period: string,
  serial_number: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${store_name}|${activity_name}|${settlement_period}|${serial_number}`)
    .digest("hex");
}

export function parseExcelFile(buffer: Buffer): ParsedRow[] {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw Object.assign(new Error("请上传包含数据的文件"), { status: 400 });
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return rows.map((row) => ({
    store_name: String(row["门店名称"] ?? row["store_name"] ?? ""),
    activity_name: String(row["活动名称"] ?? row["activity_name"] ?? ""),
    settlement_period: String(row["结算期间"] ?? row["settlement_period"] ?? ""),
    serial_number: String(row["流水号"] ?? row["serial_number"] ?? ""),
    amount: Number(row["金额"] ?? row["amount"] ?? 0),
    handling_fee: Number(row["手续费"] ?? row["handling_fee"] ?? 0),
    handling_fee_period: String(row["手续费期间"] ?? row["handling_fee_period"] ?? ""),
  }));
}

export function importRecords(rows: ParsedRow[], fileName: string): ImportResult {
  const sessionId = crypto.randomUUID();

  const newRecords: SettlementRecord[] = [];
  const duplicateRecords: { record: SettlementRecord; reason: string }[] = [];
  const conflictRecords: {
    existing: SettlementRecord;
    incoming: Partial<SettlementRecord>;
    diff_fields: string[];
  }[] = [];

  const getExistingStmt = db.prepare("SELECT * FROM settlement_records WHERE dedup_hash = ?");

  for (const row of rows) {
    if (!row.store_name || !row.activity_name || !row.settlement_period || !row.serial_number) {
      continue;
    }

    const dedupHash = computeDedupHash(
      row.store_name,
      row.activity_name,
      row.settlement_period,
      row.serial_number
    );

    const existing = getExistingStmt.get(dedupHash) as SettlementRecord | undefined;

    if (!existing) {
      const record: SettlementRecord = {
        id: crypto.randomUUID(),
        store_name: row.store_name,
        activity_name: row.activity_name,
        settlement_period: row.settlement_period,
        serial_number: row.serial_number,
        amount: row.amount,
        handling_fee: row.handling_fee,
        handling_fee_period: row.handling_fee_period,
        status: "pending",
        dedup_hash: dedupHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      newRecords.push(record);
    } else if (existing.amount === row.amount) {
      duplicateRecords.push({
        record: existing,
        reason: `门店"${row.store_name}"活动"${row.activity_name}"期间${row.settlement_period}流水号${row.serial_number}已存在且金额一致`,
      });
    } else {
      const diffFields: string[] = [];
      if (existing.amount !== row.amount) diffFields.push("amount");
      if (existing.handling_fee !== row.handling_fee) diffFields.push("handling_fee");
      if (existing.handling_fee_period !== row.handling_fee_period)
        diffFields.push("handling_fee_period");

      conflictRecords.push({
        existing,
        incoming: {
          amount: row.amount,
          handling_fee: row.handling_fee,
          handling_fee_period: row.handling_fee_period,
        },
        diff_fields: diffFields,
      });
    }
  }

  const insertSessionStmt = db.prepare(`
    INSERT INTO import_sessions (id, file_name, total_rows, new_count, duplicate_count, conflict_count, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'processing', datetime('now'))
  `);
  insertSessionStmt.run(
    sessionId,
    fileName,
    rows.length,
    newRecords.length,
    duplicateRecords.length,
    conflictRecords.length
  );

  stagedImports.set(sessionId, newRecords);

  return {
    session_id: sessionId,
    total: rows.length,
    new_count: newRecords.length,
    duplicate_count: duplicateRecords.length,
    conflict_count: conflictRecords.length,
    new_records: newRecords,
    duplicate_records: duplicateRecords,
    conflict_records: conflictRecords,
  };
}

export function confirmImport(sessionId: string): number {
  const staged = stagedImports.get(sessionId);
  if (!staged || staged.length === 0) {
    const error: Error & { status?: number } = new Error("导入会话不存在或无新记录可导入");
    error.status = 404;
    throw error;
  }

  const insertStmt = db.prepare(`
    INSERT INTO settlement_records (id, store_name, activity_name, settlement_period, serial_number, amount, handling_fee, handling_fee_period, status, dedup_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
  `);

  const logStmt = db.prepare(`
    INSERT INTO operation_logs (id, record_id, operation_type, operator, before_value, after_value, reason, created_at)
    VALUES (?, ?, 'import', 'system', null, ?, '导入确认', datetime('now'))
  `);

  const updateSessionStmt = db.prepare(
    "UPDATE import_sessions SET status = 'completed' WHERE id = ?"
  );

  const tx = db.transaction(() => {
    for (const record of staged) {
      insertStmt.run(
        record.id,
        record.store_name,
        record.activity_name,
        record.settlement_period,
        record.serial_number,
        record.amount,
        record.handling_fee,
        record.handling_fee_period,
        record.dedup_hash
      );
      logStmt.run(crypto.randomUUID(), record.id, JSON.stringify(record));
    }
    updateSessionStmt.run(sessionId);
  });

  const count = staged.length;
  tx();
  stagedImports.delete(sessionId);
  return count;
}

export function listImportSessions(): ImportSession[] {
  return db
    .prepare("SELECT * FROM import_sessions ORDER BY created_at DESC LIMIT 20")
    .all() as ImportSession[];
}
