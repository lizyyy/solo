const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const { getOne, getAll } = require('../models/database');
const config = require('../config');

async function queryPackages(params = {}) {
  const { page = 1, pageSize = 20, status, packageType, keyword, startDate, endDate } = params;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let sqlParams = [];

  if (status) {
    where.push('status = ?');
    sqlParams.push(status);
  }
  if (packageType) {
    where.push('package_type = ?');
    sqlParams.push(packageType);
  }
  if (keyword) {
    where.push('(package_code LIKE ? OR package_name LIKE ?)');
    sqlParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (startDate) {
    where.push('created_at >= ?');
    sqlParams.push(startDate);
  }
  if (endDate) {
    where.push('created_at <= ?');
    sqlParams.push(endDate);
  }

  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const [list, total] = await Promise.all([
    getAll(`
      SELECT * FROM packages ${whereSql}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...sqlParams, pageSize, offset]),
    getOne(`SELECT COUNT(*) as count FROM packages ${whereSql}`, sqlParams)
  ]);

  return {
    list: list.map(p => ({
      ...p,
      items: p.items ? JSON.parse(p.items) : []
    })),
    total: total.count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
}

async function getPackageDetail(packageCode) {
  const pkg = await getOne('SELECT * FROM packages WHERE package_code = ?', [packageCode]);
  if (!pkg) return null;

  const logs = await getAll(`
    SELECT * FROM operation_logs 
    WHERE relation_code = ? AND module = 'package'
    ORDER BY created_at DESC
  `, [packageCode]);

  return {
    ...pkg,
    items: pkg.items ? JSON.parse(pkg.items) : [],
    operation_logs: logs
  };
}

async function queryWorkOrders(params = {}) {
  const { page = 1, pageSize = 20, status, storeCode, packageCode, keyword, startDate, endDate } = params;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let sqlParams = [];

  if (status) {
    where.push('order_status = ?');
    sqlParams.push(status);
  }
  if (storeCode) {
    where.push('store_code = ?');
    sqlParams.push(storeCode);
  }
  if (packageCode) {
    where.push('package_code = ?');
    sqlParams.push(packageCode);
  }
  if (keyword) {
    where.push('(order_no LIKE ? OR customer_name LIKE ? OR plate_number LIKE ?)');
    sqlParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (startDate) {
    where.push('order_date >= ?');
    sqlParams.push(startDate);
  }
  if (endDate) {
    where.push('order_date <= ?');
    sqlParams.push(endDate);
  }

  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const [list, total] = await Promise.all([
    getAll(`
      SELECT * FROM work_orders ${whereSql}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...sqlParams, pageSize, offset]),
    getOne(`SELECT COUNT(*) as count FROM work_orders ${whereSql}`, sqlParams)
  ]);

  return {
    list: list.map(o => ({
      ...o,
      items: o.items ? JSON.parse(o.items) : []
    })),
    total: total.count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
}

async function getWorkOrderDetail(orderNo) {
  const order = await getOne('SELECT * FROM work_orders WHERE order_no = ?', [orderNo]);
  if (!order) return null;

  const logs = await getAll(`
    SELECT * FROM operation_logs 
    WHERE relation_code = ? AND module = 'workorder'
    ORDER BY created_at DESC
  `, [orderNo]);

  const stockTransactions = await getAll(`
    SELECT st.*, p.part_name 
    FROM stock_transactions st
    LEFT JOIN parts p ON st.part_code = p.part_code
    WHERE st.relation_type = 'workorder' AND st.relation_id = ?
    ORDER BY st.created_at DESC
  `, [order.id]);

  return {
    ...order,
    items: order.items ? JSON.parse(order.items) : [],
    operation_logs: logs,
    stock_transactions: stockTransactions
  };
}

async function queryParts(params = {}) {
  const { page = 1, pageSize = 20, partType, storeCode, keyword, lowStock } = params;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let sqlParams = [];

  if (partType) {
    where.push('part_type = ?');
    sqlParams.push(partType);
  }
  if (storeCode) {
    where.push('store_code = ?');
    sqlParams.push(storeCode);
  }
  if (keyword) {
    where.push('(part_code LIKE ? OR part_name LIKE ?)');
    sqlParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (lowStock === 'true') {
    where.push('stock_quantity <= safe_stock');
  }

  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const [list, total] = await Promise.all([
    getAll(`
      SELECT * FROM parts ${whereSql}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...sqlParams, pageSize, offset]),
    getOne(`SELECT COUNT(*) as count FROM parts ${whereSql}`, sqlParams)
  ]);

  return {
    list,
    total: total.count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
}

async function getPartDetail(partCode) {
  const part = await getOne('SELECT * FROM parts WHERE part_code = ?', [partCode]);
  if (!part) return null;

  const logs = await getAll(`
    SELECT * FROM operation_logs 
    WHERE relation_code = ? AND module = 'stock'
    ORDER BY created_at DESC
  `, [partCode]);

  const transactions = await getAll(`
    SELECT * FROM stock_transactions 
    WHERE part_code = ?
    ORDER BY created_at DESC
  `, [partCode]);

  return {
    ...part,
    operation_logs: logs,
    stock_transactions: transactions
  };
}

async function queryOperationLogs(params = {}) {
  const { page = 1, pageSize = 20, module, operationType, operator, relationCode, startDate, endDate } = params;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let sqlParams = [];

  if (module) {
    where.push('module = ?');
    sqlParams.push(module);
  }
  if (operationType) {
    where.push('operation_type = ?');
    sqlParams.push(operationType);
  }
  if (operator) {
    where.push('operator = ?');
    sqlParams.push(operator);
  }
  if (relationCode) {
    where.push('relation_code = ?');
    sqlParams.push(relationCode);
  }
  if (startDate) {
    where.push('created_at >= ?');
    sqlParams.push(startDate);
  }
  if (endDate) {
    where.push('created_at <= ?');
    sqlParams.push(endDate);
  }

  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const [list, total] = await Promise.all([
    getAll(`
      SELECT * FROM operation_logs ${whereSql}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...sqlParams, pageSize, offset]),
    getOne(`SELECT COUNT(*) as count FROM operation_logs ${whereSql}`, sqlParams)
  ]);

  return {
    list: list.map(log => ({
      ...log,
      old_value: log.old_value ? JSON.parse(log.old_value) : null,
      new_value: log.new_value ? JSON.parse(log.new_value) : null
    })),
    total: total.count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
}

async function exportToCSV(data, fields, filename) {
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  
  const filepath = path.join(config.exportDir, filename);
  
  if (!fs.existsSync(config.exportDir)) {
    fs.mkdirSync(config.exportDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, csv, 'utf8');
  
  return filepath;
}

async function exportPackages(params = {}) {
  const result = await queryPackages({ ...params, pageSize: 10000 });
  
  const fields = [
    { label: '套餐编码', value: 'package_code' },
    { label: '套餐名称', value: 'package_name' },
    { label: '套餐类型', value: 'package_type' },
    { label: '原价', value: 'original_price' },
    { label: '售价', value: 'sale_price' },
    { label: '有效期开始', value: 'validity_start' },
    { label: '有效期结束', value: 'validity_end' },
    { label: '状态', value: 'status' },
    { label: '创建时间', value: 'created_at' }
  ];
  
  const filename = `packages_${Date.now()}.csv`;
  const filepath = await exportToCSV(result.list, fields, filename);
  
  return { filepath, filename, count: result.list.length };
}

async function exportWorkOrders(params = {}) {
  const result = await queryWorkOrders({ ...params, pageSize: 10000 });
  
  const fields = [
    { label: '工单号', value: 'order_no' },
    { label: '门店', value: 'store_code' },
    { label: '客户姓名', value: 'customer_name' },
    { label: '联系电话', value: 'customer_phone' },
    { label: '车牌号', value: 'plate_number' },
    { label: '车型', value: 'vehicle_model' },
    { label: '套餐编码', value: 'package_code' },
    { label: '订单金额', value: 'order_amount' },
    { label: '实际金额', value: 'actual_amount' },
    { label: '状态', value: 'order_status' },
    { label: '工单日期', value: 'order_date' },
    { label: '备注', value: 'remarks' },
    { label: '创建时间', value: 'created_at' }
  ];
  
  const filename = `workorders_${Date.now()}.csv`;
  const filepath = await exportToCSV(result.list, fields, filename);
  
  return { filepath, filename, count: result.list.length };
}

async function exportParts(params = {}) {
  const result = await queryParts({ ...params, pageSize: 10000 });
  
  const fields = [
    { label: '配件编码', value: 'part_code' },
    { label: '配件名称', value: 'part_name' },
    { label: '配件类型', value: 'part_type' },
    { label: '单位', value: 'unit' },
    { label: '单价', value: 'unit_price' },
    { label: '库存数量', value: 'stock_quantity' },
    { label: '安全库存', value: 'safe_stock' },
    { label: '供应商', value: 'supplier' },
    { label: '门店', value: 'store_code' },
    { label: '创建时间', value: 'created_at' }
  ];
  
  const filename = `parts_${Date.now()}.csv`;
  const filepath = await exportToCSV(result.list, fields, filename);
  
  return { filepath, filename, count: result.list.length };
}

async function exportOperationLogs(params = {}) {
  const result = await queryOperationLogs({ ...params, pageSize: 10000 });
  
  const fields = [
    { label: '操作类型', value: 'operation_type' },
    { label: '模块', value: 'module' },
    { label: '关联编码', value: 'relation_code' },
    { label: '门店', value: 'store_code' },
    { label: '操作人', value: 'operator' },
    { label: '操作原因', value: 'operation_reason' },
    { label: 'IP地址', value: 'ip_address' },
    { label: '操作时间', value: 'created_at' }
  ];
  
  const filename = `operation_logs_${Date.now()}.csv`;
  const filepath = await exportToCSV(result.list, fields, filename);
  
  return { filepath, filename, count: result.list.length };
}

async function exportBatchItems(batchId) {
  const items = await getAll(`
    SELECT * FROM batch_items WHERE batch_id = ?
    ORDER BY created_at DESC
  `, [batchId]);
  
  const batch = await getOne('SELECT * FROM batches WHERE id = ?', [batchId]);
  
  const data = items.map(item => ({
    ...JSON.parse(item.item_data),
    status: item.status,
    process_result: item.process_result,
    operator: item.operator,
    processed_at: item.processed_at
  }));
  
  const fields = Object.keys(data[0] || {}).map(key => ({
    label: key,
    value: key
  }));
  
  const filename = `batch_${batch.batch_no}_${Date.now()}.csv`;
  const filepath = await exportToCSV(data, fields, filename);
  
  return { filepath, filename, count: data.length };
}

module.exports = {
  queryPackages,
  getPackageDetail,
  queryWorkOrders,
  getWorkOrderDetail,
  queryParts,
  getPartDetail,
  queryOperationLogs,
  exportPackages,
  exportWorkOrders,
  exportParts,
  exportOperationLogs,
  exportBatchItems
};
