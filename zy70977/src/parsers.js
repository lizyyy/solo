const fs = require('fs');
const csv = require('csv-parser');

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseJSON(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return reject(err);
      try {
        const parsed = JSON.parse(data);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function parseRentalCSV(filePath) {
  return parseCSV(filePath).then(rows => rows.map(row => ({
    order_no: row.order_no || row.订单号 || '',
    device_id: row.device_id || row.设备编号 || '',
    customer_name: row.customer_name || row.客户姓名 || '',
    customer_phone: row.customer_phone || row.客户电话 || '',
    rental_start_date: row.rental_start_date || row.租赁开始日期 || '',
    rental_end_date: row.rental_end_date || row.租赁结束日期 || '',
    daily_rent: parseFloat(row.daily_rent || row.日租金 || '0'),
    deposit_amount: parseFloat(row.deposit_amount || row.押金金额 || '0'),
    status: row.status || row.状态 || 'active',
    raw: row
  })));
}

function parseRepairJSON(filePath) {
  return parseJSON(filePath).then(rows => rows.map(row => ({
    repair_no: row.repair_no || row.维修单号 || '',
    device_id: row.device_id || row.设备编号 || '',
    rental_order_no: row.rental_order_no || row.关联订单号 || '',
    repair_date: row.repair_date || row.维修日期 || '',
    repair_type: row.repair_type || row.维修类型 || '',
    repair_cost: parseFloat(row.repair_cost || row.维修费用 || '0'),
    liability: row.liability || row.责任方 || '',
    description: row.description || row.维修描述 || '',
    status: row.status || row.状态 || 'pending',
    raw: row
  })));
}

function parseDepositRules(filePath) {
  return parseJSON(filePath).then(rows => rows.map(row => ({
    rule_code: row.rule_code || row.规则编码 || '',
    rule_name: row.rule_name || row.规则名称 || '',
    rule_type: row.rule_type || row.规则类型 || '',
    condition_expr: row.condition_expr || row.条件表达式 || '',
    deduction_amount: parseFloat(row.deduction_amount || row.扣减金额 || '0'),
    deduction_percent: parseFloat(row.deduction_percent || row.扣减比例 || '0'),
    priority: parseInt(row.priority || row.优先级 || '0'),
    description: row.description || row.描述 || '',
    is_active: row.is_active !== undefined ? (row.is_active ? 1 : 0) : 1,
    raw: row
  })));
}

module.exports = {
  parseCSV,
  parseJSON,
  parseRentalCSV,
  parseRepairJSON,
  parseDepositRules
};
