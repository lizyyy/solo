const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const AlternativePart = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO alternative_parts (id, original_part_id, alternative_part_id, compatibility_status, limit_equipment_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.originalPartId, data.alternativePartId, data.compatibilityStatus, data.limitEquipmentIds ? JSON.stringify(data.limitEquipmentIds) : null, now);
    return id;
  },

  findAlternatives: (partId) => db.prepare(`
    SELECT ap.*, sp.code as alt_code, sp.name as alt_name, sp.current_stock as alt_stock
    FROM alternative_parts ap
    JOIN spare_parts sp ON ap.alternative_part_id = sp.id
    WHERE ap.original_part_id = ?
  `).all(partId),

  findCompatibleForEquipment: (partId, equipmentId) => {
    const alternatives = AlternativePart.findAlternatives(partId);
    return alternatives.filter(alt => {
      if (alt.limit_equipment_ids) {
        const limitedIds = JSON.parse(alt.limit_equipment_ids);
        return limitedIds.includes(equipmentId) || alt.compatibility_status === 'COMPATIBLE';
      }
      return true;
    });
  }
};

module.exports = AlternativePart;
