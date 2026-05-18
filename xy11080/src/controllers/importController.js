const fs = require('fs');
const csv = require('csv-parser');
const db = require('../database/init');
const { validateRecord } = require('../utils/validator');
const { ERROR_SUGGESTIONS, STATUS_FLOW } = require('../utils/constants');
const { calculateRecordDetail } = require('../utils/calculator');

function generateBatchNo() {
  const now = new Date();
  return `BATCH${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

function checkDuplicateRecordNo(recordNo) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM water_temp_records WHERE record_no = ?', [recordNo], (err, row) => {
      if (err) reject(err);
      resolve(!!row);
    });
  });
}

function insertBadRecord(batchNo, rowNumber, originalData, errorReason, suggestion) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO bad_records (import_batch_no, row_number, original_data, error_reason, suggestion) VALUES (?, ?, ?, ?, ?)',
      [batchNo, rowNumber, JSON.stringify(originalData), errorReason, suggestion],
      function(err) {
        if (err) reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function insertRecord(data, batchNo, operator) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const status = (data.is_temp_compliant === 0 && data.is_compensation_consistent === 1) 
      ? 'manual_review' 
      : 'pending';
    
    db.run(
      `INSERT INTO water_temp_records (
        record_no, pool_name, pool_no, pool_type, record_date, time_slot,
        time_slot_start, time_slot_end, standard_temp_min, standard_temp_max,
        actual_temp, measure_time, measure_person, is_temp_compliant, affected_periods,
        course_id, course_name, coach_name, registered_count, attended_count,
        need_compensation, compensation_type, compensation_amount, compensation_quantity,
        compensation_table_version, is_compensation_consistent, status,
        import_batch_no, import_time, import_operator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.record_no, data.pool_name, data.pool_no, data.pool_type, data.record_date, data.time_slot,
        data.time_slot_start, data.time_slot_end, data.standard_temp_min, data.standard_temp_max,
        data.actual_temp, data.measure_time, data.measure_person, data.is_temp_compliant, data.affected_periods,
        data.course_id, data.course_name, data.coach_name, data.registered_count, data.attended_count,
        data.need_compensation, data.compensation_type, data.compensation_amount, data.compensation_quantity,
        data.compensation_table_version, data.is_compensation_consistent, status,
        batchNo, now, operator
      ],
      function(err) {
        if (err) reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function insertBatch(batchNo, fileName, operator) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO import_batches (batch_no, file_name, import_operator) VALUES (?, ?, ?)',
      [batchNo, fileName, operator],
      function(err) {
        if (err) reject(err);
        resolve();
      }
    );
  });
}

function updateBatchStats(batchNo, totalCount, successCount, failedCount) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE import_batches SET total_count = ?, success_count = ?, failed_count = ? WHERE batch_no = ?',
      [totalCount, successCount, failedCount, batchNo],
      function(err) {
        if (err) reject(err);
        resolve();
      }
    );
  });
}

async function importCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '请上传CSV文件'
    });
  }

  const batchNo = generateBatchNo();
  const operator = req.body.operator || 'system';
  const fileName = req.file.originalname;

  try {
    await insertBatch(batchNo, fileName, operator);
  } catch (err) {
    return res.status(500).json({ success: false, message: '创建批次失败', error: err.message });
  }

  const results = [];
  const badRecords = [];
  let totalCount = 0;
  let successCount = 0;
  let failedCount = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', async (data) => {
      results.push(data);
    })
    .on('end', async () => {
      totalCount = results.length;

      for (let i = 0; i < results.length; i++) {
        const rowNumber = i + 2;
        const originalData = results[i];

        try {
          const validation = validateRecord(originalData);

          if (!validation.valid) {
            const errorReason = validation.errors.join('; ');
            await insertBadRecord(
              batchNo,
              rowNumber,
              originalData,
              errorReason,
              ERROR_SUGGESTIONS.MISSING_REQUIRED
            );
            failedCount++;
            badRecords.push({
              rowNumber,
              originalData,
              errorReason,
              suggestion: ERROR_SUGGESTIONS.MISSING_REQUIRED
            });
            continue;
          }

          const isDuplicate = await checkDuplicateRecordNo(validation.data.record_no);
          if (isDuplicate) {
            await insertBadRecord(
              batchNo,
              rowNumber,
              originalData,
              `记录编号 ${validation.data.record_no} 已存在`,
              ERROR_SUGGESTIONS.DUPLICATE_RECORD_NO
            );
            failedCount++;
            badRecords.push({
              rowNumber,
              originalData,
              errorReason: `记录编号 ${validation.data.record_no} 已存在`,
              suggestion: ERROR_SUGGESTIONS.DUPLICATE_RECORD_NO
            });
            continue;
          }

          await insertRecord(validation.data, batchNo, operator);
          successCount++;

        } catch (err) {
          await insertBadRecord(
            batchNo,
            rowNumber,
            originalData,
            err.message,
            '请检查数据格式或联系技术支持'
          );
          failedCount++;
          badRecords.push({
            rowNumber,
            originalData,
            errorReason: err.message,
            suggestion: '请检查数据格式或联系技术支持'
          });
        }
      }

      await updateBatchStats(batchNo, totalCount, successCount, failedCount);

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        batchNo,
        summary: {
          total: totalCount,
          success: successCount,
          failed: failedCount
        },
        badRecords: badRecords.slice(0, 100)
      });
    });
}

function getImportBatches(req, res) {
  db.all('SELECT * FROM import_batches ORDER BY import_time DESC LIMIT 50', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: rows });
  });
}

function getBadRecords(req, res) {
  const { batchNo } = req.params;
  db.all('SELECT * FROM bad_records WHERE import_batch_no = ? ORDER BY row_number', [batchNo], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    const result = rows.map(row => ({
      ...row,
      original_data: JSON.parse(row.original_data)
    }));
    res.json({ success: true, data: result });
  });
}

module.exports = {
  importCSV,
  getImportBatches,
  getBadRecords
};