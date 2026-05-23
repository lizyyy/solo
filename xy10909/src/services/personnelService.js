const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class PersonnelService {
  async createPersonnel(data) {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO personnel (
        id, employee_id, name, id_card, phone, department, position, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.run(
      id,
      data.employee_id,
      data.name,
      data.id_card,
      data.phone || null,
      data.department || null,
      data.position || null,
      data.status || 'active'
    );
    
    return this.getPersonnelById(id);
  }

  async getPersonnelById(id) {
    const stmt = db.prepare('SELECT * FROM personnel WHERE id = ?');
    return await stmt.get(id);
  }

  async getPersonnelByIdCard(idCard) {
    const stmt = db.prepare('SELECT * FROM personnel WHERE id_card = ?');
    return await stmt.get(idCard);
  }

  async getPersonnel(filters = {}) {
    let sql = 'SELECT * FROM personnel WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.department) {
      sql += ' AND department = ?';
      params.push(filters.department);
    }

    if (filters.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${filters.name}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50);
    params.push(filters.offset || 0);

    const stmt = db.prepare(sql);
    return await stmt.all(...params);
  }

  async updatePersonnel(id, data) {
    const fields = ['employee_id', 'name', 'id_card', 'phone', 'department', 'position', 'status'];
    const updateFields = [];
    const values = [];

    fields.forEach(field => {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    if (updateFields.length === 0) {
      return this.getPersonnelById(id);
    }

    values.push(id);
    const sql = `UPDATE personnel SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const stmt = db.prepare(sql);
    await stmt.run(...values);

    return this.getPersonnelById(id);
  }

  async getPersonnelWithDetails(id) {
    const personnel = await this.getPersonnelById(id);
    if (!personnel) return null;

    const trainingStmt = db.prepare(`
      SELECT * FROM training_status 
      WHERE personnel_id = ?
      ORDER BY created_at DESC
    `);
    personnel.training_records = await trainingStmt.all(id);

    const blacklistStmt = db.prepare(`
      SELECT * FROM blacklist 
      WHERE personnel_id = ? OR id_card = ?
    `);
    personnel.blacklist_records = await blacklistStmt.all(id, personnel.id_card);

    const eventStmt = db.prepare(`
      SELECT * FROM gate_events 
      WHERE personnel_id = ?
      ORDER BY event_time DESC LIMIT 20
    `);
    personnel.recent_events = await eventStmt.all(id);

    return personnel;
  }
}

module.exports = new PersonnelService();
