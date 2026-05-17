const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class LockService {
  static async createLock(data) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get('BEGIN TRANSACTION');
        db.get('SELECT id FROM rooms WHERE room_number = ?', [data.room_number], (err, room) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          if (!room) {
            db.run('ROLLBACK');
            return reject(new Error(`房间 ${data.room_number} 不存在`));
          }

          db.get('SELECT id FROM lock_reasons WHERE code = ?', [data.reason_code], (err, reason) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            if (!reason) {
              db.run('ROLLBACK');
              return reject(new Error(`锁房原因 ${data.reason_code} 不存在`));
            }

            let channelId = null;
            const checkChannel = (callback) => {
              if (data.channel_code) {
                db.get('SELECT id FROM sales_channels WHERE code = ?', [data.channel_code], (err, channel) => {
                  if (err) return callback(err);
                  if (!channel) return callback(new Error(`销售渠道 ${data.channel_code} 不存在`));
                  channelId = channel.id;
                  callback(null);
                });
              } else {
                callback(null);
              }
            };

            checkChannel((err) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }

              db.get(
                'SELECT id, status FROM room_locks WHERE room_number = ? AND status IN (?, ?)',
                [data.room_number, 'locking', 'pending_unlock'],
                (err, existingLock) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                  }
                  if (existingLock) {
                    db.run('ROLLBACK');
                    return reject(new Error(`房间 ${data.room_number} 当前处于 ${existingLock.status === 'locking' ? '锁房中' : '待解锁'} 状态，无法重复锁房`));
                  }

                  const lockId = uuidv4();
                  const lockTime = new Date().toISOString();
                  const status = 'locking';

                  db.run(
                    `INSERT INTO room_locks 
                     (id, room_id, room_number, channel_id, channel_code, reason_id, reason_code, lock_time, unlock_time, status, operator, remark)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [lockId, room.id, data.room_number, channelId, data.channel_code || null, reason.id, data.reason_code, 
                     lockTime, data.unlock_time || null, status, data.operator, data.remark || null],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }

                      db.run(
                        `INSERT INTO room_lock_history (lock_id, old_status, new_status, action, operator, remark)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [lockId, 'available', status, '创建锁房', data.operator, `锁房原因: ${data.reason_code}`],
                        (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                          }

                          db.run('COMMIT', (err) => {
                            if (err) return reject(err);
                            resolve({ id: lockId, status, room_number: data.room_number });
                          });
                        }
                      );
                    }
                  );
                }
              );
            });
          });
        });
      });
    });
  }

  static async getLockList(params = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM room_locks WHERE 1=1';
      const queryParams = [];

      if (params.status) {
        query += ' AND status = ?';
        queryParams.push(params.status);
      }
      if (params.room_number) {
        query += ' AND room_number = ?';
        queryParams.push(params.room_number);
      }

      query += ' ORDER BY created_at DESC';

      db.all(query, queryParams, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getLockDetail(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM room_locks WHERE id = ?', [id], (err, lock) => {
        if (err) return reject(err);
        if (!lock) return reject(new Error('锁房记录不存在'));
        resolve(lock);
      });
    });
  }

  static async getLockHistory(lockId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM room_lock_history WHERE lock_id = ? ORDER BY changed_at DESC', [lockId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async updateStatus(id, action, operator, remark = '') {
    return new Promise((resolve, reject) => {
      const statusTransitions = {
        'pending_unlock': { from: 'locking', to: 'pending_unlock' },
        'unlock': { from: ['locking', 'pending_unlock'], to: 'unlocked' },
        'reopen': { from: 'unlocked', to: 'locking' }
      };

      const transition = statusTransitions[action];
      if (!transition) {
        return reject(new Error(`不支持的操作: ${action}`));
      }

      db.serialize(() => {
        db.get('BEGIN TRANSACTION');
        db.get('SELECT status FROM room_locks WHERE id = ?', [id], (err, lock) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          if (!lock) {
            db.run('ROLLBACK');
            return reject(new Error('锁房记录不存在'));
          }

          const validFrom = Array.isArray(transition.from) ? transition.from : [transition.from];
          if (!validFrom.includes(lock.status)) {
            db.run('ROLLBACK');
            return reject(new Error(`当前状态 ${lock.status} 不允许执行 ${action} 操作`));
          }

          const now = new Date().toISOString();
          const updateFields = { status: transition.to, updated_at: now };
          if (action === 'unlock') {
            updateFields.unlock_time = now;
          }

          const setClauses = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
          const values = Object.values(updateFields);
          values.push(id);

          db.run(`UPDATE room_locks SET ${setClauses} WHERE id = ?`, values, (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            db.run(
              `INSERT INTO room_lock_history (lock_id, old_status, new_status, action, operator, remark)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [id, lock.status, transition.to, action, operator, remark],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run('COMMIT', (err) => {
                  if (err) return reject(err);
                  resolve({ id, status: transition.to });
                });
              }
            );
          });
        });
      });
    });
  }
}

module.exports = LockService;
