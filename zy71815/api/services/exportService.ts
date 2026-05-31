import db from "../db.js";
import xlsx from "xlsx";
import type { SettlementFilter, SettlementRecord } from "../../shared/types.js";
import { buildFilterSummary } from "./settlementService.js";

interface ExportOptions {
  filter: SettlementFilter;
  export_scope: "filtered" | "selected";
  selected_ids?: string[];
  include_reconciliation_note: boolean;
}

function getFilteredRecords(filter: SettlementFilter): SettlementRecord[] {
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM settlement_records ${where} ORDER BY created_at DESC`)
    .all(...params) as SettlementRecord[];
}

function getSelectedRecords(ids: string[]): SettlementRecord[] {
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM settlement_records WHERE id IN (${placeholders}) ORDER BY created_at DESC`)
    .all(...ids) as SettlementRecord[];
}

export function generateExport(options: ExportOptions): Buffer {
  let records: SettlementRecord[];

  if (options.export_scope === "selected" && options.selected_ids && options.selected_ids.length > 0) {
    records = getSelectedRecords(options.selected_ids);
  } else {
    records = getFilteredRecords(options.filter);
  }

  const statusMap: Record<string, string> = {
    pending: "待确认",
    confirmed: "已确认",
    withdrawn: "已撤回",
    conflict: "冲突",
  };

  const dataRows = records.map((r) => ({
    门店名称: r.store_name,
    活动名称: r.activity_name,
    结算期间: r.settlement_period,
    流水号: r.serial_number,
    金额: r.amount,
    手续费: r.handling_fee,
    手续费期间: r.handling_fee_period,
    状态: statusMap[r.status] || r.status,
    创建时间: r.created_at,
    更新时间: r.updated_at,
  }));

  const workbook = xlsx.utils.book_new();
  const dataSheet = xlsx.utils.json_to_sheet(dataRows);
  xlsx.utils.book_append_sheet(workbook, dataSheet, "结算明细");

  if (options.include_reconciliation_note) {
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const totalCount = records.length;
    const filterSummary = buildFilterSummary(options.filter);
    const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    const dateRange =
      options.filter.settlement_period_start || options.filter.settlement_period_end
        ? `${options.filter.settlement_period_start || "起始"} ~ ${options.filter.settlement_period_end || "至今"}`
        : "全部期间";

    const noteRows = [
      { 项目: "对账说明", 内容: "" },
      { 项目: "筛选条件", 内容: filterSummary },
      { 项目: "结算期间范围", 内容: dateRange },
      { 项目: "记录总数", 内容: `${totalCount} 条` },
      { 项目: "金额合计", 内容: `${totalAmount.toFixed(2)} 元` },
      { 项目: "生成时间", 内容: now },
    ];

    const noteSheet = xlsx.utils.json_to_sheet(noteRows);
    xlsx.utils.book_append_sheet(workbook, noteSheet, "对账说明");
  }

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buffer;
}
