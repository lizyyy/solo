const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getOne, getAll } = require('../models/database');
const { logOperation } = require('../middleware/audit');

async function createBatch(batchType, storeCode, operator, remarks = '', sourceFile = null) {
  const batchNo = `BATCH-${batchType.toUpperCase()}-${Date.now()}`;
  
  const result = await runQuery(`
    INSERT INTO batches (batch_no, batch_type, store_code, operator, remarks, source_file)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [batchNo, batchType, storeCode, operator, remarks, sourceFile]);

  await logOperation({
    operation_type: 'CREATE_BATCH',
    module: 'batch',
    relation_id: result.lastID,
    relation_code: batchNo,
    store_code: storeCode,
    operator: operator,
    operation_reason: `创建${batchType}批次`,
    new_value: { batchNo, batchType, storeCode, remarks }
  });

  return { id: result.lastID, batchNo };
}

async function addBatchItem(batchId, itemType, itemCode, itemData) {
  return runQuery(`
    INSERT INTO batch_items (batch_id, item_type, item_code, item_data)
    VALUES (?, ?, ?, ?)
  `, [batchId, itemType, itemCode, JSON.stringify(itemData)]);
}

async function importPackagesFromCSV(filePath, storeCode, operator) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowCount = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const { id: batchId, batchNo } = await createBatch(
            'package', 
            storeCode, 
            operator, 
            `CSV导入套餐 ${results.length} 条`,
            filePath
          );

          for (const row of results) {
            rowCount++;
            try {
              if (!row.package_code || !row.package_name || !row.package_type) {
                throw new Error(`第${rowCount}行缺少必填字段`);
              }

              await addBatchItem(batchId, 'package', row.package_code, row);
            } catch (err) {
              errors.push({ row: rowCount, error: err.message, data: row });
            }
          }

          await runQuery(`
            UPDATE batches 
            SET total_count = ?, fail_count = ?, status = ?
            WHERE id = ?
          `, [results.length, errors.length, errors.length > 0 ? 'has_errors' : 'pending', batchId]);

          resolve({
            batchId,
            batchNo,
            total: results.length,
            success: results.length - errors.length,
            errors: errors
          });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function importWorkOrdersFromJSON(filePath, storeCode, operator) {
  const content = fs.readFileSync(filePath, 'utf8');
  const orders = JSON.parse(content);
  
  const { id: batchId, batchNo } = await createBatch(
    'workorder', 
    storeCode, 
    operator, 
    `JSON导入工单 ${orders.length} 条`,
    filePath
  );

  const errors = [];

  for (let i = 0; i < orders.length; i++) {
    try {
      const order = orders[i];
      if (!order.order_no || !order.store_code) {
        throw new Error(`第${i + 1}条工单缺少必填字段`);
      }

      await addBatchItem(batchId, 'workorder', order.order_no, order);
    } catch (err) {
      errors.push({ index: i + 1, error: err.message, data: orders[i] });
    }
  }

  await runQuery(`
    UPDATE batches 
    SET total_count = ?, fail_count = ?, status = ?
    WHERE id = ?
  `, [orders.length, errors.length, errors.length > 0 ? 'has_errors' : 'pending', batchId]);

  return {
    batchId,
    batchNo,
    total: orders.length,
    success: orders.length - errors.length,
    errors: errors
  };
}

async function importStockFromCSV(filePath, storeCode, operator) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowCount = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const { id: batchId, batchNo } = await createBatch(
            'stock', 
            storeCode, 
            operator, 
            `CSV导入库存 ${results.length} 条`,
            filePath
          );

          for (const row of results) {
            rowCount++;
            try {
              if (!row.part_code || !row.part_name) {
                throw new Error(`第${rowCount}行缺少必填字段`);
              }

              await addBatchItem(batchId, 'stock', row.part_code, row);
            } catch (err) {
              errors.push({ row: rowCount, error: err.message, data: row });
            }
          }

          await runQuery(`
            UPDATE batches 
            SET total_count = ?, fail_count = ?, status = ?
            WHERE id = ?
          `, [results.length, errors.length, errors.length > 0 ? 'has_errors' : 'pending', batchId]);

          resolve({
            batchId,
            batchNo,
            total: results.length,
            success: results.length - errors.length,
            errors: errors
          });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function processPackageItem(itemId, operator, action, reason = '') {
  const item = await getOne('SELECT * FROM batch_items WHERE id = ?', [itemId]);
  if (!item) throw new Error('批次项不存在');

  const itemData = JSON.parse(item.item_data);

  if (action === 'approve') {
    const existing = await getOne('SELECT id FROM packages WHERE package_code = ?', [itemData.package_code]);
    
    if (existing) {
      await runQuery(`
        UPDATE packages SET
          package_name = ?, package_type = ?, original_price = ?, sale_price = ?,
          validity_start = ?, validity_end = ?, description = ?, items = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE package_code = ?
      `, [
        itemData.package_name,
        itemData.package_type,
        parseFloat(itemData.original_price || 0),
        parseFloat(itemData.sale_price || 0),
        itemData.validity_start || null,
        itemData.validity_end || null,
        itemData.description || '',
        itemData.items || '',
        itemData.package_code
      ]);
    } else {
      await runQuery(`
        INSERT INTO packages 
        (package_code, package_name, package_type, original_price, sale_price,
         validity_start, validity_end, description, items)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        itemData.package_code,
        itemData.package_name,
        itemData.package_type,
        parseFloat(itemData.original_price || 0),
        parseFloat(itemData.sale_price || 0),
        itemData.validity_start || null,
        itemData.validity_end || null,
        itemData.description || '',
        itemData.items || ''
      ]);
    }

    await runQuery(`
      UPDATE batch_items 
      SET status = 'approved', process_result = ?, operator = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason || '审核通过', operator, itemId);

    await logOperation({
      operation_type: 'APPROVE_PACKAGE',
      module: 'package',
      relation_code: itemData.package_code,
      operator: operator,
      operation_reason: reason || '审核通过',
      new_value: itemData
    });
  } else if (action === 'reject') {
    await runQuery(`
      UPDATE batch_items 
      SET status = 'rejected', process_result = ?, operator = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason, operator, itemId);

    await logOperation({
      operation_type: 'REJECT_PACKAGE',
      module: 'package',
      relation_code: itemData.package_code,
      operator: operator,
      operation_reason: reason,
      new_value: itemData
    });
  } else if (action === 'return') {
    await runQuery(`
      UPDATE batch_items 
      SET status = 'returned', process_result = ?, operator = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason, operator, itemId);

    await logOperation({
      operation_type: 'RETURN_PACKAGE',
      module: 'package',
      relation_code: itemData.package_code,
      operator: operator,
      operation_reason: reason,
      new_value: itemData
    });
  }

  await updateBatchStats(item.batch_id);
}

async function processWorkOrderItem(itemId, operator, action, reason = '', updates = {}) {
  const item = await getOne('SELECT * FROM batch_items WHERE id = ?', [itemId]);
  if (!item) throw new Error('批次项不存在');

  let itemData = JSON.parse(item.item_data);

  if (Object.keys(updates).length > 0) {
    itemData = { ...itemData, ...updates };
  }

  if (action === 'approve') {
    const existing = await getOne('SELECT id FROM work_orders WHERE order_no = ?', [itemData.order_no]);
    
    if (existing) {
      await runQuery(`
        UPDATE work_orders SET
          store_code = ?, customer_name = ?, customer_phone = ?, plate_number = ?,
          vehicle_model = ?, package_code = ?, order_amount = ?, actual_amount = ?,
          order_status = ?, order_date = ?, items = ?, remarks = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE order_no = ?
      `, [
        itemData.store_code,
        itemData.customer_name || '',
        itemData.customer_phone || '',
        itemData.plate_number || '',
        itemData.vehicle_model || '',
        itemData.package_code || '',
        parseFloat(itemData.order_amount || 0),
        parseFloat(itemData.actual_amount || 0),
        itemData.order_status || 'pending',
        itemData.order_date || null,
        JSON.stringify(itemData.items || []),
        itemData.remarks || '',
        itemData.order_no
      ]);
    } else {
      await runQuery(`
        INSERT INTO work_orders 
        (order_no, store_code, customer_name, customer_phone, plate_number,
         vehicle_model, package_code, order_amount, actual_amount, order_status,
         order_date, items, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        itemData.order_no,
        itemData.store_code,
        itemData.customer_name || '',
        itemData.customer_phone || '',
        itemData.plate_number || '',
        itemData.vehicle_model || '',
        itemData.package_code || '',
        parseFloat(itemData.order_amount || 0),
        parseFloat(itemData.actual_amount || 0),
        itemData.order_status || 'pending',
        itemData.order_date || null,
        JSON.stringify(itemData.items || []),
        itemData.remarks || ''
      ]);
    }

    await runQuery(`
      UPDATE batch_items 
      SET status = 'approved', process_result = ?, operator = ?, 
          item_data = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason || '审核通过', operator, JSON.stringify(itemData), itemId);

    await logOperation({
      operation_type: 'APPROVE_WORKORDER',
      module: 'workorder',
      relation_code: itemData.order_no,
      store_code: itemData.store_code,
      operator: operator,
      operation_reason: reason || '审核通过',
      new_value: itemData
    });

    if (itemData.package_code && itemData.items) {
      await processPackageUsage(itemData, operator);
    }
  } else if (action === 'reject') {
    await runQuery(`
      UPDATE batch_items 
      SET status = 'rejected', process_result = ?, operator = ?, 
          item_data = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason, operator, JSON.stringify(itemData), itemId);

    await logOperation({
      operation_type: 'REJECT_WORKORDER',
      module: 'workorder',
      relation_code: itemData.order_no,
      store_code: itemData.store_code,
      operator: operator,
      operation_reason: reason,
      new_value: itemData
    });
  } else if (action === 'return') {
    await runQuery(`
      UPDATE batch_items 
      SET status = 'returned', process_result = ?, operator = ?, 
          item_data = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason, operator, JSON.stringify(itemData), itemId);

    await logOperation({
      operation_type: 'RETURN_WORKORDER',
      module: 'workorder',
      relation_code: itemData.order_no,
      store_code: itemData.store_code,
      operator: operator,
      operation_reason: reason,
      new_value: itemData
    });
  }

  await updateBatchStats(item.batch_id);
}

async function processStockItem(itemId, operator, action, reason = '', updates = {}) {
  const item = await getOne('SELECT * FROM batch_items WHERE id = ?', [itemId]);
  if (!item) throw new Error('批次项不存在');

  let itemData = JSON.parse(item.item_data);

  if (Object.keys(updates).length > 0) {
    itemData = { ...itemData, ...updates };
  }

  if (action === 'approve') {
    const existing = await getOne('SELECT * FROM parts WHERE part_code = ?', [itemData.part_code]);
    const newQuantity = parseInt(itemData.stock_quantity || 0);
    
    if (existing) {
      const oldQuantity = existing.stock_quantity;
      
      await runQuery(`
        UPDATE parts SET
          part_name = ?, part_type = ?, unit = ?, unit_price = ?,
          stock_quantity = ?, safe_stock = ?, supplier = ?, store_code = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE part_code = ?
      `, [
        itemData.part_name,
        itemData.part_type || '',
        itemData.unit || '个',
        parseFloat(itemData.unit_price || 0),
        newQuantity,
        parseInt(itemData.safe_stock || 10),
        itemData.supplier || '',
        itemData.store_code || '',
        itemData.part_code
      ]);

      if (newQuantity !== oldQuantity) {
        await runQuery(`
          INSERT INTO stock_transactions 
          (part_code, store_code, transaction_type, quantity, balance_before, 
           balance_after, unit_price, total_amount, operator, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          itemData.part_code,
          itemData.store_code || '',
          'stock_adjust',
          newQuantity - oldQuantity,
          oldQuantity,
          newQuantity,
          parseFloat(itemData.unit_price || 0),
          (newQuantity - oldQuantity) * parseFloat(itemData.unit_price || 0),
          operator,
          reason || '库存调整'
        ]);
      }
    } else {
      await runQuery(`
        INSERT INTO parts 
        (part_code, part_name, part_type, unit, unit_price, stock_quantity, 
         safe_stock, supplier, store_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        itemData.part_code,
        itemData.part_name,
        itemData.part_type || '',
        itemData.unit || '个',
        parseFloat(itemData.unit_price || 0),
        newQuantity,
        parseInt(itemData.safe_stock || 10),
        itemData.supplier || '',
        itemData.store_code || ''
      ]);

      if (newQuantity > 0) {
        await runQuery(`
          INSERT INTO stock_transactions 
          (part_code, store_code, transaction_type, quantity, balance_before, 
           balance_after, unit_price, total_amount, operator, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          itemData.part_code,
          itemData.store_code || '',
          'stock_in',
          newQuantity,
          0,
          newQuantity,
          parseFloat(itemData.unit_price || 0),
          newQuantity * parseFloat(itemData.unit_price || 0),
          operator,
          reason || '初始入库'
        ]);
      }
    }

    await runQuery(`
      UPDATE batch_items 
      SET status = 'approved', process_result = ?, operator = ?, 
          item_data = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason || '审核通过', operator, JSON.stringify(itemData), itemId);

    await logOperation({
      operation_type: 'APPROVE_STOCK',
      module: 'stock',
      relation_code: itemData.part_code,
      store_code: itemData.store_code,
      operator: operator,
      operation_reason: reason || '审核通过',
      new_value: itemData
    });
  } else if (action === 'reject') {
    await runQuery(`
      UPDATE batch_items 
      SET status = 'rejected', process_result = ?, operator = ?, 
          item_data = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason, operator, JSON.stringify(itemData), itemId);

    await logOperation({
      operation_type: 'REJECT_STOCK',
      module: 'stock',
      relation_code: itemData.part_code,
      store_code: itemData.store_code,
      operator: operator,
      operation_reason: reason,
      new_value: itemData
    });
  } else if (action === 'return') {
    await runQuery(`
      UPDATE batch_items 
      SET status = 'returned', process_result = ?, operator = ?, 
          item_data = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, reason, operator, JSON.stringify(itemData), itemId);

    await logOperation({
      operation_type: 'RETURN_STOCK',
      module: 'stock',
      relation_code: itemData.part_code,
      store_code: itemData.store_code,
      operator: operator,
      operation_reason: reason,
      new_value: itemData
    });
  }

  await updateBatchStats(item.batch_id);
}

async function processPackageUsage(orderData, operator) {
  const pkg = await getOne('SELECT * FROM packages WHERE package_code = ?', [orderData.package_code]);
  if (!pkg) return;

  const pkgItems = pkg.items ? JSON.parse(pkg.items) : [];
  const orderItems = orderData.items || [];

  for (const orderItem of orderItems) {
    const pkgItem = pkgItems.find(p => p.part_code === orderItem.part_code);
    if (pkgItem) {
      const part = await getOne('SELECT * FROM parts WHERE part_code = ?', [orderItem.part_code]);
      if (part) {
        const usageQty = orderItem.quantity || 1;
        const oldQty = part.stock_quantity;
        const newQty = Math.max(0, oldQty - usageQty);

        await runQuery(`
          UPDATE parts SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE part_code = ?
        `, [newQty, orderItem.part_code]);

        await runQuery(`
          INSERT INTO stock_transactions 
          (part_code, store_code, transaction_type, quantity, balance_before, 
           balance_after, unit_price, total_amount, relation_type, operator, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderItem.part_code,
          orderData.store_code,
          'stock_out',
          -usageQty,
          oldQty,
          newQty,
          part.unit_price,
          -usageQty * part.unit_price,
          'workorder',
          operator,
          `工单${orderData.order_no}使用套餐${orderData.package_code}`
        ]);

        await logOperation({
          operation_type: 'STOCK_DEDUCT',
          module: 'stock',
          relation_code: orderItem.part_code,
          store_code: orderData.store_code,
          operator: operator,
          operation_reason: `工单${orderData.order_no}扣减库存`,
          old_value: { stock_quantity: oldQty },
          new_value: { stock_quantity: newQty, usageQty }
        });
      }
    }
  }
}

