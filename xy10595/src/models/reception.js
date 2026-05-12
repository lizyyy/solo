const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { RECEPTION_STATUS } = require('../utils/constants');

const Reception = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    const code = data.code || `REC${Date.now()}`;
    db.prepare(`
      INSERT INTO receptions (
        id, code, requester, equipment_id, part_id,
        requested_quantity, actual_quantity, used_alternative_part_id,
        status, current_step, idempotent_key, callback_count, last_callback_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, code, data.requester || null, data.equipmentId || null, data.partId,
      data.requestedQuantity, 0, null,
      RECEPTION_STATUS.PENDING, 'CREATE', data.idempotentKey || null, 0, null,
      now, now
    );
    return id;
  },

  findById: (id) => db.prepare('SELECT * FROM receptions WHERE id = ?').get(id),

  findByCode: (code) => db.prepare('SELECT * FROM receptions WHERE code = ?').get(code),

  findByIdempotentKey: (key) => db.prepare('SELECT * FROM receptions WHERE idempotent_key = ?').get(key),

  findAll: () => db.prepare('SELECT * FROM receptions ORDER BY created_at DESC').all(),

  findByStatus: (status) => db.prepare('SELECT * FROM receptions WHERE status = ? ORDER BY created_at DESC').all(status),

  update: (id, data) => {
    const now = Date.now();
    const fields = [];
    const params = [];
    if (data.requester !== undefined) { fields.push('requester = ?'); params.push(data.requester); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.currentStep !== undefined) { fields.push('current_step = ?'); params.push(data.currentStep); }
    if (data.actualQuantity !== undefined) { fields.push('actual_quantity = ?'); params.push(data.actualQuantity); }
    if (data.usedAlternativePartId !== undefined) { fields.push('used_alternative_part_id = ?'); params.push(data.usedAlternativePartId); }
    if (data.callbackCount !== undefined) { fields.push('callback_count = ?'); params.push(data.callbackCount); }
    if (data.lastCallbackAt !== undefined) { fields.push('last_callback_at = ?'); params.push(data.lastCallbackAt); }
    fields.push('updated_at = ?');
    params.push(now, id);
    db.prepare(`UPDATE receptions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  },

  addHistory: (receptionId, fromStatus, toStatus, operator, reason) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO reception_status_history (id, reception_id, from_status, to_status, operator, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, receptionId, fromStatus || null, toStatus, operator || null, reason || null, now);
    return id;
  },

  getHistory: (receptionId) => db.prepare(`
    SELECT * FROM reception_status_history
    WHERE reception_id = ?
    ORDER BY created_at ASC
  `).all(receptionId)
};

module.exports = Reception;
