import db from "../db.js";
import crypto from "crypto";
import type {
  SettlementRecord,
  SettlementFilter,
  SettlementListResponse,
  DashboardStats,
  ImportSession,
} from "../../shared/types.js";

function buildWhereClause(filter: SettlementFilter): {
  sql: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.store_name) {
    conditions.push("store_name LIKE ?");
    params.push(`%${filter.store_name}%`);
  }
  if (filter.activity_name) {
    conditions.push("activity_name LIKE ?");
    params.push(`%${filter.activity_name}%`);
  }
  if (filter.settlement_period_start) {
    conditions.push("settlement_period >= ?");
    params.push(filter.settlement_period_start);
  }
  if (filter.settlement_period_end) {
    conditions.push("settlement_period <= ?");
    params.push(filter.settlement_period_end);
  }
  if (filter.status) {
    conditions.push("status = ?");
    params.push(filter.status);
  }
  if (filter.amount_min !== undefined) {
    conditions.push("amount >= ?");
    params.push(filter.amount_min);
  }
  if (filter.amount_max !== undefined) {
    conditions.push("amount <= ?");
    params.push(filter.amount_max);
  }

  const sql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql, params };
}

export function buildFilterSummary(filter: SettlementFilter): string {
  const parts: string[] = [];
  if (filter.store_name) parts.push(`门店：${filter.store_name}`);
  if (filter.activity_name) parts.push(`活动名称：${filter.activity_name}`);
  if (filter.settlement_period_start || filter.settlement_period_end) {
    const start = filter.settlement_period_start || "起始";
    const end = filter.settlement_period_end || "至今";
    parts.push(`结算期间：${start} ~ ${end}`);
  }
  if (filter.status) {
    const statusMap: Record<string, string> = {
      pending: "待确认",
      confirmed: "已确认",
      withdrawn: "已撤回",
      conflict: "冲突",
    };
    parts.push(`状态：${statusMap[filter.status] || filter.status}`);
  }
  if (filter.amount_min !== undefined || filter.amount_max !== undefined) {
    const min = filter.amount_min !== undefined ? filter.amount_min : 0;
    const max = filter.amount_max !== undefined ? filter.amount_max : "以上";
    parts.push(`金额：${min} ~ ${max}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "全部记录";
}

export function listSettlements(filter: SettlementFilter): SettlementListResponse {
  const { sql, params } = buildWhereClause(filter);

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM settlement_records ${sql}`).get(...params) as { total: number };

  const page = Math.max(1, filter.page || 1);
  const pageSize = Math.min(Math.max(1, filter.page_size || 20), 100);
  const offset = (page - 1) * pageSize;

  const records = db
    .prepare(`SELECT * FROM settlement_records ${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset) as SettlementRecord[];

  return {
    records,
    total: countRow.total,
    page,
    page_size: pageSize,
    filter_summary: buildFilterSummary(filter),
  };
}

export function getSettlementById(id: string): SettlementRecord {
  const record = db.prepare("SELECT * FROM settlement_records WHERE id = ?").get(id) as SettlementRecord | undefined;
  if (!record) {
    const error: Error & { status?: number } = new Error("记录不存在");
    error.status = 404;
    throw error;
  }
  return record;
}

export function confirmSettlements(ids: string[]): { success: number; skipped: number } {
  let success = 0;
  let skipped = 0;

  const getStmt = db.prepare("SELECT * FROM settlement_records WHERE id = ?");
  const updateStmt = db.prepare(
    "UPDATE settlement_records SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?"
  );
  const logStmt = db.prepare(`
    INSERT INTO operation_logs (id, record_id, operation_type, operator, before_value, after_value, reason, created_at)
    VALUES (?, ?, 'confirm', 'system', ?, ?, '确认结算', datetime('now'))
  `);

  const tx = db.transaction(() => {
    for (const id of ids) {
      const record = getStmt.get(id) as SettlementRecord | undefined;
      if (!record) {
        skipped++;
        continue;
      }
      if (record.status !== "pending") {
        skipped++;
        continue;
      }
      const before = JSON.stringify({ status: record.status });
      updateStmt.run(id);
      const after = JSON.stringify({ status: "confirmed" });
      logStmt.run(crypto.randomUUID(), id, before, after);
      success++;
    }
  });

  tx();
  return { success, skipped };
}

export function withdrawSettlements(ids: string[], reason: string): { success: number; skipped: number } {
  if (!reason || reason.trim().length === 0) {
    const error: Error & { status?: number; field?: string } = new Error("reason");
    error.status = 400;
    error.field = "reason";
    throw error;
  }

  let success = 0;
  let skipped = 0;

  const getStmt = db.prepare("SELECT * FROM settlement_records WHERE id = ?");
  const updateStmt = db.prepare(
    "UPDATE settlement_records SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?"
  );
  const logStmt = db.prepare(`
    INSERT INTO operation_logs (id, record_id, operation_type, operator, before_value, after_value, reason, created_at)
    VALUES (?, ?, 'withdraw', 'system', ?, ?, ?, datetime('now'))
  `);

  const tx = db.transaction(() => {
    for (const id of ids) {
      const record = getStmt.get(id) as SettlementRecord | undefined;
      if (!record) {
        skipped++;
        continue;
      }
      if (record.status !== "confirmed") {
        skipped++;
        continue;
      }
      const before = JSON.stringify({ status: record.status });
      updateStmt.run(id);
      const after = JSON.stringify({ status: "withdrawn" });
      logStmt.run(crypto.randomUUID(), id, before, after, reason);
      success++;
    }
  });

  tx();
  return { success, skipped };
}

export function getDashboardStats(): DashboardStats {
  const pendingRow = db
    .prepare("SELECT COALESCE(SUM(amount), 0) as amount, COUNT(*) as cnt FROM settlement_records WHERE status = 'pending'")
    .get() as { amount: number; cnt: number };

  const confirmedRow = db
    .prepare("SELECT COALESCE(SUM(amount), 0) as amount, COUNT(*) as cnt FROM settlement_records WHERE status = 'confirmed'")
    .get() as { amount: number; cnt: number };

  const totalRow = db
    .prepare("SELECT COALESCE(SUM(amount), 0) as amount, COUNT(*) as cnt FROM settlement_records")
    .get() as { amount: number; cnt: number };

  const crossPeriodRow = db
    .prepare("SELECT COALESCE(SUM(handling_fee), 0) as fee, COUNT(*) as cnt FROM settlement_records WHERE handling_fee_period <> settlement_period AND handling_fee_period <> ''")
    .get() as { fee: number; cnt: number };

  const recentImports = db
    .prepare("SELECT * FROM import_sessions ORDER BY created_at DESC LIMIT 5")
    .all() as ImportSession[];

  return {
    pending_amount: pendingRow.amount,
    pending_count: pendingRow.cnt,
    cross_period_fee: crossPeriodRow.fee,
    cross_period_count: crossPeriodRow.cnt,
    confirmed_amount: confirmedRow.amount,
    confirmed_count: confirmedRow.cnt,
    total_amount: totalRow.amount,
    total_count: totalRow.cnt,
    recent_imports: recentImports,
  };
}
