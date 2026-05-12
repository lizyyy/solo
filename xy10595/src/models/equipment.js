const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Equipment = {
  create: (data) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO equipment (id, code, name, criticality, department, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.code, data.name, data.criticality, data.department || null, now);
    return id;
  },

  findAll: () => db.prepare('SELECT * FROM equipment').all(),

  findById: (id) => db.prepare('SELECT * FROM equipment WHERE id = ?').get(id),

  findByCriticality: (criticality) => db.prepare('SELECT * FROM equipment WHERE criticality = ?').all(),

  linkPart: (equipmentId, partId, isMainPart = 1) => {
    const id = uuidv4();
    const now = Date.now();
    db.prepare(`
      INSERT INTO equipment_parts (id, equipment_id, part_id, is_main_part, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, equipmentId, partId, isMainPart ? 1 : 0, now);
    return id;
  },

  getParts: (equipmentId) => db.prepare(`
    SELECT sp.*, ep.is_main_part
    FROM spare_parts sp
    JOIN equipment_parts ep ON sp.id = ep.part_id
    WHERE ep.equipment_id = ?
  `).all(equipmentId),

  getByPart: (partId) => db.prepare(`
    SELECT e.*, ep.is_main_part
    FROM equipment e
    JOIN equipment_parts ep ON e.id = ep.equipment_id
    WHERE ep.part_id = ?
  `).all(partId)
};

module.exports = Equipment;