async function updateBatchStats(batchId) {
  const stats = await getOne(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM batch_items 
    WHERE batch_id = ?
  `, [batchId]);

  let status = 'processing';
  if (stats.pending === 0) {
    status = stats.rejected > 0 || stats.returned > 0 ? 'completed_with_issues' : 'completed';
  }

  await runQuery(`
    UPDATE batches 
    SET total_count = ?, success_count = ?, fail_count = ?, 
        status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [stats.total, stats.approved, stats.rejected + stats.returned, status, batchId]);
}

async function getBatchList(params = {}) {
  const { page = 1, pageSize = 20, status, batchType, storeCode, keyword } = params;
  const offset = (page - 1) * pageSize;
  
  let where = [];
  let sqlParams = [];

  if (status) {
    where.push('status = ?');
    sqlParams.push(status);
  }
  if (batchType) {
    where.push('batch_type = ?');
    sqlParams.push(batchType);
  }
  if (storeCode) {
    where.push('store_code = ?');
    sqlParams.push(storeCode);
  }
  if (keyword) {
    where.push('batch_no LIKE ?');
    sqlParams.push(`%${keyword}%`);
  }

  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const [list, total] = await Promise.all([
    getAll(`
      SELECT * FROM batches ${whereSql}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...sqlParams, pageSize, offset]),
    getOne(`SELECT COUNT(*) as count FROM batches ${whereSql}`, sqlParams)
  ]);

  return {
    list,
    total: total.count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
}

async function getBatchItems(batchId, params = {}) {
  const { status, keyword } = params;
  
  let where = ['batch_id = ?'];
  let sqlParams = [batchId];

  if (status) {
    where.push('status = ?');
    sqlParams.push(status);
  }

  const whereSql = 'WHERE ' + where.join(' AND ');

  const items = await getAll(`
    SELECT * FROM batch_items ${whereSql}
    ORDER BY created_at DESC
  `, sqlParams);

  return items.map(item => ({
    ...item,
    item_data: JSON.parse(item.item_data)
  }));
}

module.exports = {
  createBatch,
  addBatchItem,
  importPackagesFromCSV,
  importWorkOrdersFromJSON,
  importStockFromCSV,
  processPackageItem,
  processWorkOrderItem,
  processStockItem,
  getBatchList,
  getBatchItems
};
