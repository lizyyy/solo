const db = require('../config/database');

const ColdBoxTimeline = {
  create: (timelineData) => {
    return new Promise((resolve, reject) => {
      const { box_id, event_type, temperature, blood_bag_code, operator, notes } = timelineData;
      db.run(
        `INSERT INTO cold_box_timeline (box_id, event_type, temperature, blood_bag_code, operator, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [box_id, event_type, temperature, blood_bag_code, operator, notes],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...timelineData });
          }
        }
      );
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT cbt.*, cb.box_code 
         FROM cold_box_timeline cbt
         LEFT JOIN cold_boxes cb ON cbt.box_id = cb.id
         WHERE cbt.id = ?`,
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

  getByBoxId: (boxId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cbt.*, cb.box_code 
         FROM cold_box_timeline cbt
         LEFT JOIN cold_boxes cb ON cbt.box_id = cb.id
         WHERE cbt.box_id = ?
         ORDER BY cbt.event_time DESC`,
        [boxId],
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

  getByBoxCode: (boxCode) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cbt.*, cb.box_code 
         FROM cold_box_timeline cbt
         LEFT JOIN cold_boxes cb ON cbt.box_id = cb.id
         WHERE cb.box_code = ?
         ORDER BY cbt.event_time DESC`,
        [boxCode],
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

  getByBloodBagCode: (bagCode) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cbt.*, cb.box_code 
         FROM cold_box_timeline cbt
         LEFT JOIN cold_boxes cb ON cbt.box_id = cb.id
         WHERE cbt.blood_bag_code = ?
         ORDER BY cbt.event_time DESC`,
        [bagCode],
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
        `SELECT cbt.*, cb.box_code 
         FROM cold_box_timeline cbt
         LEFT JOIN cold_boxes cb ON cbt.box_id = cb.id
         ORDER BY cbt.event_time DESC`,
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

  getByTimeRange: (startTime, endTime) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cbt.*, cb.box_code 
         FROM cold_box_timeline cbt
         LEFT JOIN cold_boxes cb ON cbt.box_id = cb.id
         WHERE cbt.event_time >= ? AND cbt.event_time <= ?
         ORDER BY cbt.event_time DESC`,
        [startTime, endTime],
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

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM cold_box_timeline WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
};

module.exports = ColdBoxTimeline;
