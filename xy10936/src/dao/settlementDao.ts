import { run, get, all } from '../database/db';
import { SettlementReport, SettlementItem, ExceptionRecord } from '../types';

export const createSettlementReport = async (report: SettlementReport): Promise<number> => {
  const sql = `INSERT INTO settlement_reports (report_no, customer_id, start_date, end_date, total_amount, status, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  return run(sql, [
    report.report_no,
    report.customer_id,
    report.start_date,
    report.end_date,
    report.total_amount,
    report.status || 'draft',
    report.generated_by || null
  ]);
};

export const getSettlementReportById = async (id: number): Promise<SettlementReport | undefined> => {
  const sql = `SELECT * FROM settlement_reports WHERE id = ?`;
  return get<SettlementReport>(sql, [id]);
};

export const getSettlementReportByNo = async (reportNo: string): Promise<SettlementReport | undefined> => {
  const sql = `SELECT * FROM settlement_reports WHERE report_no = ?`;
  return get<SettlementReport>(sql, [reportNo]);
};

export const getSettlementReportsByCustomer = async (customerId: number): Promise<SettlementReport[]> => {
  const sql = `SELECT * FROM settlement_reports WHERE customer_id = ? ORDER BY generated_at DESC`;
  return all<SettlementReport>(sql, [customerId]);
};

export const getAllSettlementReports = async (): Promise<SettlementReport[]> => {
  const sql = `SELECT * FROM settlement_reports ORDER BY generated_at DESC`;
  return all<SettlementReport>(sql);
};

export const updateSettlementReportStatus = async (id: number, status: string): Promise<void> => {
  const sql = `UPDATE settlement_reports SET status = ?, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await run(sql, [status, id]);
};

export const createSettlementItem = async (item: SettlementItem): Promise<number> => {
  const sql = `INSERT INTO settlement_items (report_id, weighing_record_id, net_weight, unit_price, amount) VALUES (?, ?, ?, ?, ?)`;
  return run(sql, [item.report_id, item.weighing_record_id, item.net_weight, item.unit_price, item.amount]);
};

export const getSettlementItemsByReportId = async (reportId: number): Promise<SettlementItem[]> => {
  const sql = `SELECT * FROM settlement_items WHERE report_id = ?`;
  return all<SettlementItem>(sql, [reportId]);
};

export const isRecordSettled = async (weighingRecordId: number): Promise<boolean> => {
  const sql = `SELECT COUNT(*) as count FROM settlement_items WHERE weighing_record_id = ?`;
  const result = await get<{ count: number }>(sql, [weighingRecordId]);
  return (result?.count || 0) > 0;
};

export const createExceptionRecord = async (exception: ExceptionRecord): Promise<number> => {
  const sql = `INSERT INTO exception_records (record_no, type, original_input, error_message) VALUES (?, ?, ?, ?)`;
  return run(sql, [exception.record_no || null, exception.type, exception.original_input, exception.error_message || null]);
};

export const getExceptionRecordById = async (id: number): Promise<ExceptionRecord | undefined> => {
  const sql = `SELECT * FROM exception_records WHERE id = ?`;
  return get<ExceptionRecord>(sql, [id]);
};

export const getAllExceptionRecords = async (): Promise<ExceptionRecord[]> => {
  const sql = `SELECT * FROM exception_records ORDER BY created_at DESC`;
  return all<ExceptionRecord>(sql);
};

export const getUnhandledExceptions = async (): Promise<ExceptionRecord[]> => {
  const sql = `SELECT * FROM exception_records WHERE handled = 0 ORDER BY created_at DESC`;
  return all<ExceptionRecord>(sql);
};

export const handleException = async (id: number, handledBy: string, conclusion: string): Promise<void> => {
  const sql = `UPDATE exception_records SET handled = 1, handled_by = ?, handled_at = CURRENT_TIMESTAMP, conclusion = ? WHERE id = ?`;
  await run(sql, [handledBy, conclusion, id]);
};
