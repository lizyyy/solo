"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnsettledRecordsByCustomer = exports.getCorrectionsByRecordId = exports.createManualCorrection = exports.getVerificationsByRecordId = exports.createWeightVerification = exports.updateWeighingRecord = exports.updateWeighingRecordStatus = exports.getAllWeighingRecords = exports.getWeighingRecordsByStatus = exports.getWeighingRecordsByCustomer = exports.getWeighingRecordByNo = exports.getWeighingRecordById = exports.createWeighingRecord = void 0;
const db_1 = require("../database/db");
const createWeighingRecord = async (record) => {
    const sql = `INSERT INTO weighing_records (record_no, customer_id, category_id, gross_weight, tare_weight, net_weight, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [
        record.record_no,
        record.customer_id,
        record.category_id,
        record.gross_weight,
        record.tare_weight,
        record.net_weight || null,
        record.status || 'pending',
        record.operator || null
    ]);
};
exports.createWeighingRecord = createWeighingRecord;
const getWeighingRecordById = async (id) => {
    const sql = `SELECT * FROM weighing_records WHERE id = ?`;
    return (0, db_1.get)(sql, [id]);
};
exports.getWeighingRecordById = getWeighingRecordById;
const getWeighingRecordByNo = async (recordNo) => {
    const sql = `SELECT * FROM weighing_records WHERE record_no = ?`;
    return (0, db_1.get)(sql, [recordNo]);
};
exports.getWeighingRecordByNo = getWeighingRecordByNo;
const getWeighingRecordsByCustomer = async (customerId) => {
    const sql = `SELECT * FROM weighing_records WHERE customer_id = ? ORDER BY created_at DESC`;
    return (0, db_1.all)(sql, [customerId]);
};
exports.getWeighingRecordsByCustomer = getWeighingRecordsByCustomer;
const getWeighingRecordsByStatus = async (status) => {
    const sql = `SELECT * FROM weighing_records WHERE status = ? ORDER BY created_at DESC`;
    return (0, db_1.all)(sql, [status]);
};
exports.getWeighingRecordsByStatus = getWeighingRecordsByStatus;
const getAllWeighingRecords = async () => {
    const sql = `SELECT * FROM weighing_records ORDER BY created_at DESC`;
    return (0, db_1.all)(sql);
};
exports.getAllWeighingRecords = getAllWeighingRecords;
const updateWeighingRecordStatus = async (id, status, extraData = {}) => {
    const sql = `UPDATE weighing_records SET status = ?, price_version_id = ?, deduction_ratio = ?, confirmed_time = ?, settled_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await (0, db_1.run)(sql, [
        status,
        extraData.price_version_id || null,
        extraData.deduction_ratio || null,
        extraData.confirmed_time || null,
        extraData.settled_time || null,
        id
    ]);
};
exports.updateWeighingRecordStatus = updateWeighingRecordStatus;
const updateWeighingRecord = async (id, data) => {
    const sql = `UPDATE weighing_records SET gross_weight = ?, tare_weight = ?, net_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await (0, db_1.run)(sql, [data.gross_weight, data.tare_weight, data.net_weight || null, id]);
};
exports.updateWeighingRecord = updateWeighingRecord;
const createWeightVerification = async (verification) => {
    const sql = `INSERT INTO weight_verifications (weighing_record_id, gross_weight, tare_weight, verifier, remark) VALUES (?, ?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [
        verification.weighing_record_id,
        verification.gross_weight,
        verification.tare_weight,
        verification.verifier,
        verification.remark || null
    ]);
};
exports.createWeightVerification = createWeightVerification;
const getVerificationsByRecordId = async (recordId) => {
    const sql = `SELECT * FROM weight_verifications WHERE weighing_record_id = ? ORDER BY verification_time DESC`;
    return (0, db_1.all)(sql, [recordId]);
};
exports.getVerificationsByRecordId = getVerificationsByRecordId;
const createManualCorrection = async (correction) => {
    const sql = `INSERT INTO manual_corrections (weighing_record_id, field_name, old_value, new_value, reason, operator) VALUES (?, ?, ?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [
        correction.weighing_record_id,
        correction.field_name,
        correction.old_value || null,
        correction.new_value || null,
        correction.reason,
        correction.operator
    ]);
};
exports.createManualCorrection = createManualCorrection;
const getCorrectionsByRecordId = async (recordId) => {
    const sql = `SELECT * FROM manual_corrections WHERE weighing_record_id = ? ORDER BY created_at DESC`;
    return (0, db_1.all)(sql, [recordId]);
};
exports.getCorrectionsByRecordId = getCorrectionsByRecordId;
const getUnsettledRecordsByCustomer = async (customerId) => {
    const sql = `SELECT * FROM weighing_records WHERE customer_id = ? AND status != 'settled' ORDER BY created_at`;
    return (0, db_1.all)(sql, [customerId]);
};
exports.getUnsettledRecordsByCustomer = getUnsettledRecordsByCustomer;
