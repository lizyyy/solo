const db = require('../config/database');

const BloodBag = {
  create: (bagData) => {
    return new Promise((resolve, reject) => {
      const { bag_code, donor_id, volume, blood_type, collection_time } = bagData;
      db.run(
        `INSERT INTO blood_bags (bag_code, donor_id, volume, blood_type, collection_time) VALUES (?, ?, ?, ?, ?)`,
        [bag_code, donor_id, volume, blood_type, collection_time || new Date().toISOString()],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...bagData });
          }
        }
      );
    });
  },

  findByCode: (bagCode) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT bb.*, d.donor_code, d.name as donor_name 
         FROM blood_bags bb 
         LEFT JOIN donors d ON bb.donor_id = d.id 
         WHERE bb.bag_code = ?`,
        [bagCode],
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
        `SELECT bb.*, d.donor_code, d.name as donor_name 
         FROM blood_bags bb 
         LEFT JOIN donors d ON bb.donor_id = d.id 
         WHERE bb.id = ?`,
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
        `SELECT bb.*, d.donor_code, d.name as donor_name 
         FROM blood_bags bb 
         LEFT JOIN donors d ON bb.donor_id = d.id 
         ORDER BY bb.created_at DESC`,
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
        `SELECT bb.*, d.donor_code, d.name as donor_name 
         FROM blood_bags bb 
         LEFT JOIN donors d ON bb.donor_id = d.id 
         WHERE d.donor_code = ?
         ORDER BY bb.created_at DESC`,
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

  update: (id, bagData) => {
    return new Promise((resolve, reject) => {
      const { donor_id, volume, blood_type, collection_time } = bagData;
      db.run(
        `UPDATE blood_bags SET donor_id = ?, volume = ?, blood_type = ?, collection_time = ? WHERE id = ?`,
        [donor_id, volume, blood_type, collection_time, id],
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
      db.run(`DELETE FROM blood_bags WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = BloodBag;
