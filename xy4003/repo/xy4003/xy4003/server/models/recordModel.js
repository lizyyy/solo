const db = require('../database');

const RecordModel = {
  checkPendingByRoomAndPhone: function(roomNumber, phone, callback) {
    db.get(
      'SELECT id FROM records WHERE room_number = ? AND phone = ? AND status = ?',
      [roomNumber, phone, '待领取'],
      callback
    );
  },

  create: function(data, callback) {
    const stmt = db.prepare(`
      INSERT INTO records (
        room_number, resident_name, phone, storage_type,
        receiver_name, valid_from, valid_to, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      [
        data.room_number,
        data.resident_name,
        data.phone,
        data.storage_type,
        data.receiver_name || null,
        data.valid_from,
        data.valid_to,
        data.remarks || null
      ],
      function(err) {
        stmt.finalize();
        if (err) return callback(err);
        callback(null, { id: this.lastID });
      }
    );
  },

  findById: function(id, callback) {
    db.get('SELECT * FROM records WHERE id = ?', [id], callback);
  },

  search: function(filters, callback) {
    let sql = 'SELECT * FROM records WHERE 1=1';
    const params = [];

    if (filters.room_number) {
      sql += ' AND room_number LIKE ?';
      params.push(`%${filters.room_number}%`);
    }
    if (filters.phone) {
      sql += ' AND phone LIKE ?';
      params.push(`%${filters.phone}%`);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';
    
    db.all(sql, params, callback);
  },

  updateStatus: function(id, status, receivedBy, callback) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const receivedAt = status === '已领取' ? now : null;
    const receiver = status === '已领取' ? receivedBy : null;

    db.run(
      `UPDATE records 
       SET status = ?, updated_at = ?, received_at = ?, received_by = ?
       WHERE id = ?`,
      [status, now, receivedAt, receiver, id],
      function(err) {
        if (err) return callback(err);
        callback(null, { changes: this.changes });
      }
    );
  },

  checkAndMarkExpired: function(callback) {
    const now = new Date().toISOString().substring(0, 10);
    
    db.all(
      `SELECT id FROM records 
       WHERE status = '待领取' AND date(valid_to) < date(?)`,
      [now],
      (err, rows) => {
        if (err) return callback(err);
        if (rows.length === 0) return callback(null, { count: 0 });

        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        
        db.run(
          `UPDATE records SET status = '已过期', updated_at = datetime('now', 'localtime')
           WHERE id IN (${placeholders})`,
          ids,
          function(err) {
            if (err) return callback(err);
            callback(null, { count: this.changes, ids: ids });
          }
        );
      }
    );
  },

  getAllForExport: function(callback) {
    db.all('SELECT * FROM records ORDER BY id', callback);
  },

  batchCreate: function(records, callback) {
    const results = { success: 0, skipped: 0, failed: 0, details: [] };
    
    const processNext = (index) => {
      if (index >= records.length) {
        return callback(null, results);
      }

      const record = records[index];
      
      if (!record.room_number || !record.resident_name || !record.phone || 
          !record.storage_type || !record.valid_from || !record.valid_to) {
        results.failed++;
        results.details.push({
          row: index + 2,
          status: '失败',
          reason: '缺少必填字段'
        });
        return processNext(index + 1);
      }

      RecordModel.checkPendingByRoomAndPhone(record.room_number, record.phone, (err, existing) => {
        if (err) {
          results.failed++;
          results.details.push({
            row: index + 2,
            status: '失败',
            reason: err.message
          });
          return processNext(index + 1);
        }

        if (existing) {
          results.skipped++;
          results.details.push({
            row: index + 2,
            status: '跳过',
            reason: `房号 ${record.room_number} 手机号 ${record.phone} 已有待领取记录`
          });
          return processNext(index + 1);
        }

        RecordModel.create(record, (err, result) => {
          if (err) {
            results.failed++;
            results.details.push({
              row: index + 2,
              status: '失败',
              reason: err.message
            });
          } else {
            results.success++;
            results.details.push({
              row: index + 2,
              status: '成功',
              id: result.id
            });
          }
          processNext(index + 1);
        });
      });
    };

    processNext(0);
  }
};

module.exports = RecordModel;
