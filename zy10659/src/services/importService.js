const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const LockService = require('./lockService');

class ImportService {
  static async batchImport(records, operator) {
    return new Promise((resolve, reject) => {
      const batchId = uuidv4();
      const results = [];
      let successCount = 0;
      let failedCount = 0;

      db.run(
        'INSERT INTO import_batches (id, total_count, operator) VALUES (?, ?, ?)',
        [batchId, records.length, operator],
        (err) => {
          if (err) return reject(err);

          const processNext = async (index) => {
            if (index >= records.length) {
              db.run(
                'UPDATE import_batches SET status = ?, success_count = ?, failed_count = ?, completed_at = ? WHERE id = ?',
                ['completed', successCount, failedCount, new Date().toISOString(), batchId],
                (err) => {
                  if (err) return reject(err);
                  resolve({
                    batch_id: batchId,
                    total_count: records.length,
                    success_count: successCount,
                    failed_count: failedCount,
                    results: results
                  });
                }
              );
              return;
            }

            const record = records[index];
            const rowNumber = index + 1;
            let recordId = null;

            try {
              const insertRecord = () => {
                return new Promise((res, rej) => {
                  db.run(
                    'INSERT INTO import_records (batch_id, row_number, room_number, channel_code, reason_code, unlock_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [batchId, rowNumber, record.room_number, record.channel_code || null, record.reason_code, record.unlock_time || null, 'processing'],
                    function(err) {
                      if (err) return rej(err);
                      recordId = this.lastID;
                      res();
                    }
                  );
                });
              };

              await insertRecord();

              const result = await LockService.createLock({
                room_number: record.room_number,
                reason_code: record.reason_code,
                channel_code: record.channel_code,
                unlock_time: record.unlock_time,
                operator: operator,
                remark: record.remark
              });

              db.run(
                'UPDATE import_records SET status = ?, lock_id = ? WHERE id = ?',
                ['success', result.id, recordId]
              );

              successCount++;
              results.push({
                row: rowNumber,
                room_number: record.room_number,
                status: 'success',
                lock_id: result.id
              });

            } catch (error) {
              failedCount++;
              const errorMsg = error.message;

              if (recordId) {
                db.run(
                  'UPDATE import_records SET status = ?, error_message = ? WHERE id = ?',
                  ['failed', errorMsg, recordId]
                );
              }

              results.push({
                row: rowNumber,
                room_number: record.room_number,
                status: 'failed',
                error_message: errorMsg
              });
            }

            processNext(index + 1);
          };

          processNext(0);
        }
      );
    });
  }

  static async getBatchDetail(batchId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM import_batches WHERE id = ?', [batchId], (err, batch) => {
        if (err) return reject(err);
        if (!batch) return reject(new Error('批次不存在'));

        db.all('SELECT * FROM import_records WHERE batch_id = ? ORDER BY row_number', [batchId], (err, records) => {
          if (err) return reject(err);
          resolve({ batch, records });
        });
      });
    });
  }
}

module.exports = ImportService;
