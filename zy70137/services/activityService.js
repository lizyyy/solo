const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const activityService = {
  getAllActivities: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM activities ORDER BY priority DESC, created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getActivityById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM activities WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  createActivity: (activityData) => {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const { name, scene, priority = 0, rule_id, status = 'active', start_time, end_time } = activityData;
      
      db.run(
        `INSERT INTO activities (id, name, scene, priority, rule_id, status, start_time, end_time, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, scene, priority, rule_id, status, start_time, end_time, now],
        function(err) {
          if (err) reject(err);
          else resolve({ 
            id, 
            name, 
            scene, 
            priority, 
            rule_id, 
            status,
            start_time,
            end_time,
            created_at: now 
          });
        }
      );
    });
  },

  updateActivity: (id, activityData) => {
    return new Promise((resolve, reject) => {
      const { name, scene, priority, rule_id, status, start_time, end_time } = activityData;
      
      db.run(
        `UPDATE activities SET name = ?, scene = ?, priority = ?, rule_id = ?, status = ?, start_time = ?, end_time = ? WHERE id = ?`,
        [name, scene, priority, rule_id, status, start_time, end_time, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...activityData, affected: this.changes });
        }
      );
    });
  },

  updatePriority: (id, priority) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE activities SET priority = ? WHERE id = ?', [priority, id], function(err) {
        if (err) reject(err);
        else resolve({ id, priority, affected: this.changes });
      });
    });
  },

  deleteActivity: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM activities WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ affected: this.changes });
      });
    });
  },

  addUserToBucket: (userId, activityId) => {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const bucketDate = new Date().toISOString().split('T')[0];
      
      db.run(
        `INSERT OR IGNORE INTO user_buckets (id, user_id, bucket_date, activity_id, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, userId, bucketDate, activityId, now],
        function(err) {
          if (err) reject(err);
          else resolve({ id, user_id: userId, activity_id: activityId, created_at: now });
        }
      );
    });
  },

  getUserBucket: (userId, activityId) => {
    return new Promise((resolve, reject) => {
      const bucketDate = new Date().toISOString().split('T')[0];
      db.get(
        'SELECT * FROM user_buckets WHERE user_id = ? AND activity_id = ? AND bucket_date = ?',
        [userId, activityId, bucketDate],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  getBucketStats: (activityId) => {
    return new Promise((resolve, reject) => {
      const bucketDate = new Date().toISOString().split('T')[0];
      db.get(
        'SELECT COUNT(*) as user_count FROM user_buckets WHERE activity_id = ? AND bucket_date = ?',
        [activityId, bucketDate],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? { date: bucketDate, user_count: row.user_count } : null);
        }
      );
    });
  }
};

module.exports = activityService;
