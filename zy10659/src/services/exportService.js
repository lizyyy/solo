const db = require('../config/database');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class ExportService {
  static async exportLocks(params = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          rl.id,
          rl.room_number,
          r.room_type,
          rl.channel_code,
          sc.name as channel_name,
          rl.reason_code,
          lr.name as reason_name,
          rl.lock_time,
          rl.unlock_time,
          rl.status,
          rl.operator,
          rl.remark,
          rl.created_at
        FROM room_locks rl
        LEFT JOIN rooms r ON rl.room_id = r.id
        LEFT JOIN sales_channels sc ON rl.channel_id = sc.id
        LEFT JOIN lock_reasons lr ON rl.reason_id = lr.id
        WHERE 1=1
      `;
      const queryParams = [];

      if (params.status) {
        query += ' AND rl.status = ?';
        queryParams.push(params.status);
      }
      if (params.start_date) {
        query += ' AND rl.created_at >= ?';
        queryParams.push(params.start_date);
      }
      if (params.end_date) {
        query += ' AND rl.created_at <= ?';
        queryParams.push(params.end_date);
      }

      query += ' ORDER BY rl.created_at DESC';

      db.all(query, queryParams, (err, rows) => {
        if (err) return reject(err);

        const exportDir = path.join(__dirname, '../../exports');
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }

        const filename = `room_locks_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        const filepath = path.join(exportDir, filename);

        const csvWriter = createCsvWriter({
          path: filepath,
          header: [
            { id: 'id', title: '锁房ID' },
            { id: 'room_number', title: '房间号' },
            { id: 'room_type', title: '房型' },
            { id: 'channel_code', title: '渠道编码' },
            { id: 'channel_name', title: '渠道名称' },
            { id: 'reason_code', title: '原因编码' },
            { id: 'reason_name', title: '原因名称' },
            { id: 'lock_time', title: '锁房时间' },
            { id: 'unlock_time', title: '解锁时间' },
            { id: 'status', title: '状态' },
            { id: 'operator', title: '操作人' },
            { id: 'remark', title: '备注' },
            { id: 'created_at', title: '创建时间' }
          ]
        });

        csvWriter.writeRecords(rows).then(() => {
          resolve({
            filepath,
            filename,
            count: rows.length
          });
        }).catch(reject);
      });
    });
  }

  static async exportHistory(lockId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          rlh.id,
          rl.room_number,
          rlh.old_status,
          rlh.new_status,
          rlh.action,
          rlh.operator,
          rlh.remark,
          rlh.changed_at
        FROM room_lock_history rlh
        JOIN room_locks rl ON rlh.lock_id = rl.id
        WHERE rlh.lock_id = ?
        ORDER BY rlh.changed_at
      `, [lockId], (err, rows) => {
        if (err) return reject(err);

        const exportDir = path.join(__dirname, '../../exports');
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }

        const filename = `lock_history_${lockId.substring(0, 8)}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        const filepath = path.join(exportDir, filename);

        const csvWriter = createCsvWriter({
          path: filepath,
          header: [
            { id: 'id', title: '记录ID' },
            { id: 'room_number', title: '房间号' },
            { id: 'old_status', title: '原状态' },
            { id: 'new_status', title: '新状态' },
            { id: 'action', title: '操作' },
            { id: 'operator', title: '操作人' },
            { id: 'remark', title: '备注' },
            { id: 'changed_at', title: '变更时间' }
          ]
        });

        csvWriter.writeRecords(rows).then(() => {
          resolve({
            filepath,
            filename,
            count: rows.length
          });
        }).catch(reject);
      });
    });
  }
}

module.exports = ExportService;
