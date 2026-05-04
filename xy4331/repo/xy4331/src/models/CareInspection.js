const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');

class CareInspection {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.inspection_id = data.inspection_id;
    this.cage_id = data.cage_id;
    this.inspection_date = data.inspection_date;
    this.inspector = data.inspector;
    this.general_condition = data.general_condition;
    this.food_level = data.food_level;
    this.water_level = data.water_level;
    this.bedding_condition = data.bedding_condition;
    this.abnormal_signs = data.abnormal_signs;
    this.actions_taken = data.actions_taken;
    this.status = data.status || 'completed';
    this.notes = data.notes;
    this.created_at = data.created_at;
  }

  static async create(data) {
    const inspection = new CareInspection(data);
    
    if (!inspection.inspection_id) {
      inspection.inspection_id = `INSP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const existing = await getAsync(
      'SELECT * FROM care_inspections WHERE inspection_id = ?',
      [inspection.inspection_id]
    );
    
    if (existing) {
      await CareInspection.update(inspection.inspection_id, data);
      return await CareInspection.findByInspectionId(inspection.inspection_id);
    }

    await runAsync(
      `INSERT INTO care_inspections 
       (id, inspection_id, cage_id, inspection_date, inspector, general_condition,
        food_level, water_level, bedding_condition, abnormal_signs, 
        actions_taken, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [inspection.id, inspection.inspection_id, inspection.cage_id, 
       inspection.inspection_date, inspection.inspector, inspection.general_condition,
       inspection.food_level, inspection.water_level, inspection.bedding_condition,
       inspection.abnormal_signs, inspection.actions_taken, inspection.status, inspection.notes]
    );

    return inspection;
  }

  static async update(inspectionId, data) {
    const updates = [];
    const values = [];
    
    const allowedFields = [
      'cage_id', 'inspection_date', 'inspector', 'general_condition',
      'food_level', 'water_level', 'bedding_condition', 'abnormal_signs',
      'actions_taken', 'status', 'notes'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    values.push(inspectionId);

    await runAsync(
      `UPDATE care_inspections SET ${updates.join(', ')} WHERE inspection_id = ?`,
      values
    );
  }

  static async findByInspectionId(inspectionId) {
    const row = await getAsync(
      'SELECT * FROM care_inspections WHERE inspection_id = ?',
      [inspectionId]
    );
    return row ? new CareInspection(row) : null;
  }

  static async findAll(options = {}) {
    const { cage_id, inspector, status, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM care_inspections WHERE 1=1';
    const params = [];

    if (cage_id) {
      sql += ' AND cage_id = ?';
      params.push(cage_id);
    }
    
    if (inspector) {
      sql += ' AND inspector = ?';
      params.push(inspector);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY inspection_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new CareInspection(row));
  }

  static async getCageInspectionHistory(cageId) {
    const rows = await allAsync(
      `SELECT ci.*, c.rack_id, c.position
       FROM care_inspections ci
       JOIN cages c ON ci.cage_id = c.cage_id
       WHERE ci.cage_id = ?
       ORDER BY ci.inspection_date DESC`,
      [cageId]
    );
    return rows.map(row => new CareInspection(row));
  }

  static async getInspectionsWithAbnormalities() {
    const rows = await allAsync(
      `SELECT ci.*, c.rack_id, c.position,
        (SELECT GROUP_CONCAT(a.animal_id, ', ') 
         FROM cage_occupancy co 
         JOIN animals a ON co.animal_id = a.animal_id 
         WHERE co.cage_id = ci.cage_id AND co.is_active = 1) as animals_in_cage
       FROM care_inspections ci
       JOIN cages c ON ci.cage_id = c.cage_id
       WHERE ci.abnormal_signs IS NOT NULL AND ci.abnormal_signs != ''
       ORDER BY ci.inspection_date DESC`
    );
    return rows.map(row => new CareInspection(row));
  }

  static async getInspectionsByDateRange(startDate, endDate) {
    const rows = await allAsync(
      `SELECT ci.*, c.rack_id, c.position
       FROM care_inspections ci
       JOIN cages c ON ci.cage_id = c.cage_id
       WHERE DATE(ci.inspection_date) BETWEEN DATE(?) AND DATE(?)
       ORDER BY ci.inspection_date ASC`,
      [startDate, endDate]
    );
    return rows.map(row => new CareInspection(row));
  }

  static async getRecentInspections(limit = 20) {
    const rows = await allAsync(
      `SELECT ci.*, c.rack_id, c.position
       FROM care_inspections ci
       JOIN cages c ON ci.cage_id = c.cage_id
       ORDER BY ci.inspection_date DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(row => new CareInspection(row));
  }
}

module.exports = CareInspection;
