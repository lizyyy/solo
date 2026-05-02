const db = require('../config/database');

const Handover = {
  create: (handoverData) => {
    return new Promise((resolve, reject) => {
      const { handover_code, from_operator, to_operator, status, notes } = handoverData;
      db.run(
        `INSERT INTO handovers (handover_code, from_operator, to_operator, status, notes) VALUES (?, ?, ?, ?, ?)`,
        [handover_code, from_operator, to_operator, status || 'pending', notes],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...handoverData });
          }
        }
      );
    });
  },

  findByCode: (handoverCode) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM handovers WHERE handover_code = ?`,
        [handoverCode],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM handovers WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM handovers ORDER BY created_at DESC`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  getByStatus: (status) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM handovers WHERE status = ? ORDER BY created_at DESC`,
        [status],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  updateStatus: (id, status, completedAt) => {
    return new Promise((resolve, reject) => {
      if (completedAt) {
        db.run(
          `UPDATE handovers SET status = ?, completed_at = ? WHERE id = ?`,
          [status, completedAt, id],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ changes: this.changes });
            }
          }
        );
      } else {
        db.run(
          `UPDATE handovers SET status = ? WHERE id = ?`,
          [status, id],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ changes: this.changes });
            }
          }
        );
      }
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM handovers WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = Handover;
