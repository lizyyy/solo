const { getDb } = require('./database');

function createAuthorization(authData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO authorization_records 
    (item_id, auth_type, auth_field, original_value, requested_value, 
     authorized_value, reason, authorized_by, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    authData.item_id,
    authData.auth_type,
    authData.auth_field,
    authData.original_value,
    authData.requested_value,
    authData.authorized_value,
    authData.reason,
    authData.authorized_by,
    authData.expires_at || null
  );
  return result.lastInsertRowid;
}

function getAuthorizationById(authId) {
  const db = getDb();
  return db.prepare('SELECT * FROM authorization_records WHERE id = ?').get(authId);
}

function getAuthorizationsByItem(itemId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM authorization_records 
    WHERE item_id = ? AND is_active = 1
    ORDER BY authorized_at DESC
  `).all(itemId);
}

function getAuthorizationsByBatch(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT ar.*, ci.artwork_no, ci.artist_code
    FROM authorization_records ar
    JOIN consignment_items ci ON ar.item_id = ci.id
    WHERE ci.batch_id = ? AND ar.is_active = 1
    ORDER BY ar.authorized_at DESC
  `).all(batchId);
}

function getActiveAuthorization(itemId, authField) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM authorization_records 
    WHERE item_id = ? AND auth_field = ? AND is_active = 1
    ORDER BY authorized_at DESC
    LIMIT 1
  `).get(itemId, authField);
}

function revokeAuthorization(authId, reason) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE authorization_records 
    SET is_active = 0, reason = reason || ' | 已撤销: ' || ?
    WHERE id = ?
  `);
  return stmt.run(reason, authId);
}

module.exports = {
  createAuthorization,
  getAuthorizationById,
  getAuthorizationsByItem,
  getAuthorizationsByBatch,
  getActiveAuthorization,
  revokeAuthorization
};
