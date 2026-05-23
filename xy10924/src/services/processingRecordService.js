const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');

class ProcessingRecordService {
  async createRecord(operationType, referenceId, referenceType, inputData, processingResult, status, errorMessage, operator) {
    const id = uuidv4();
    const inputDataJson = inputData ? JSON.stringify(inputData) : null;
    const processingResultJson = processingResult ? JSON.stringify(processingResult) : null;

    await runAsync(
      `INSERT INTO processing_records (id, operation_type, reference_id, reference_type, input_data, processing_result, status, error_message, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, operationType, referenceId, referenceType, inputDataJson, processingResultJson, status, errorMessage, operator]
    );

    return id;
  }

  async getRecord(id) {
    const record = await getAsync('SELECT * FROM processing_records WHERE id = ?', [id]);
    if (record) {
      if (record.input_data) record.input_data = JSON.parse(record.input_data);
      if (record.processing_result) record.processing_result = JSON.parse(record.processing_result);
    }
    return record;
  }

  async getRecordsByReference(referenceId, referenceType) {
    const records = await allAsync(
      'SELECT * FROM processing_records WHERE reference_id = ? AND reference_type = ? ORDER BY created_at DESC',
      [referenceId, referenceType]
    );
    return records.map(r => {
      if (r.input_data) r.input_data = JSON.parse(r.input_data);
      if (r.processing_result) r.processing_result = JSON.parse(r.processing_result);
      return r;
    });
  }

  async getAllRecords(filters = {}) {
    let sql = 'SELECT * FROM processing_records WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.operation_type) {
      sql += ' AND operation_type = ?';
      params.push(filters.operation_type);
    }

    sql += ' ORDER BY created_at DESC';

    const records = await allAsync(sql, params);
    return records.map(r => {
      if (r.input_data) r.input_data = JSON.parse(r.input_data);
      if (r.processing_result) r.processing_result = JSON.parse(r.processing_result);
      return r;
    });
  }
}

module.exports = new ProcessingRecordService();
