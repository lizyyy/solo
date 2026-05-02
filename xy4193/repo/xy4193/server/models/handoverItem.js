const db = require('../config/database');

const HandoverItem = {
  create: (itemData) => {
    return new Promise((resolve, reject) => {
      const { handover_id, blood_bag_id, sample_tube_id, donor_code, status, check_result, exception_reason } = itemData;
      db.run(
        `INSERT INTO handover_items (handover_id, blood_bag_id, sample_tube_id, donor_code, status, check_result, exception_reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [handover_id, blood_bag_id, sample_tube_id, donor_code, status || 'pending', check_result, exception_reason],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...itemData });
          }
        }
      );
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT hi.*, 
                bb.bag_code, 
                st.tube_code, 
                d.name as donor_name
         FROM handover_items hi
         LEFT JOIN blood_bags bb ON hi.blood_bag_id = bb.id
         LEFT JOIN sample_tubes st ON hi.sample_tube_id = st.id
         LEFT JOIN donors d ON hi.donor_code = d.donor_code
         WHERE hi.id = ?`,
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

  getByHandoverId: (handoverId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT hi.*, 
                bb.bag_code, 
                st.tube_code, 
                d.name as donor_name
         FROM handover_items hi
         LEFT JOIN blood_bags bb ON hi.blood_bag_id = bb.id
         LEFT JOIN sample_tubes st ON hi.sample_tube_id = st.id
         LEFT JOIN donors d ON hi.donor_code = d.donor_code
         WHERE hi.handover_id = ?
         ORDER BY hi.id`,
        [handoverId],
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

  getByHandoverCode: (handoverCode) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT hi.*, 
                bb.bag_code, 
                st.tube_code, 
                d.name as donor_name,
                h.handover_code
         FROM handover_items hi
         LEFT JOIN handovers h ON hi.handover_id = h.id
         LEFT JOIN blood_bags bb ON hi.blood_bag_id = bb.id
         LEFT JOIN sample_tubes st ON hi.sample_tube_id = st.id
         LEFT JOIN donors d ON hi.donor_code = d.donor_code
         WHERE h.handover_code = ?
         ORDER BY hi.id`,
        [handoverCode],
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

  updateStatus: (id, status, checkResult, exceptionReason) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE handover_items SET status = ?, check_result = ?, exception_reason = ? WHERE id = ?`,
        [status, checkResult, exceptionReason, id],
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
      db.run(`DELETE FROM handover_items WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  },

  deleteByHandoverId: (handoverId) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM handover_items WHERE handover_id = ?`, [handoverId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = HandoverItem;
