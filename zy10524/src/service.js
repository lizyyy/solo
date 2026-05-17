const { db } = require('./database');
const moment = require('moment');

function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.startsWith('86')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('+86')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.length === 11 && /^1[3-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

function generateBatchNo() {
  return 'BATCH' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
}

async function createBatch(channel, createdBy) {
  const batchNo = generateBatchNo();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO unsubscribe_batches (batch_no, channel, created_by) VALUES (?, ?, ?)`,
      [batchNo, channel, createdBy],
      function(err) {
        if (err) reject(err);
        else resolve({ batchNo, id: this.lastID });
      }
    );
  });
}

async function processUnsubscribe(phones, channel, unsubscribeTime, marketingBatch, sourceData, createdBy) {
  const batch = await createBatch(channel, createdBy);
  const results = {
    batchNo: batch.batchNo,
    total: phones.length,
    success: 0,
    duplicate: 0,
    error: 0,
    details: []
  };

  for (const phone of phones) {
    const normalized = normalizePhone(phone);
    
    if (!normalized) {
      await recordException(batch.batchNo, phone, channel, 'invalid_phone', '无效的手机号码格式', JSON.stringify({ phone }), '号码归一化失败');
      results.error++;
      results.details.push({ phone, status: 'error', message: '无效的手机号码格式' });
      continue;
    }

    try {
      const existing = await findByPhoneAndChannel(normalized, channel);
      
      if (existing) {
        results.duplicate++;
        results.details.push({ phone, normalized, status: 'duplicate', message: '重复退订，已幂等处理' });
      } else {
        await insertUnsubscribeRecord(normalized, phone, channel, unsubscribeTime, marketingBatch, sourceData);
        results.success++;
        results.details.push({ phone, normalized, status: 'success', message: '退订成功' });
      }
    } catch (err) {
      await recordException(batch.batchNo, phone, channel, 'process_error', err.message, JSON.stringify({ phone, normalized }), '处理异常');
      results.error++;
      results.details.push({ phone, normalized, status: 'error', message: err.message });
    }
  }

  await updateBatchStats(batch.batchNo, results);
  return results;
}

function insertUnsubscribeRecord(normalized, original, channel, unsubscribeTime, marketingBatch, sourceData) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO unsubscribe_records (phone_normalized, phone_original, channel, unsubscribe_time, marketing_batch, source_data) VALUES (?, ?, ?, ?, ?, ?)`,
      [normalized, original, channel, unsubscribeTime, marketingBatch, JSON.stringify(sourceData)],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function findByPhoneAndChannel(normalized, channel) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM unsubscribe_records WHERE phone_normalized = ? AND channel = ? AND status = 'active'`,
      [normalized, channel],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function recordException(batchNo, phoneOriginal, channel, errorType, errorMessage, originalInput, processLog) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO exception_records (batch_no, phone_original, channel, error_type, error_message, original_input, process_log) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batchNo, phoneOriginal, channel, errorType, errorMessage, originalInput, processLog],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function updateBatchStats(batchNo, results) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE unsubscribe_batches SET total_count = ?, success_count = ?, duplicate_count = ?, error_count = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE batch_no = ?`,
      [results.total, results.success, results.duplicate, results.error, batchNo],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function checkBlock(phone, campaignId, marketingBatch) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { blocked: false, reason: '无效手机号码格式无法验证' };
  }

  const records = await findActiveUnsubscribe(normalized);
  
  if (records.length > 0) {
    const channels = records.map(r => r.channel).join(', ');
    await recordBlock(normalized, marketingBatch, campaignId, `已在渠道 [${channels}] 退订`);
    return {
      blocked: true,
      reason: `该号码已通过 [${channels}] 渠道退订，拦截本次发送`,
      unsubscribeDetails: records.map(r => ({
        channel: r.channel,
        unsubscribeTime: r.unsubscribe_time
      }))
    };
  }
  
  return { blocked: false };
}

function findActiveUnsubscribe(normalized) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM unsubscribe_records WHERE phone_normalized = ? AND status = 'active'`,
      [normalized],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function recordBlock(normalized, marketingBatch, campaignId, reason) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO block_records (phone_normalized, block_time, marketing_batch, campaign_id, block_reason) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)`,
      [normalized, marketingBatch, campaignId, reason],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function queryUnsubscribe(filters) {
  let sql = `SELECT * FROM unsubscribe_records WHERE 1=1`;
  const params = [];

  if (filters.phone) {
    const normalized = normalizePhone(filters.phone);
    if (normalized) {
      sql += ` AND phone_normalized = ?`;
      params.push(normalized);
    }
  }
  if (filters.channel) {
    sql += ` AND channel = ?`;
    params.push(filters.channel);
  }
  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }
  if (filters.startTime) {
    sql += ` AND unsubscribe_time >= ?`;
    params.push(filters.startTime);
  }
  if (filters.endTime) {
    sql += ` AND unsubscribe_time <= ?`;
    params.push(filters.endTime);
  }

  sql += ` ORDER BY unsubscribe_time DESC LIMIT ? OFFSET ?`;
  params.push(filters.limit || 20, filters.offset || 0);

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updateStatus(id, status, operator, reason) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM unsubscribe_records WHERE id = ?`, [id], (err, oldRecord) => {
      if (err) return reject(err);
      if (!oldRecord) return reject(new Error('记录不存在'));

      db.run(
        `UPDATE unsubscribe_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id],
        function(err) {
          if (err) return reject(err);

          db.run(
            `INSERT INTO manual_corrections (unsubscribe_id, phone_normalized, correction_type, before_value, after_value, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, oldRecord.phone_normalized, 'status_change', oldRecord.status, status, reason, operator],
            (err) => {
              if (err) reject(err);
              else resolve({ affectedRows: this.changes });
            }
          );
        }
      );
    });
  });
}

function handleException(exceptionId, status, operator) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE exception_records SET status = ?, handled_at = CURRENT_TIMESTAMP, handled_by = ? WHERE id = ?`,
      [status, operator, exceptionId],
      function(err) {
        if (err) reject(err);
        else resolve({ affectedRows: this.changes });
      }
    );
  });
}

function getExceptions(filters) {
  let sql = `SELECT * FROM exception_records WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }
  if (filters.batchNo) {
    sql += ` AND batch_no = ?`;
    params.push(filters.batchNo);
  }

  sql += ` ORDER BY created_at DESC`;

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getBatchReport(startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        channel,
        COUNT(*) as total_unsubscribes,
        COUNT(DISTINCT phone_normalized) as unique_phones,
        DATE(unsubscribe_time) as report_date
      FROM unsubscribe_records 
      WHERE unsubscribe_time >= ? AND unsubscribe_time <= ?
      GROUP BY channel, DATE(unsubscribe_time)
      ORDER BY report_date DESC, channel`,
      [startDate, endDate],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getAllUnsubscribeForExport(startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        phone_normalized as 归一化手机号,
        phone_original as 原始手机号,
        channel as 退订渠道,
        unsubscribe_time as 退订时间,
        marketing_batch as 营销批次,
        status as 当前状态,
        created_at as 入库时间
      FROM unsubscribe_records 
      WHERE unsubscribe_time >= ? AND unsubscribe_time <= ?
      ORDER BY unsubscribe_time DESC`,
      [startDate, endDate],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  normalizePhone,
  processUnsubscribe,
  checkBlock,
  queryUnsubscribe,
  updateStatus,
  handleException,
  getExceptions,
  getBatchReport,
  getAllUnsubscribeForExport
};
