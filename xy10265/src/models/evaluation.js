const db = require('../db/database');

class EvaluationModel {
  static create({ student_id, win_rate, attendance_score, teacher_tags, overall_score, recommendation, reason }) {
    const stmt = db.prepare(`
      INSERT INTO evaluations (student_id, win_rate, attendance_score, teacher_tags, overall_score, recommendation, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      student_id,
      win_rate,
      attendance_score,
      JSON.stringify(teacher_tags),
      overall_score,
      recommendation,
      reason
    );
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const eval = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
    if (eval) eval.teacher_tags = JSON.parse(eval.teacher_tags);
    return eval;
  }

  static findByStudentId(student_id) {
    const evals = db.prepare('SELECT * FROM evaluations WHERE student_id = ? ORDER BY id DESC').all(student_id);
    evals.forEach(e => e.teacher_tags = JSON.parse(e.teacher_tags));
    return evals;
  }

  static findLatestByStudentId(student_id) {
    const eval = db.prepare('SELECT * FROM evaluations WHERE student_id = ? ORDER BY id DESC LIMIT 1').get(student_id);
    if (eval) eval.teacher_tags = JSON.parse(eval.teacher_tags);
    return eval;
  }
}

module.exports = EvaluationModel;
