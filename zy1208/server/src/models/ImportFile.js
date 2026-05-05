const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class ImportFile {
  static create(drillId, fileType, fileName, filePath, fileSize) {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO import_files (id, drill_id, file_type, file_name, file_path, file_size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, drillId, fileType, fileName, filePath, fileSize);
    
    return this.findById(id);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM import_files WHERE id = ?');
    return stmt.get(id);
  }

  static findByDrillId(drillId) {
    const stmt = db.prepare('SELECT * FROM import_files WHERE drill_id = ? ORDER BY uploaded_at ASC');
    return stmt.all(drillId);
  }

  static findByDrillIdAndType(drillId, fileType) {
    const stmt = db.prepare(`
      SELECT * FROM import_files 
      WHERE drill_id = ? AND file_type = ? 
      ORDER BY uploaded_at DESC 
      LIMIT 1
    `);
    return stmt.get(drillId, fileType);
  }

  static deleteByDrillId(drillId) {
    const stmt = db.prepare('DELETE FROM import_files WHERE drill_id = ?');
    return stmt.run(drillId);
  }
}

module.exports = ImportFile;
