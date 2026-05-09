const db = require('../db/database');

class StudentModel {
  static create({ name, current_level, join_date }) {
    const stmt = db.prepare(`
      INSERT INTO students (name, current_level, join_date)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(name, current_level, join_date);
    return this.findById(result.lastInsertRowid);
  }

  static update(id, { name, current_level, join_date, status }) {
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (current_level !== undefined) { fields.push('current_level = ?'); values.push(current_level); }
    if (join_date !== undefined) { fields.push('join_date = ?'); values.push(join_date); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static updateEvaluationStatus(id, evaluation_status) {
    db.prepare('UPDATE students SET evaluation_status = ? WHERE id = ?').run(evaluation_status, id);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  }

  static findAll() {
    return db.prepare('SELECT * FROM students ORDER BY id DESC').all();
  }

  static delete(id) {
    return db.prepare('DELETE FROM students WHERE id = ?').run(id);
  }
}

module.exports = StudentModel;
