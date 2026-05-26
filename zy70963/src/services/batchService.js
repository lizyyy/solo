const { run, get, all } = require('../db');
const { processRecord } = require('./reconciliation');

async function findBatchByNo(batchNo) {
  return await get('SELECT * FROM batches WHERE batch_no = ?', [batchNo]);
}

async function getBatchRecords(batchId) {
  return await all('SELECT * FROM daily_records WHERE batch_id = ? ORDER BY record_date', [batchId]);
}

async function createBatch(batchData) {
  const { batch_no, store_id, store_name, region, submit_date, processor, remark, records } = batchData;

  const existingBatch = await findBatchByNo(batch_no);
  if (existingBatch) {
    const existingRecords = await getBatchRecords(existingBatch.id);
    return {
      isDuplicate: true,
      batch: existingBatch,
      records: existingRecords,
      message: '批次已存在，返回原处理结果'
    };
  }

  const batchResult = await run(
    'INSERT INTO batches (batch_no, store_id, store_name, region, submit_date, processor, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [batch_no, store_id, store_name, region, submit_date, processor, remark || null]
  );
  const batchId = batchResult.lastID;

  const processedRecords = [];
  for (const record of records) {
    const processed = processRecord(record);
    await run(
      `INSERT INTO daily_records (
        batch_id, record_date, store_id, pos_sales, cash_deposit, imprest_borrow,
        imprest_return, opening_cash, closing_cash, is_holiday, holiday_delay_note,
        category, category_reason, next_action, cash_short_long, theoretical_cash,
        is_balanced, processor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        processed.record_date,
        store_id,
        processed.pos_sales || 0,
        processed.cash_deposit || 0,
        processed.imprest_borrow || 0,
        processed.imprest_return || 0,
        processed.opening_cash || 0,
        processed.closing_cash || 0,
        processed.is_holiday ? 1 : 0,
        processed.holiday_delay_note || null,
        processed.category,
        processed.category_reason,
        processed.next_action,
        processed.cash_short_long,
        processed.theoretical_cash,
        processed.is_balanced,
        processor
      ]
    );
    processedRecords.push(processed);
  }

  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  return {
    isDuplicate: false,
    batch,
    records: processedRecords,
    message: '批次创建成功'
  };
}

async function getBatchList(params = {}) {
  const { region, store_id, start_date, end_date, page = 1, pageSize = 20 } = params;
  
  let where = [];
  let values = [];

  if (region) {
    where.push('region = ?');
    values.push(region);
  }
  if (store_id) {
    where.push('store_id = ?');
    values.push(store_id);
  }
  if (start_date) {
    where.push('submit_date >= ?');
    values.push(start_date);
  }
  if (end_date) {
    where.push('submit_date <= ?');
    values.push(end_date);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * pageSize;

  const batches = await all(
    `SELECT * FROM batches ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const totalResult = await get(`SELECT COUNT(*) as count FROM batches ${whereClause}`, values);
  const total = totalResult.count;

  return {
    batches,
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }
  };
}

async function getBatchDetail(batchNo) {
  const batch = await findBatchByNo(batchNo);
  if (!batch) return null;

  const records = await getBatchRecords(batch.id);
  
  const stats = {
    total: records.length,
    normal: records.filter(r => r.category === '正常').length,
    pending: records.filter(r => r.category === '待补充').length,
    blocked: records.filter(r => r.category === '已拦截').length,
    balanced: records.filter(r => r.is_balanced).length,
    totalShortLong: records.reduce((sum, r) => sum + r.cash_short_long, 0)
  };

  return { batch, records, stats };
}

async function getStatistics(params = {}) {
  const { region, store_id, start_date, end_date } = params;
  
  let where = [];
  let values = [];

  if (region) {
    where.push('b.region = ?');
    values.push(region);
  }
  if (store_id) {
    where.push('r.store_id = ?');
    values.push(store_id);
  }
  if (start_date) {
    where.push('r.record_date >= ?');
    values.push(start_date);
  }
  if (end_date) {
    where.push('r.record_date <= ?');
    values.push(end_date);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const categoryStats = await all(`
    SELECT 
      category,
      COUNT(*) as count,
      SUM(ABS(cash_short_long)) as total_amount
    FROM daily_records r
    LEFT JOIN batches b ON r.batch_id = b.id
    ${whereClause}
    GROUP BY category
  `, values);

  const dailyStats = await all(`
    SELECT 
      record_date,
      COUNT(*) as record_count,
      SUM(pos_sales) as total_sales,
      SUM(cash_deposit) as total_deposit,
      SUM(imprest_borrow) as total_imprest,
      SUM(cash_short_long) as total_short_long,
      SUM(is_balanced) as balanced_count
    FROM daily_records r
    LEFT JOIN batches b ON r.batch_id = b.id
    ${whereClause}
    GROUP BY record_date
    ORDER BY record_date DESC
    LIMIT 30
  `, values);

  const summary = await get(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT batch_id) as total_batches,
      COUNT(DISTINCT r.store_id) as total_stores,
      SUM(pos_sales) as total_sales,
      SUM(cash_deposit) as total_deposit,
      SUM(imprest_borrow) as total_imprest_borrow,
      SUM(imprest_return) as total_imprest_return,
      SUM(cash_short_long) as total_short_long,
      SUM(CASE WHEN category = '正常' THEN 1 ELSE 0 END) as normal_count,
      SUM(CASE WHEN category = '待补充' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN category = '已拦截' THEN 1 ELSE 0 END) as blocked_count
    FROM daily_records r
    LEFT JOIN batches b ON r.batch_id = b.id
    ${whereClause}
  `, values);

  return {
    summary,
    categoryStats,
    dailyStats
  };
}

module.exports = {
  findBatchByNo,
  createBatch,
  getBatchList,
  getBatchDetail,
  getBatchRecords,
  getStatistics
};
