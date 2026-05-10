const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const compensationService = {
  addToCompensationQueue: (messageData, reason) => {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const nextRetry = moment().add(5, 'minutes').toISOString();
      
      db.run(
        `INSERT INTO failed_messages (id, message_id, user_id, device_id, activity_id, reason, retry_count, next_retry_at, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, messageData.message_id, messageData.user_id, messageData.device_id, messageData.activity_id, reason, nextRetry, now],
        function(err) {
          if (err) reject(err);
          else resolve({ id, message_id: messageData.message_id, next_retry_at: nextRetry });
        }
      );
    });
  },

  getPendingCompensations: () => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.all(
        `SELECT * FROM failed_messages 
         WHERE next_retry_at <= ? AND retry_count < 3 
         ORDER BY next_retry_at ASC`,
        [now],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  getCompensationByMessageId: (messageId) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM failed_messages WHERE message_id = ? ORDER BY created_at DESC LIMIT 1',
        [messageId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  updateCompensation: (id, retrySuccess) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      if (retrySuccess) {
        db.run('DELETE FROM failed_messages WHERE id = ?', [id], function(err) {
          if (err) reject(err);
          else resolve({ id, status: 'compensated' });
        });
      } else {
        const nextRetry = moment().add(15, 'minutes').toISOString();
        db.run(
          `UPDATE failed_messages SET retry_count = retry_count + 1, last_retry_at = ?, next_retry_at = ? WHERE id = ?`,
          [now, nextRetry, id],
          function(err) {
            if (err) reject(err);
            else resolve({ id, next_retry_at: nextRetry, retry_count_incremented: true });
          }
        );
      }
    });
  },

  processCompensations: async (sendHandler) => {
    const pending = await compensationService.getPendingCompensations();
    const results = [];

    for (const item of pending) {
      try {
        const result = await sendHandler({
          user_id: item.user_id,
          device_id: item.device_id,
          activity_id: item.activity_id,
          is_compensation: true
        });

        if (result.success) {
          await compensationService.updateCompensation(item.id, true);
          results.push({
            message_id: item.message_id,
            status: '补偿成功',
            retry_count: item.retry_count
          });
        } else {
          await compensationService.updateCompensation(item.id, false);
          results.push({
            message_id: item.message_id,
            status: '补偿失败，已延后重试',
            retry_count: item.retry_count + 1
          });
        }
      } catch (e) {
        await compensationService.updateCompensation(item.id, false);
        results.push({
          message_id: item.message_id,
          status: '补偿执行异常，已延后重试',
          error: e.message
        });
      }
    }

    return {
      total_processed: pending.length,
      results
    };
  }
};

module.exports = compensationService;
