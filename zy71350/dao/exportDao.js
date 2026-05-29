const { getDb } = require('./database');

function createExportRecord(exportData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO settlement_exports 
    (batch_id, export_type, file_path, file_name, record_count, 
     total_commission, total_artist_amount, exported_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    exportData.batch_id,
    exportData.export_type,
    exportData.file_path,
    exportData.file_name,
    exportData.record_count,
    exportData.total_commission,
    exportData.total_artist_amount,
    exportData.exported_by || 'system'
  );
  return result.lastInsertRowid;
}

function getExportById(exportId) {
  const db = getDb();
  return db.prepare('SELECT * FROM settlement_exports WHERE id = ?').get(exportId);
}

function getExportsByBatch(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM settlement_exports 
    WHERE batch_id = ? 
    ORDER BY created_at DESC
  `).all(batchId);
}

function listAllExports(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT se.*, cb.batch_no, cb.settlement_month
    FROM settlement_exports se
    JOIN consignment_batches cb ON se.batch_id = cb.id
    ORDER BY se.created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  createExportRecord,
  getExportById,
  getExportsByBatch,
  listAllExports
};
