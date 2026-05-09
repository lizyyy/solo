const db = require('../db/database');

class DecisionModel {
  static create({ student_id, evaluation_id, decision, comment }) {
    const stmt = db.prepare(`
      INSERT INTO decisions (student_id, evaluation_id, decision, comment)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(student_id, evaluation_id, decision, comment || null);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM decisions WHERE id = ?').get(id);
  }

  static findByStudentId(student_id) {
    return db.prepare('SELECT * FROM decisions WHERE student_id = ? ORDER BY id DESC').all(student_id);
  }

  static findByEvaluationId(evaluation_id) {
    return db.prepare('SELECT * FROM decisions WHERE evaluation_id = ?').get(evaluation_id);
  }
}

module.exports = DecisionModel;
