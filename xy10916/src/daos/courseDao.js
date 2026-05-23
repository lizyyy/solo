const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class CourseDao {
  createCourse(course) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { certificate_type_id, code, name, passing_score } = course;
      db.run(
        `INSERT INTO courses (id, certificate_type_id, code, name, passing_score) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, certificate_type_id, code, name, passing_score || 60],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...course });
        }
      );
    });
  }

  findAllCourses() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT c.*, ct.name as certificate_name
        FROM courses c
        JOIN certificate_types ct ON c.certificate_type_id = ct.id
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  findCoursesByCertificateType(certificateTypeId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT c.*, ct.name as certificate_name
        FROM courses c
        JOIN certificate_types ct ON c.certificate_type_id = ct.id
        WHERE c.certificate_type_id = ?
      `, [certificateTypeId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  createCourseScore(score) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { employee_id, course_id, score: scoreValue, exam_date, is_passed } = score;
      db.run(
        `INSERT INTO course_scores (id, employee_id, course_id, score, exam_date, is_passed) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, employee_id, course_id, scoreValue, exam_date, is_passed],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...score });
        }
      );
    });
  }

  findEmployeeCourseScores(employeeId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT cs.*, c.name as course_name, c.code as course_code
        FROM course_scores cs
        JOIN courses c ON cs.course_id = c.id
        WHERE cs.employee_id = ?
        ORDER BY cs.exam_date DESC
      `, [employeeId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  createRetakeRecord(retake) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { original_score_id, employee_id, course_id, retake_count, score, retake_date, is_passed, status } = retake;
      db.run(
        `INSERT INTO retake_records (id, original_score_id, employee_id, course_id, retake_count, score, retake_date, is_passed, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, original_score_id, employee_id, course_id, retake_count || 1, score, retake_date, is_passed, status || 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...retake });
        }
      );
    });
  }

  updateRetakeRecord(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      db.run(
        `UPDATE retake_records SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  findEmployeeRetakeRecords(employeeId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT rr.*, c.name as course_name
        FROM retake_records rr
        JOIN courses c ON rr.course_id = c.id
        WHERE rr.employee_id = ?
        ORDER BY rr.created_at DESC
      `, [employeeId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  findRetakeById(retakeId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT rr.*, c.name as course_name
        FROM retake_records rr
        JOIN courses c ON rr.course_id = c.id
        WHERE rr.id = ?
      `, [retakeId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  findAllRetakeRecords() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT rr.*, c.name as course_name
        FROM retake_records rr
        JOIN courses c ON rr.course_id = c.id
        ORDER BY rr.created_at DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new CourseDao();
