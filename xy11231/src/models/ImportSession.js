const { getDb } = require('../db/database');

class ImportSession {
  static async create(sourceType, sourceFile) {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO import_sessions (source_type, source_file) VALUES (?, ?)',
      sourceType, sourceFile
    );
    return result.lastID;
  }

  static async updateStats(id, total, success, error) {
    const db = getDb();
    await db.run(
      'UPDATE import_sessions SET total_records = ?, success_count = ?, error_count = ? WHERE id = ?',
      total, success, error, id
    );
  }

  static async getById(id) {
    const db = getDb();
    return await db.get('SELECT * FROM import_sessions WHERE id = ?', id);
  }

  static async getAll() {
    const db = getDb();
    return await db.all('SELECT * FROM import_sessions ORDER BY imported_at DESC');
  }
}

module.exports = ImportSession;
