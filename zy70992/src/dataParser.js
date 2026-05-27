const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { db } = require('./db');

function parseCardCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    records.push(row);
  }
  return records;
}

function parseSubsidyJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function parseRefundCSV(filePath) {
  return parseCardCSV(filePath);
}

function getCardField(row, candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== '') return row[c];
  }
  return null;
}

function normalizeCardRecord(row) {
  return {
    student_id: getCardField(row, ['student_id', '学号', '学生ID', 'ID']),
    student_name: getCardField(row, ['student_name', '姓名', '学生姓名', 'Name']),
    meal_date: getCardField(row, ['meal_date', '日期', '就餐日期', '刷卡日期', 'Date']),
    meal_type: getCardField(row, ['meal_type', '餐次', '餐别', 'MealType']) || '午餐',
    amount: parseFloat(getCardField(row, ['amount', '金额', '消费金额', 'Amount']) || '0'),
    card_time: getCardField(row, ['card_time', '时间', '刷卡时间', 'Time']) || '',
    raw_data: JSON.stringify(row)
  };
}

function normalizeSubsidyRecord(row) {
  return {
    student_id: row.student_id || row.学号 || row.id || '',
    student_name: row.student_name || row.姓名 || row.name || '',
    subsidy_type: row.subsidy_type || row.补贴类型 || row.type || '助学金',
    monthly_limit: parseFloat(row.monthly_limit || row.月度上限 || row.month_limit || '0'),
    daily_limit: parseFloat(row.daily_limit || row.日上限 || row.day_limit || '0'),
    meal_limit: parseInt(row.meal_limit || row.餐次上限 || row.meal_count_limit || '0')
  };
}

function normalizeRefundRecord(row) {
  return {
    student_id: getCardField(row, ['student_id', '学号', '学生ID', 'ID']),
    student_name: getCardField(row, ['student_name', '姓名', '学生姓名', 'Name']),
    refund_date: getCardField(row, ['refund_date', '退款日期', '日期', 'Date']),
    refund_amount: parseFloat(getCardField(row, ['refund_amount', '退款金额', '金额', 'Amount']) || '0'),
    refund_reason: getCardField(row, ['refund_reason', '退款原因', '原因', 'Reason']) || ''
  };
}

function validateCardRecord(record) {
  const issues = [];
  if (!record.student_id) issues.push('缺少学号');
  if (!record.meal_date) issues.push('缺少就餐日期');
  if (!record.amount || isNaN(record.amount)) issues.push('金额无效');
  return issues;
}

function detectDuplicate(studentId, mealDate, mealType, excludeId) {
  const row = db.prepare(`
    SELECT id FROM card_records 
    WHERE student_id = ? AND meal_date = ? AND meal_type = ? AND id != ?
  `).get(studentId, mealDate, mealType, excludeId || -1);
  return row !== undefined;
}

function checkSubsidyLimit(studentId, subsidyMonth, cardAmount) {
  const results = [];

  const subsidy = db.prepare(`
    SELECT * FROM subsidy_lists WHERE student_id = ?
  `).get(studentId);

  if (!subsidy) {
    results.push({ type: 'no_subsidy', message: '学生不在补贴名单中' });
    return { passed: false, results };
  }

  const monthStart = `${subsidyMonth}-01`;
  const monthEnd = new Date(new Date(subsidyMonth + '-01').setMonth(new Date(subsidyMonth + '-01').getMonth() + 1) - 1).toISOString().split('T')[0];

  const usedMonthly = db.prepare(`
    SELECT COALESCE(SUM(final_amount), 0) as total 
    FROM processed_records 
    WHERE student_id = ? AND meal_date >= ? AND meal_date <= ? AND status = 'approved'
  `).get(studentId, monthStart, monthEnd).total;

  if (subsidy.monthly_limit > 0 && (usedMonthly + cardAmount) > subsidy.monthly_limit) {
    results.push({
      type: 'exceed_monthly',
      message: `超出月度补贴上限（已用${usedMonthly.toFixed(2)}，上限${subsidy.monthly_limit.toFixed(2)}）`,
      limit: subsidy.monthly_limit,
      used: usedMonthly,
      requested: cardAmount
    });
  }

  const usedDaily = db.prepare(`
    SELECT COALESCE(SUM(final_amount), 0) as total 
    FROM processed_records 
    WHERE student_id = ? AND meal_date = ? AND status = 'approved'
  `).get(studentId, subsidyMonth + '-01').total;

  if (subsidy.daily_limit > 0 && cardAmount > subsidy.daily_limit) {
    results.push({
      type: 'exceed_daily',
      message: `超出单日补贴上限（上限${subsidy.daily_limit.toFixed(2)}）`,
      limit: subsidy.daily_limit,
      requested: cardAmount
    });
  }

  return { passed: results.length === 0, results, subsidy };
}

function matchRefundToCard(refund) {
  const cards = db.prepare(`
    SELECT * FROM card_records 
    WHERE student_id = ? AND meal_date = ?
    ORDER BY card_time ASC
  `).all(refund.student_id, refund.refund_date);

  if (cards.length === 0) {
    return { matched: false, message: '未找到对应刷卡记录' };
  }

  const existing = db.prepare(`
    SELECT * FROM processed_records 
    WHERE student_id = ? AND meal_date = ? AND refund_applied > 0
  `).all(refund.student_id, refund.refund_date);

  const existingCardIds = existing.map(r => r.card_record_id);
  const available = cards.filter(c => !existingCardIds.includes(c.id));

  if (available.length === 0) {
    return { matched: false, message: '该日期所有刷卡记录已申请退款' };
  }

  const match = available[0];
  return { matched: true, cardRecordId: match.id, message: `匹配到刷卡记录(ID:${match.id})` };
}

module.exports = {
  parseCardCSV,
  parseSubsidyJSON,
  parseRefundCSV,
  normalizeCardRecord,
  normalizeSubsidyRecord,
  normalizeRefundRecord,
  validateCardRecord,
  detectDuplicate,
  checkSubsidyLimit,
  matchRefundToCard
};
