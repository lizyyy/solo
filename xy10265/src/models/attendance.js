const db = require('../db/database');

class AttendanceModel {
  static create({ student_id, attendance_date, status }) {
    const stmt = db.prepare(`
      INSERT INTO attendances (student_id, attendance_date, status)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(student_id, attendance_date, status);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM attendances WHERE id = ?').get(id);
  }

  static findByStudentId(student_id) {
    return db.prepare('SELECT * FROM attendances WHERE student_id = ? ORDER BY attendance_date DESC').all(student_id);
  }

  static getAttendanceScore(student_id) {
    const attendances = this.findByStudentId(student_id);
    if (attendances.length === 0) return { score: 0, total: 0, present: 0, late: 0, absent: 0 };
    
    let present = 0, late = 0, absent = 0;
    attendances.forEach(a => {
      if (a.status === 'present') present++;
      else if (a.status === 'late') late++;
      else if (a.status === 'absent') absent++;
    });
    
    const score = (present + late * 0.5) / attendances.length;
    return { score, total: attendances.length, present, late, absent };
  }

  static batchCreate(student_id, attendances) {
    return attendances.map(a => this.create({ student_id, ...a }));
  }

  static delete(id) {
    return db.prepare('DELETE FROM attendances WHERE id = ?').run(id);
  }
}

module.exports = AttendanceModel;
