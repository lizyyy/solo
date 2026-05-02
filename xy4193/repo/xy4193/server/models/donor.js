const db = require('../config/database');

const Donor = {
  create: (donorData) => {
    return new Promise((resolve, reject) => {
      const { donor_code, name, id_card, blood_type } = donorData;
      db.run(
        `INSERT INTO donors (donor_code, name, id_card, blood_type) VALUES (?, ?, ?, ?)`,
        [donor_code, name, id_card, blood_type],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...donorData });
          }
        }
      );
    });
  },

  findByCode: (donorCode) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM donors WHERE donor_code = ?`,
        [donorCode],
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
        `SELECT * FROM donors WHERE id = ?`,
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
      db.all(`SELECT * FROM donors ORDER BY created_at DESC`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  update: (id, donorData) => {
    return new Promise((resolve, reject) => {
      const { name, id_card, blood_type } = donorData;
      db.run(
        `UPDATE donors SET name = ?, id_card = ?, blood_type = ? WHERE id = ?`,
        [name, id_card, blood_type, id],
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
      db.run(`DELETE FROM donors WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = Donor;
