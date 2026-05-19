const db = require('../config/database');

class ReviewerModel {
  static createReviewer(data) {
    return new Promise((resolve, reject) => {
      const { id, name, email, department } = data;
      db.run(
        `INSERT INTO reviewers (id, name, email, department) VALUES (?, ?, ?, ?)`,
        [id, name, email, department],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static getReviewerById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM reviewers WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAllActiveReviewers() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM reviewers WHERE is_active = 1 ORDER BY workload ASC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static incrementWorkload(id) {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE reviewers SET workload = workload + 1 WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static decrementWorkload(id) {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE reviewers SET workload = workload - 1 WHERE id = ? AND workload > 0`, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }
}

module.exports = ReviewerModel;
