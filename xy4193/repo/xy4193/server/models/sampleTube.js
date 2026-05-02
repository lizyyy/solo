const db = require('../config/database');

const SampleTube = {
  create: (tubeData) => {
    return new Promise((resolve, reject) => {
      const { tube_code, donor_id, tube_type } = tubeData;
      db.run(
        `INSERT INTO sample_tubes (tube_code, donor_id, tube_type) VALUES (?, ?, ?)`,
        [tube_code, donor_id, tube_type || 'standard'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...tubeData });
          }
        }
      );
    });
  },

  findByCode: (tubeCode) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT st.*, d.donor_code, d.name as donor_name 
         FROM sample_tubes st 
         LEFT JOIN donors d ON st.donor_id = d.id 
         WHERE st.tube_code = ?`,
        [tubeCode],
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
        `SELECT st.*, d.donor_code, d.name as donor_name 
         FROM sample_tubes st 
         LEFT JOIN donors d ON st.donor_id = d.id 
         WHERE st.id = ?`,
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
      db.all(
        `SELECT st.*, d.donor_code, d.name as donor_name 
         FROM sample_tubes st 
         LEFT JOIN donors d ON st.donor_id = d.id 
         ORDER BY st.created_at DESC`,
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

  getByDonorCode: (donorCode) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT st.*, d.donor_code, d.name as donor_name 
         FROM sample_tubes st 
         LEFT JOIN donors d ON st.donor_id = d.id 
         WHERE d.donor_code = ?
         ORDER BY st.created_at DESC`,
        [donorCode],
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

  update: (id, tubeData) => {
    return new Promise((resolve, reject) => {
      const { donor_id, tube_type } = tubeData;
      db.run(
        `UPDATE sample_tubes SET donor_id = ?, tube_type = ? WHERE id = ?`,
        [donor_id, tube_type, id],
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
      db.run(`DELETE FROM sample_tubes WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = SampleTube;
