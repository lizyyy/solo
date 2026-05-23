"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleException = exports.getUnhandledExceptions = exports.getAllExceptionRecords = exports.getExceptionRecordById = exports.createExceptionRecord = exports.isRecordSettled = exports.getSettlementItemsByReportId = exports.createSettlementItem = exports.updateSettlementReportStatus = exports.getAllSettlementReports = exports.getSettlementReportsByCustomer = exports.getSettlementReportByNo = exports.getSettlementReportById = exports.createSettlementReport = void 0;
const db_1 = require("../database/db");
const createSettlementReport = async (report) => {
    const sql = `INSERT INTO settlement_reports (report_no, customer_id, start_date, end_date, total_amount, status, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [
        report.report_no,
        report.customer_id,
        report.start_date,
        report.end_date,
        report.total_amount,
        report.status || 'draft',
        report.generated_by || null
    ]);
};
exports.createSettlementReport = createSettlementReport;
const getSettlementReportById = async (id) => {
    const sql = `SELECT * FROM settlement_reports WHERE id = ?`;
    return (0, db_1.get)(sql, [id]);
};
exports.getSettlementReportById = getSettlementReportById;
const getSettlementReportByNo = async (reportNo) => {
    const sql = `SELECT * FROM settlement_reports WHERE report_no = ?`;
    return (0, db_1.get)(sql, [reportNo]);
};
exports.getSettlementReportByNo = getSettlementReportByNo;
const getSettlementReportsByCustomer = async (customerId) => {
    const sql = `SELECT * FROM settlement_reports WHERE customer_id = ? ORDER BY generated_at DESC`;
    return (0, db_1.all)(sql, [customerId]);
};
exports.getSettlementReportsByCustomer = getSettlementReportsByCustomer;
const getAllSettlementReports = async () => {
    const sql = `SELECT * FROM settlement_reports ORDER BY generated_at DESC`;
    return (0, db_1.all)(sql);
};
exports.getAllSettlementReports = getAllSettlementReports;
const updateSettlementReportStatus = async (id, status) => {
    const sql = `UPDATE settlement_reports SET status = ?, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await (0, db_1.run)(sql, [status, id]);
};
exports.updateSettlementReportStatus = updateSettlementReportStatus;
const createSettlementItem = async (item) => {
    const sql = `INSERT INTO settlement_items (report_id, weighing_record_id, net_weight, unit_price, amount) VALUES (?, ?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [item.report_id, item.weighing_record_id, item.net_weight, item.unit_price, item.amount]);
};
exports.createSettlementItem = createSettlementItem;
const getSettlementItemsByReportId = async (reportId) => {
    const sql = `SELECT * FROM settlement_items WHERE report_id = ?`;
    return (0, db_1.all)(sql, [reportId]);
};
exports.getSettlementItemsByReportId = getSettlementItemsByReportId;
const isRecordSettled = async (weighingRecordId) => {
    const sql = `SELECT COUNT(*) as count FROM settlement_items WHERE weighing_record_id = ?`;
    const result = await (0, db_1.get)(sql, [weighingRecordId]);
    return (result?.count || 0) > 0;
};
exports.isRecordSettled = isRecordSettled;
const createExceptionRecord = async (exception) => {
    const sql = `INSERT INTO exception_records (record_no, type, original_input, error_message) VALUES (?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [exception.record_no || null, exception.type, exception.original_input, exception.error_message || null]);
};
exports.createExceptionRecord = createExceptionRecord;
const getExceptionRecordById = async (id) => {
    const sql = `SELECT * FROM exception_records WHERE id = ?`;
    return (0, db_1.get)(sql, [id]);
};
exports.getExceptionRecordById = getExceptionRecordById;
const getAllExceptionRecords = async () => {
    const sql = `SELECT * FROM exception_records ORDER BY created_at DESC`;
    return (0, db_1.all)(sql);
};
exports.getAllExceptionRecords = getAllExceptionRecords;
const getUnhandledExceptions = async () => {
    const sql = `SELECT * FROM exception_records WHERE handled = 0 ORDER BY created_at DESC`;
    return (0, db_1.all)(sql);
};
exports.getUnhandledExceptions = getUnhandledExceptions;
const handleException = async (id, handledBy, conclusion) => {
    const sql = `UPDATE exception_records SET handled = 1, handled_by = ?, handled_at = CURRENT_TIMESTAMP, conclusion = ? WHERE id = ?`;
    await (0, db_1.run)(sql, [handledBy, conclusion, id]);
};
exports.handleException = handleException;
