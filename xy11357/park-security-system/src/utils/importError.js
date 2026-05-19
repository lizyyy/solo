const db = require('./database');
const { generateBatchId, safeStringify } = require('./common');

class ImportErrorRecorder {
  constructor(module, fileName, operator = 'system') {
    this.module = module;
    this.fileName = fileName;
    this.operator = operator;
    this.batchId = generateBatchId();
    this.totalCount = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.errors = [];
  }

  async init() {
    await db.run(
      `INSERT INTO import_records (batch_id, module, file_name, total_count, success_count, fail_count, operator, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.batchId, this.module, this.fileName, 0, 0, 0, this.operator, 'processing']
    );
    return this.batchId;
  }

  addSuccess() {
    this.totalCount++;
    this.successCount++;
  }

  addError(rowNumber, originalData, errorMessage, suggestion = null) {
    this.totalCount++;
    this.failCount++;
    this.errors.push({
      rowNumber,
      originalData: safeStringify(originalData),
      errorMessage,
      suggestion
    });
  }

  async saveErrors() {
    for (const error of this.errors) {
      await db.run(
        `INSERT INTO import_errors (batch_id, row_number, original_data, error_message, suggestion) 
         VALUES (?, ?, ?, ?, ?)`,
        [this.batchId, error.rowNumber, error.originalData, error.errorMessage, error.suggestion]
      );
    }
  }

  async finish(status = 'completed') {
    await this.saveErrors();
    await db.run(
      `UPDATE import_records 
       SET total_count = ?, success_count = ?, fail_count = ?, status = ? 
       WHERE batch_id = ?`,
      [this.totalCount, this.successCount, this.failCount, status, this.batchId]
    );

    return {
      batchId: this.batchId,
      totalCount: this.totalCount,
      successCount: this.successCount,
      failCount: this.failCount
    };
  }

  getSummary() {
    return {
      batchId: this.batchId,
      totalCount: this.totalCount,
      successCount: this.successCount,
      failCount: this.failCount
    };
  }
}

async function getImportRecord(batchId) {
  return await db.get(
    `SELECT * FROM import_records WHERE batch_id = ?`,
    [batchId]
  );
}

async function getImportErrors(batchId) {
  return await db.all(
    `SELECT * FROM import_errors WHERE batch_id = ? ORDER BY row_number`,
    [batchId]
  );
}

async function getImportHistory(module = null, limit = 50) {
  let sql = `SELECT * FROM import_records`;
  const params = [];

  if (module) {
    sql += ` WHERE module = ?`;
    params.push(module);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  return await db.all(sql, params);
}

module.exports = {
  ImportErrorRecorder,
  getImportRecord,
  getImportErrors,
  getImportHistory
};
