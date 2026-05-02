const db = require('../config/database');

const ColdBox = {
  create: (boxData) => {
    return new Promise((resolve, reject) => {
      const { box_code, description, max_temp, status } = boxData;
      db.run(
        `INSERT INTO cold_boxes (box_code, description, max_temp, status) VALUES (?, ?, ?, ?)`,
        [box_code, description, max_temp || 10, status || 'active'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...boxData });
          }
        }
      );
    });
  },

  findByCode: (boxCode) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM cold_boxes WHERE box_code = ?`,
        [boxCode],
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
        `SELECT * FROM cold_boxes WHERE id = ?`,
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
      db.all(`SELECT * FROM cold_boxes ORDER BY created_at DESC`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  getActive: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM cold_boxes WHERE status = 'active' ORDER BY created_at DESC`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  update: (id, boxData) => {
    return new Promise((resolve, reject) => {
      const { description, max_temp, current_temp, status } = boxData;
      db.run(
        `UPDATE cold_boxes SET description = ?, max_temp = ?, current_temp = ?, status = ? WHERE id = ?`,
        [description, max_temp, current_temp, status, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  },

  updateTemperature: (id, currentTemp) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE cold_boxes SET current_temp = ? WHERE id = ?`,
        [currentTemp, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM cold_boxes WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = ColdBox;
