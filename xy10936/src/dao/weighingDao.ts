import { run, get, all } from '../database/db';
import { WeighingRecord, WeightVerification, ManualCorrection } from '../types';

export const createWeighingRecord = async (record: WeighingRecord): Promise<number> => {
  const sql = `INSERT INTO weighing_records (record_no, customer_id, category_id, gross_weight, tare_weight, net_weight, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  return run(sql, [
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

export const getWeighingRecordById = async (id: number): Promise<WeighingRecord | undefined> => {
  const sql = `SELECT * FROM weighing_records WHERE id = ?`;
  return get<WeighingRecord>(sql, [id]);
};

export const getWeighingRecordByNo = async (recordNo: string): Promise<WeighingRecord | undefined> => {
  const sql = `SELECT * FROM weighing_records WHERE record_no = ?`;
  return get<WeighingRecord>(sql, [recordNo]);
};

export const getWeighingRecordsByCustomer = async (customerId: number): Promise<WeighingRecord[]> => {
  const sql = `SELECT * FROM weighing_records WHERE customer_id = ? ORDER BY created_at DESC`;
  return all<WeighingRecord>(sql, [customerId]);
};

export const getWeighingRecordsByStatus = async (status: string): Promise<WeighingRecord[]> => {
  const sql = `SELECT * FROM weighing_records WHERE status = ? ORDER BY created_at DESC`;
  return all<WeighingRecord>(sql, [status]);
};

export const getAllWeighingRecords = async (): Promise<WeighingRecord[]> => {
  const sql = `SELECT * FROM weighing_records ORDER BY created_at DESC`;
  return all<WeighingRecord>(sql);
};

export const updateWeighingRecordStatus = async (id: number, status: string, extraData: Partial<WeighingRecord> = {}): Promise<void> => {
  const sql = `UPDATE weighing_records SET status = ?, price_version_id = ?, deduction_ratio = ?, confirmed_time = ?, settled_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await run(sql, [
    status,
    extraData.price_version_id || null,
    extraData.deduction_ratio || null,
    extraData.confirmed_time || null,
    extraData.settled_time || null,
    id
  ]);
};

export const updateWeighingRecord = async (id: number, data: Partial<WeighingRecord>): Promise<void> => {
  const sql = `UPDATE weighing_records SET gross_weight = ?, tare_weight = ?, net_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await run(sql, [data.gross_weight, data.tare_weight, data.net_weight || null, id]);
};

export const createWeightVerification = async (verification: WeightVerification): Promise<number> => {
  const sql = `INSERT INTO weight_verifications (weighing_record_id, gross_weight, tare_weight, verifier, remark) VALUES (?, ?, ?, ?, ?)`;
  return run(sql, [
    verification.weighing_record_id,
    verification.gross_weight,
    verification.tare_weight,
    verification.verifier,
    verification.remark || null
  ]);
};

export const getVerificationsByRecordId = async (recordId: number): Promise<WeightVerification[]> => {
  const sql = `SELECT * FROM weight_verifications WHERE weighing_record_id = ? ORDER BY verification_time DESC`;
  return all<WeightVerification>(sql, [recordId]);
};

export const createManualCorrection = async (correction: ManualCorrection): Promise<number> => {
  const sql = `INSERT INTO manual_corrections (weighing_record_id, field_name, old_value, new_value, reason, operator) VALUES (?, ?, ?, ?, ?, ?)`;
  return run(sql, [
    correction.weighing_record_id,
    correction.field_name,
    correction.old_value || null,
    correction.new_value || null,
    correction.reason,
    correction.operator
  ]);
};

export const getCorrectionsByRecordId = async (recordId: number): Promise<ManualCorrection[]> => {
  const sql = `SELECT * FROM manual_corrections WHERE weighing_record_id = ? ORDER BY created_at DESC`;
  return all<ManualCorrection>(sql, [recordId]);
};

export const getUnsettledRecordsByCustomer = async (customerId: number): Promise<WeighingRecord[]> => {
  const sql = `SELECT * FROM weighing_records WHERE customer_id = ? AND status != 'settled' ORDER BY created_at`;
  return all<WeighingRecord>(sql, [customerId]);
};
