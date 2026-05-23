const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class TrainingService {
  async createTraining(data) {
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO training_status (
        id, personnel_id, training_type, training_date,
        expiry_date, status, score, certificate_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run(
      id,
      data.personnel_id,
      data.training_type,
      data.training_date || null,
      data.expiry_date || null,
      data.status || 'pending',
      data.score || null,
      data.certificate_no || null
    );

    return this.getTrainingById(id);
  }

  async getTrainingById(id) {
    const stmt = db.prepare('SELECT * FROM training_status WHERE id = ?');
    return await stmt.get(id);
  }

  async getTrainingByPersonnel(personnelId) {
    const stmt = db.prepare(`
      SELECT * FROM training_status 
      WHERE personnel_id = ?
      ORDER BY created_at DESC
    `);
    return await stmt.all(personnelId);
  }

  async updateTraining(id, data) {
    const fields = ['training_type', 'training_date', 'expiry_date', 'status', 'score', 'certificate_no'];
    const updateFields = [];
    const values = [];

    fields.forEach(field => {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    if (updateFields.length === 0) {
      return this.getTrainingById(id);
    }

    values.push(id);
    const sql = `UPDATE training_status SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const stmt = db.prepare(sql);
    await stmt.run(...values);

    return this.getTrainingById(id);
  }
}

module.exports = new TrainingService();
