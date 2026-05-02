const db = require('../config/database');

const BagTubeMatch = {
  create: (matchData) => {
    return new Promise((resolve, reject) => {
      const { blood_bag_id, sample_tube_id, matched_by, status } = matchData;
      db.run(
        `INSERT INTO bag_tube_matches (blood_bag_id, sample_tube_id, matched_by, status) VALUES (?, ?, ?, ?)`,
        [blood_bag_id, sample_tube_id, matched_by, status || 'pending'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...matchData });
          }
        }
      );
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT btm.*, 
                bb.bag_code, 
                st.tube_code, 
                d.donor_code, d.name as donor_name
         FROM bag_tube_matches btm
         LEFT JOIN blood_bags bb ON btm.blood_bag_id = bb.id
         LEFT JOIN sample_tubes st ON btm.sample_tube_id = st.id
         LEFT JOIN donors d ON bb.donor_id = d.id
         WHERE btm.id = ?`,
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

  findByDonorCode: (donorCode) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT btm.*, 
                bb.bag_code, 
                st.tube_code, 
                d.donor_code, d.name as donor_name
         FROM bag_tube_matches btm
         LEFT JOIN blood_bags bb ON btm.blood_bag_id = bb.id
         LEFT JOIN sample_tubes st ON btm.sample_tube_id = st.id
         LEFT JOIN donors d ON bb.donor_id = d.id
         WHERE d.donor_code = ?
         ORDER BY btm.matched_at DESC`,
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

  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT btm.*, 
                bb.bag_code, 
                st.tube_code, 
                d.donor_code, d.name as donor_name
         FROM bag_tube_matches btm
         LEFT JOIN blood_bags bb ON btm.blood_bag_id = bb.id
         LEFT JOIN sample_tubes st ON btm.sample_tube_id = st.id
         LEFT JOIN donors d ON bb.donor_id = d.id
         ORDER BY btm.matched_at DESC`,
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

  getByStatus: (status) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT btm.*, 
                bb.bag_code, 
                st.tube_code, 
                d.donor_code, d.name as donor_name
         FROM bag_tube_matches btm
         LEFT JOIN blood_bags bb ON btm.blood_bag_id = bb.id
         LEFT JOIN sample_tubes st ON btm.sample_tube_id = st.id
         LEFT JOIN donors d ON bb.donor_id = d.id
         WHERE btm.status = ?
         ORDER BY btm.matched_at DESC`,
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

  updateStatus: (id, status) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE bag_tube_matches SET status = ? WHERE id = ?`,
        [status, id],
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
      db.run(`DELETE FROM bag_tube_matches WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = BagTubeMatch;
