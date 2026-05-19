const { getDb } = require('../db/database');

class ErrorRecord {
  static async create(data, sessionId) {
    const db = getDb();
    const result = await db.run(`
      INSERT INTO error_records (
        session_id, source_type, source_file, row_number,
        raw_content, error_type, error_message, suggestion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      sessionId,
      data.sourceType,
      data.sourceFile,
      data.rowNumber,
      data.rawContent,
      data.errorType,
      data.errorMessage,
      data.suggestion
    );
    return result.lastID;
  }

  static async markResolved(id) {
    const db = getDb();
    const result = await db.run('UPDATE error_records SET resolved = 1 WHERE id = ?', id);
    return result.changes > 0;
  }

  static async getById(id) {
    const db = getDb();
    return await db.get('SELECT * FROM error_records WHERE id = ?', id);
  }

  static async filter(options = {}) {
    const db = getDb();
    let query = 'SELECT * FROM error_records WHERE 1=1';
    const params = [];

    if (options.resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(options.resolved ? 1 : 0);
    }

    if (options.sourceType) {
      query += ' AND source_type = ?';
      params.push(options.sourceType);
    }

    if (options.errorType) {
      query += ' AND error_type = ?';
      params.push(options.errorType);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return await db.all(query, ...params);
  }

  static async getAll(limit = 100) {
    const db = getDb();
    return await db.all('SELECT * FROM error_records ORDER BY created_at DESC LIMIT ?', limit);
  }

  static async getSummary() {
    const db = getDb();
    return await db.all(`
      SELECT 
        source_type,
        error_type,
        resolved,
        COUNT(*) as count
      FROM error_records
      GROUP BY source_type, error_type, resolved
      ORDER BY count DESC
    `);
  }
}

module.exports = ErrorRecord;
