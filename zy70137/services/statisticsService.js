const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const statisticsService = {
  getToday: () => {
    return new Date().toISOString().split('T')[0];
  },

  getOrCreateDailyStat: (date, activityId = null) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM statistics WHERE date = ? AND activity_id IS ?',
        [date, activityId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (row) {
            resolve(row);
            return;
          }
          
          const id = uuidv4();
          db.run(
            `INSERT INTO statistics (id, date, activity_id, total_attempts, success_count, blocked_count, failed_count, compensation_count) 
             VALUES (?, ?, ?, 0, 0, 0, 0, 0)`,
            [id, date, activityId],
            function(err) {
              if (err) reject(err);
              else resolve({
                id, date, activity_id: activityId,
                total_attempts: 0, success_count: 0, 
                blocked_count: 0, failed_count: 0, compensation_count: 0
              });
            }
          );
        }
      );
    });
  },

  incrementStats: async (activityId, type) => {
    const date = statisticsService.getToday();
    const stats = await statisticsService.getOrCreateDailyStat(date, activityId);
    const overallStats = await statisticsService.getOrCreateDailyStat(date, null);

    const updateField = (type === 'attempt' ? 'total_attempts' : 
                        type === 'success' ? 'success_count' :
                        type === 'blocked' ? 'blocked_count' :
                        type === 'failed' ? 'failed_count' : 'compensation_count');

    const updates = [`${updateField} = ${updateField} + 1`];
    if (type !== 'attempt') {
      updates.push(`total_attempts = total_attempts + 1`);
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE statistics SET ${updates.join(', ')} WHERE date = ? AND activity_id IS ?`,
        [date, activityId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE statistics SET ${updates.join(', ')} WHERE date = ? AND activity_id IS NULL`,
        [date],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  getDailyStatistics: (date) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM statistics WHERE date = ? ORDER BY activity_id IS NULL DESC, activity_id`,
        [date],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  getOverview: () => {
    return new Promise((resolve, reject) => {
      const today = statisticsService.getToday();
      db.all(
        `SELECT 
          s.*,
          a.name as activity_name,
          a.scene as activity_scene,
          a.priority as activity_priority
         FROM statistics s
         LEFT JOIN activities a ON s.activity_id = a.id
         WHERE s.date = ?
         ORDER BY s.activity_id IS NULL DESC, a.priority DESC`,
        [today],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  getBlockPointDetails: (userId, deviceId, activityId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM send_attempts 
         WHERE (user_id = ? OR device_id = ?) AND activity_id = ?
         ORDER BY check_time DESC LIMIT 10`,
        [userId, deviceId, activityId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  getSendHistory: (userId = null, deviceId = null, limit = 20) => {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM messages WHERE 1=1';
      const params = [];
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      if (deviceId) {
        query += ' AND device_id = ?';
        params.push(deviceId);
      }
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

module.exports = statisticsService;
