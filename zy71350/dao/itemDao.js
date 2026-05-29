const { getDb } = require('./database');
const config = require('../config');

function createItem(itemData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO consignment_items 
    (batch_id, line_no, artwork_no, artist_code, artist_name, 
     exhibition_start_date, exhibition_end_date, transaction_date,
     listed_price, transaction_price, discount_rate, declared_commission_rate,
     raw_data, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    itemData.batch_id,
    itemData.line_no,
    itemData.artwork_no,
    itemData.artist_code,
    itemData.artist_name || '',
    itemData.exhibition_start_date,
    itemData.exhibition_end_date,
    itemData.transaction_date,
    itemData.listed_price,
    itemData.transaction_price,
    itemData.discount_rate || 0,
    itemData.declared_commission_rate || null,
    JSON.stringify(itemData.raw_data || itemData),
    config.STATUS.IMPORTED
  );
  return result.lastInsertRowid;
}

function getItemById(itemId) {
  const db = getDb();
  return db.prepare('SELECT * FROM consignment_items WHERE id = ?').get(itemId);
}

function getItemsByBatch(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM consignment_items 
    WHERE batch_id = ? 
    ORDER BY processing_order IS NULL, processing_order, line_no
  `).all(batchId);
}

function getItemsByBatchWithIssues(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM consignment_items 
    WHERE batch_id = ? AND has_issues = 1
    ORDER BY 
      CASE highest_severity 
        WHEN 'critical' THEN 1 
        WHEN 'warning' THEN 2 
        ELSE 3 
      END,
      line_no
  `).all(batchId);
}

function updateItemValidation(itemId, updates) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE consignment_items 
    SET validation_passed = ?, 
        has_issues = ?, 
        highest_severity = ?,
        status = ?,
        processing_order = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(
    updates.validation_passed ? 1 : 0,
    updates.has_issues ? 1 : 0,
    updates.highest_severity || null,
    updates.status || config.STATUS.PENDING_REVIEW,
    updates.processing_order,
    itemId
  );
}

function updateItemCommission(itemId, commissionRate, commissionAmount, artistAmount, status) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE consignment_items 
    SET final_commission_rate = ?,
        final_commission_amount = ?,
        final_artist_amount = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(commissionRate, commissionAmount, artistAmount, status, itemId);
}

function updateItemStatus(itemId, status) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE consignment_items 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(status, itemId);
}

function getItemsForSettlement(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT ci.*, a.artist_name as artist_name_from_master, a.commission_rate as artist_commission_rate
    FROM consignment_items ci
    LEFT JOIN artists a ON ci.artist_code = a.artist_code
    WHERE ci.batch_id = ? AND ci.status IN ('authorized', 'pending_review')
    ORDER BY ci.line_no
  `).all(batchId);
}

function getItemDetailWithLogs(itemId) {
  const db = getDb();
  const item = db.prepare('SELECT * FROM consignment_items WHERE id = ?').get(itemId);
  if (item) {
    item.logs = db.prepare(`
      SELECT * FROM processing_logs 
      WHERE item_id = ? 
      ORDER BY created_at, id
    `).all(itemId);
    item.authorizations = db.prepare(`
      SELECT * FROM authorization_records 
      WHERE item_id = ? AND is_active = 1
      ORDER BY authorized_at DESC
    `).all(itemId);
    item.artist = db.prepare(`
      SELECT * FROM artists WHERE artist_code = ?
    `).get(item.artist_code);
  }
  return item;
}

module.exports = {
  createItem,
  getItemById,
  getItemsByBatch,
  getItemsByBatchWithIssues,
  updateItemValidation,
  updateItemCommission,
  updateItemStatus,
  getItemsForSettlement,
  getItemDetailWithLogs
};
