const fs = require('fs-extra');
const path = require('path');
const { generateBatchId, generatePeriod, dateToISO, safeAmount, hashData } = require('./utils');
const { getDb } = require('./db');

const VALID_IMPORT_TYPES = [
  'stores',
  'staff', 
  'products',
  'promotions',
  'sales',
  'returns',
  'allocations',
  'transfers'
];

function parseCsvSync(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCsvLine(line);
    if (values.length !== headers.length) continue;
    
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx];
    });
    records.push(record);
  }
  
  return records;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function importData(workDir, type, filePath, options = {}) {
  if (!VALID_IMPORT_TYPES.includes(type)) {
    throw new Error(`不支持的导入类型: ${type}。支持的类型: ${VALID_IMPORT_TYPES.join(', ')}`);
  }

  if (!filePath) {
    const defaultPath = path.join(workDir, 'samples', `${type}.csv`);
    if (fs.pathExistsSync(defaultPath)) {
      filePath = defaultPath;
    } else {
      throw new Error('未提供文件路径，且未找到默认样例文件');
    }
  }

  if (!fs.pathExistsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const db = getDb();
  const batchId = generateBatchId(type);
  const operator = options.operator || 'system';

  const recordStmt = db.prepare(`
    INSERT INTO import_records 
    (batch_id, import_type, file_name, status, operator)
    VALUES (?, ?, ?, 'processing', ?)
  `);
  recordStmt.run(batchId, type, path.basename(filePath), operator);

  const failureStmt = db.prepare(`
    INSERT INTO import_failures (batch_id, record_no, error_message, record_data)
    VALUES (?, ?, ?, ?)
  `);

  let records = [];
  try {
    records = parseCsvSync(filePath);
  } catch (err) {
    throw new Error(`读取CSV文件失败: ${err.message}`);
  }

  let successCount = 0;
  let failCount = 0;
  const results = [];

  db.transaction(() => {
    records.forEach((record, index) => {
      const recordNo = index + 1;
      try {
        const result = processRecord(type, record, batchId, operator);
        successCount++;
        results.push(result);
      } catch (err) {
        failCount++;
        failureStmt.run(batchId, recordNo, err.message, JSON.stringify(record));
        results.push({ recordNo, success: false, error: err.message });
      }
    });

    const updateStmt = db.prepare(`
      UPDATE import_records 
      SET record_count = ?, success_count = ?, failed_count = ?, 
          status = ?, completed_at = CURRENT_TIMESTAMP
      WHERE batch_id = ?
    `);
    updateStmt.run(
      records.length,
      successCount,
      failCount,
      failCount === 0 ? 'success' : 'partial',
      batchId
    );
  })();

  return {
    batchId,
    type,
    totalRecords: records.length,
    successCount,
    failCount,
    results,
    message: failCount === 0 
      ? `导入成功，共 ${successCount} 条记录`
      : `导入完成，成功 ${successCount} 条，失败 ${failCount} 条`
  };
}

function processRecord(type, record, batchId, operator) {
  const db = getDb();
  
  switch (type) {
    case 'stores':
      return importStore(record);
    case 'staff':
      return importStaff(record);
    case 'products':
      return importProduct(record);
    case 'promotions':
      return importPromotion(record);
    case 'sales':
      return importSale(record, batchId);
    case 'returns':
      return importReturn(record, batchId);
    case 'allocations':
      return importAllocation(record);
    case 'transfers':
      return importTransfer(record);
    default:
      throw new Error(`未知类型: ${type}`);
  }
}

function importStore(record) {
  const db = getDb();
  validateFields(record, ['store_code', 'store_name']);
  
  const stmt = db.prepare(`
    INSERT INTO stores (store_code, store_name)
    VALUES (?, ?)
    ON CONFLICT(store_code) DO UPDATE SET
      store_name = excluded.store_name
  `);
  stmt.run(record.store_code.trim(), record.store_name.trim());
  
  return { type: 'store', code: record.store_code };
}

function importStaff(record) {
  const db = getDb();
  validateFields(record, ['staff_code', 'staff_name', 'store_code']);
  
  const stmt = db.prepare(`
    INSERT INTO staff (staff_code, staff_name, store_code, role, status)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(staff_code) DO UPDATE SET
      staff_name = excluded.staff_name,
      store_code = excluded.store_code,
      role = excluded.role,
      status = excluded.status
  `);
  stmt.run(
    record.staff_code.trim(),
    record.staff_name.trim(),
    record.store_code.trim(),
    record.role || '导购',
    record.status || 'active'
  );
  
  return { type: 'staff', code: record.staff_code };
}

function importProduct(record) {
  const db = getDb();
  validateFields(record, ['sku', 'product_name', 'category']);
  
  const stmt = db.prepare(`
    INSERT INTO products (sku, product_name, category, base_commission_rate)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(sku) DO UPDATE SET
      product_name = excluded.product_name,
      category = excluded.category,
      base_commission_rate = excluded.base_commission_rate
  `);
  stmt.run(
    record.sku.trim(),
    record.product_name.trim(),
    record.category.trim(),
    safeAmount(record.base_commission_rate, 0.02)
  );
  
  return { type: 'product', sku: record.sku };
}

function importPromotion(record) {
  const db = getDb();
  validateFields(record, ['promotion_code', 'promotion_name', 'start_date', 'end_date', 'discount_type', 'discount_value']);
  
  const stmt = db.prepare(`
    INSERT INTO promotions (
      promotion_code, promotion_name, start_date, end_date,
      discount_type, discount_value, commission_multiplier,
      applies_to_category, applies_to_sku, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(promotion_code) DO UPDATE SET
      promotion_name = excluded.promotion_name,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      discount_type = excluded.discount_type,
      discount_value = excluded.discount_value,
      commission_multiplier = excluded.commission_multiplier,
      applies_to_category = excluded.applies_to_category,
      applies_to_sku = excluded.applies_to_sku,
      is_active = excluded.is_active
  `);
  stmt.run(
    record.promotion_code.trim(),
    record.promotion_name.trim(),
    dateToISO(record.start_date),
    dateToISO(record.end_date),
    record.discount_type.trim(),
    safeAmount(record.discount_value),
    safeAmount(record.commission_multiplier, 1.0),
    record.applies_to_category || null,
    record.applies_to_sku || null,
    record.is_active !== 'false' ? 1 : 0
  );
  
  return { type: 'promotion', code: record.promotion_code };
}

function importSale(record, batchId) {
  const db = getDb();
  validateFields(record, ['order_no', 'order_date', 'store_code', 'total_amount', 'net_amount']);
  
  const existing = db.prepare('SELECT order_no FROM sales_orders WHERE order_no = ?').get(record.order_no.trim());
  if (existing) {
    throw new Error(`订单号已存在: ${record.order_no}`);
  }

  const totalAmount = safeAmount(record.total_amount);
  const discountAmount = safeAmount(record.discount_amount);
  const netAmount = safeAmount(record.net_amount);
  
  if (Math.abs(totalAmount - discountAmount - netAmount) > 0.01) {
    throw new Error(`金额校验失败: 总金额(${totalAmount}) - 折扣(${discountAmount}) != 净额(${netAmount})`);
  }

  const sourceStore = record.source_store_code || record.store_code;
  const isTransfer = sourceStore !== record.store_code ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO sales_orders (
      order_no, order_date, store_code, customer_phone,
      total_amount, discount_amount, net_amount,
      payment_method, status, promotion_code,
      source_store_code, is_transfer_sale, import_batch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    record.order_no.trim(),
    dateToISO(record.order_date),
    record.store_code.trim(),
    record.customer_phone || null,
    totalAmount,
    discountAmount,
    netAmount,
    record.payment_method || null,
    record.status || 'completed',
    record.promotion_code || null,
    sourceStore.trim(),
    isTransfer,
    batchId
  );

  if (record.items) {
    const items = typeof record.items === 'string' ? JSON.parse(record.items) : record.items;
    importSaleItems(record.order_no.trim(), items);
  }

  return { type: 'sale', orderNo: record.order_no };
}

function importSaleItems(orderNo, items) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sales_order_items (
      order_no, line_no, sku, product_name, quantity,
      unit_price, line_total, discount, line_net_amount, commission_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  items.forEach((item, index) => {
    const lineTotal = safeAmount(item.line_total);
    const discount = safeAmount(item.discount);
    const lineNet = safeAmount(item.line_net_amount, lineTotal - discount);
    
    stmt.run(
      orderNo,
      index + 1,
      item.sku.trim(),
      item.product_name || null,
      parseInt(item.quantity) || 1,
      safeAmount(item.unit_price),
      lineTotal,
      discount,
      lineNet,
      safeAmount(item.commission_rate, 0.02)
    );
  });
}

function importReturn(record, batchId) {
  const db = getDb();
  validateFields(record, ['return_no', 'return_date', 'store_code', 'total_amount']);
  
  const existing = db.prepare('SELECT return_no FROM return_orders WHERE return_no = ?').get(record.return_no.trim());
  if (existing) {
    throw new Error(`退货单号已存在: ${record.return_no}`);
  }

  if (record.original_order_no) {
    const original = db.prepare('SELECT order_no, order_date FROM sales_orders WHERE order_no = ?').get(record.original_order_no.trim());
    if (!original) {
      throw new Error(`原销售订单不存在: ${record.original_order_no}`);
    }
    
    const returnPeriod = generatePeriod(record.return_date);
    const originalPeriod = generatePeriod(original.order_date);
    
    if (returnPeriod !== originalPeriod) {
      console.log(`  ⚠️  跨月退货: 原单 ${record.original_order_no} (${originalPeriod}) → 退货 ${record.return_no} (${returnPeriod})`);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO return_orders (
      return_no, original_order_no, return_date,
      store_code, total_amount, reason, status, import_batch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    record.return_no.trim(),
    record.original_order_no ? record.original_order_no.trim() : null,
    dateToISO(record.return_date),
    record.store_code.trim(),
    safeAmount(record.total_amount),
    record.reason || null,
    record.status || 'completed',
    batchId
  );

  return { type: 'return', returnNo: record.return_no };
}

function importAllocation(record) {
  const db = getDb();
  validateFields(record, ['order_no', 'staff_code', 'allocation_ratio']);
  
  const order = db.prepare('SELECT order_no FROM sales_orders WHERE order_no = ?').get(record.order_no.trim());
  if (!order) {
    throw new Error(`销售订单不存在: ${record.order_no}`);
  }

  const staff = db.prepare('SELECT staff_code FROM staff WHERE staff_code = ?').get(record.staff_code.trim());
  if (!staff) {
    throw new Error(`导购不存在: ${record.staff_code}`);
  }

  const ratio = safeAmount(record.allocation_ratio);
  if (ratio <= 0 || ratio > 1) {
    throw new Error(`分摊比例必须在 (0, 1] 之间: ${ratio}`);
  }

  const existingTotal = db.prepare(`
    SELECT COALESCE(SUM(allocation_ratio), 0) as total 
    FROM staff_allocations 
    WHERE order_no = ?
  `).get(record.order_no.trim());

  if (existingTotal.total + ratio > 1.0001) {
    throw new Error(`订单分摊比例总和超过100%: 已有${existingTotal.total}, 新增${ratio}`);
  }

  const stmt = db.prepare(`
    INSERT INTO staff_allocations (
      order_no, staff_code, allocation_ratio, allocation_type, notes
    ) VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    record.order_no.trim(),
    record.staff_code.trim(),
    ratio,
    record.allocation_type || 'normal',
    record.notes || null
  );

  return { type: 'allocation', orderNo: record.order_no, staffCode: record.staff_code };
}

function importTransfer(record) {
  const db = getDb();
  validateFields(record, ['transfer_no', 'transfer_date', 'from_store_code', 'to_store_code', 'sku', 'quantity']);
  
  const existing = db.prepare('SELECT transfer_no FROM store_transfers WHERE transfer_no = ?').get(record.transfer_no.trim());
  if (existing) {
    throw new Error(`调拨单号已存在: ${record.transfer_no}`);
  }

  if (record.from_store_code.trim() === record.to_store_code.trim()) {
    throw new Error('调出和调入门店不能相同');
  }

  const stmt = db.prepare(`
    INSERT INTO store_transfers (
      transfer_no, transfer_date, from_store_code, to_store_code,
      sku, quantity, sale_order_no, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    record.transfer_no.trim(),
    dateToISO(record.transfer_date),
    record.from_store_code.trim(),
    record.to_store_code.trim(),
    record.sku.trim(),
    parseInt(record.quantity) || 1,
    record.sale_order_no || null,
    record.status || 'completed'
  );

  return { type: 'transfer', transferNo: record.transfer_no };
}

function validateFields(record, requiredFields) {
  const missing = requiredFields.filter(field => !record[field] || String(record[field]).trim() === '');
  if (missing.length > 0) {
    throw new Error(`缺少必填字段: ${missing.join(', ')}`);
  }
}

function getImportHistory(workDir, limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT batch_id, import_type, file_name, record_count, 
           success_count, failed_count, status, operator, created_at
    FROM import_records
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

function getImportFailures(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT record_no, error_message, record_data
    FROM import_failures
    WHERE batch_id = ?
    ORDER BY record_no
  `).all(batchId);
}

module.exports = {
  importData,
  getImportHistory,
  getImportFailures,
  VALID_IMPORT_TYPES,
  parseCsvSync
};
