const { run, all } = require('../config/dbUtils');

class ExceptionLog {
  static async create(data) {
    const result = await run(
      `INSERT INTO exception_logs 
       (exception_type, raw_input, error_message, processing_result, api_path)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.exception_type,
        data.raw_input ? JSON.stringify(data.raw_input) : null,
        data.error_message || null,
        data.processing_result || null,
        data.api_path || null
      ]
    );
    return result.lastID;
  }

  static async list(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return await all(
      `SELECT * FROM exception_logs 
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );
  }
}

module.exports = ExceptionLog;
