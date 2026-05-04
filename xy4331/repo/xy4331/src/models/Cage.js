const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');

class Cage {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.cage_id = data.cage_id;
    this.rack_id = data.rack_id;
    this.position = data.position;
    this.max_capacity = data.max_capacity || 5;
    this.current_occupancy = data.current_occupancy || 0;
    this.status = data.status || 'available';
    this.notes = data.notes;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(data) {
    const cage = new Cage(data);
    const existing = await getAsync(
      'SELECT * FROM cages WHERE cage_id = ?',
      [cage.cage_id]
    );
    
    if (existing) {
      await Cage.update(cage.cage_id, data);
      return await Cage.findByCageId(cage.cage_id);
    }

    await runAsync(
      `INSERT INTO cages (id, cage_id, rack_id, position, max_capacity, current_occupancy, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cage.id, cage.cage_id, cage.rack_id, cage.position, 
       cage.max_capacity, cage.current_occupancy, cage.status, cage.notes]
    );

    return cage;
  }

  static async update(cageId, data) {
    const updates = [];
    const values = [];
    
    const allowedFields = ['rack_id', 'position', 'max_capacity', 'current_occupancy', 'status', 'notes'];
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(cageId);

    await runAsync(
      `UPDATE cages SET ${updates.join(', ')} WHERE cage_id = ?`,
      values
    );
  }

  static async findByCageId(cageId) {
    const row = await getAsync(
      'SELECT * FROM cages WHERE cage_id = ?',
      [cageId]
    );
    return row ? new Cage(row) : null;
  }

  static async findAll(options = {}) {
    const { status, rack_id, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM cages WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (rack_id) {
      sql += ' AND rack_id = ?';
      params.push(rack_id);
    }

    sql += ' ORDER BY rack_id, position LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new Cage(row));
  }

  static async getActiveOccupancy(cageId) {
    const rows = await allAsync(
      `SELECT co.*, a.species, a.strain, a.gender 
       FROM cage_occupancy co
       JOIN animals a ON co.animal_id = a.animal_id
       WHERE co.cage_id = ? AND co.is_active = 1`,
      [cageId]
    );
    return rows;
  }

  static async addOccupancy(cageId, animalId, startDate, reason, transferredBy) {
    const id = uuidv4();
    
    await runAsync(
      `INSERT INTO cage_occupancy (id, animal_id, cage_id, start_date, is_active, transfer_reason, transferred_by)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, animalId, cageId, startDate, reason, transferredBy]
    );

    const currentOccupancy = await getAsync(
      'SELECT COUNT(*) as count FROM cage_occupancy WHERE cage_id = ? AND is_active = 1',
      [cageId]
    );
    
    await Cage.update(cageId, { current_occupancy: currentOccupancy.count });

    return id;
  }

  static async endOccupancy(cageId, animalId, endDate) {
    await runAsync(
      `UPDATE cage_occupancy 
       SET is_active = 0, end_date = ? 
       WHERE cage_id = ? AND animal_id = ? AND is_active = 1`,
      [endDate, cageId, animalId]
    );

    const currentOccupancy = await getAsync(
      'SELECT COUNT(*) as count FROM cage_occupancy WHERE cage_id = ? AND is_active = 1',
      [cageId]
    );
    
    await Cage.update(cageId, { current_occupancy: currentOccupancy.count });
  }
}

module.exports = Cage;
