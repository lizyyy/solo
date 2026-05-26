const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

async function clearBatchData(batchId) {
  await db.run('DELETE FROM package_items WHERE package_id IN (SELECT id FROM packages WHERE reconciliation_batch_id = ?)', [batchId]);
  await db.run('DELETE FROM packages WHERE reconciliation_batch_id = ?', [batchId]);
  await db.run('DELETE FROM work_order_items WHERE work_order_id IN (SELECT id FROM work_orders WHERE reconciliation_batch_id = ?)', [batchId]);
  await db.run('DELETE FROM work_orders WHERE reconciliation_batch_id = ?', [batchId]);
  await db.run('DELETE FROM inventory WHERE reconciliation_batch_id = ?', [batchId]);
}

async function importPackagesFromCsv(filePath, batchId, storeId, clearExisting = true) {
  if (clearExisting) {
    await clearBatchData(batchId);
  }

  const results = [];
  const errors = [];
  let successCount = 0;
  let failCount = 0;
  const packageCodeMap = new Map();

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (let i = 0; i < results.length; i++) {
          try {
            const row = results[i];
            const validation = validatePackageRow(row, i + 2);
            
            if (!validation.valid) {
              errors.push(...validation.errors);
              failCount++;
              continue;
            }

            const packageCode = row.package_code || row.套餐编号;
            const packageId = uuidv4();
            
            const existing = await db.get('SELECT id FROM packages WHERE package_code = ?', [packageCode]);
            if (existing) {
              await db.run(`
                UPDATE packages SET 
                  name = ?, customer_name = ?, customer_phone = ?,
                  purchase_store_id = ?, purchase_date = ?, total_amount = ?,
                  original_amount = ?, status = ?, valid_from = ?, valid_to = ?,
                  reconciliation_batch_id = ?
                WHERE id = ?
              `, [
                row.name || row.套餐名称,
                row.customer_name || row.客户姓名,
                row.customer_phone || row.客户电话,
                row.purchase_store_id || storeId,
                row.purchase_date || row.购买日期,
                parseFloat(row.total_amount || row.总金额 || 0),
                parseFloat(row.original_amount || row.原价 || 0),
                row.status || 'active',
                row.valid_from || row.有效期开始,
                row.valid_to || row.有效期结束,
                batchId,
                existing.id
              ]);
              packageCodeMap.set(packageCode, existing.id);
            } else {
              await db.run(`
                INSERT INTO packages (id, package_code, name, customer_name, customer_phone, 
                  purchase_store_id, purchase_date, total_amount, original_amount, status, 
                  valid_from, valid_to, reconciliation_batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                packageId,
                packageCode,
                row.name || row.套餐名称,
                row.customer_name || row.客户姓名,
                row.customer_phone || row.客户电话,
                row.purchase_store_id || storeId,
                row.purchase_date || row.购买日期,
                parseFloat(row.total_amount || row.总金额 || 0),
                parseFloat(row.original_amount || row.原价 || 0),
                row.status || 'active',
                row.valid_from || row.有效期开始,
                row.valid_to || row.有效期结束,
                batchId
              ]);
              packageCodeMap.set(packageCode, packageId);
            }

            const actualPkgId = existing ? existing.id : packageId;
            
            await db.run('DELETE FROM package_items WHERE package_id = ?', [actualPkgId]);
            
            const itemsStr = row.items || row.项目明细;
            if (itemsStr) {
              const items = parseItemsString(itemsStr);
              for (const item of items) {
                await db.run(`
                  INSERT INTO package_items (id, package_id, item_type, item_code, item_name, 
                    quantity, unit_price, total_price, used_quantity, remaining_quantity)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  uuidv4(),
                  actualPkgId,
                  item.type || 'service',
                  item.code,
                  item.name,
                  item.quantity || 1,
                  item.unitPrice || 0,
                  item.totalPrice || 0,
                  item.usedQuantity || 0,
                  item.remainingQuantity || item.quantity || 0
                ]);
              }
            }

            successCount++;
          } catch (e) {
            errors.push(`第${i + 2}行导入失败: ${e.message}`);
            failCount++;
          }
        }
        resolve({ success: true, successCount, failCount, errors, packageCodeMap: Object.fromEntries(packageCodeMap) });
      })
      .on('error', reject);
  });
}

async function importWorkOrdersFromJson(filePath, batchId, storeId, clearExisting = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  
  try {
    data = JSON.parse(content);
  } catch (e) {
    return { success: false, error: 'JSON格式解析失败: ' + e.message };
  }

  const allPackages = await db.all('SELECT id, package_code FROM packages');
  const pkgCodeToId = new Map(allPackages.map(p => [p.package_code, p.id]));

  const workOrders = Array.isArray(data) ? data : (data.workOrders || data.orders || [data]);
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (let i = 0; i < workOrders.length; i++) {
    try {
      const wo = workOrders[i];
      const validation = validateWorkOrder(wo, i + 1);
      
      if (!validation.valid) {
        errors.push(...validation.errors);
        failCount++;
        continue;
      }

      const orderNo = wo.order_no || wo.orderNo || wo.工单号;
      const existing = await db.get('SELECT id FROM work_orders WHERE order_no = ?', [orderNo]);
      const orderId = existing ? existing.id : uuidv4();

      if (existing) {
        await db.run(`
          UPDATE work_orders SET
            customer_name = ?, customer_phone = ?, store_id = ?,
            service_advisor = ?, order_date = ?, finish_date = ?,
            total_amount = ?, paid_amount = ?, status = ?,
            payment_method = ?, remarks = ?, reconciliation_batch_id = ?
          WHERE id = ?
        `, [
          wo.customer_name || wo.customerName || wo.客户姓名,
          wo.customer_phone || wo.customerPhone || wo.客户电话,
          wo.store_id || storeId,
          wo.service_advisor || wo.serviceAdvisor || wo.服务顾问,
          wo.order_date || wo.orderDate || wo.开单日期,
          wo.finish_date || wo.finishDate || wo.完成日期,
          parseFloat(wo.total_amount || wo.totalAmount || wo.总金额 || 0),
          parseFloat(wo.paid_amount || wo.paidAmount || wo.实付金额 || 0),
          wo.status || 'completed',
          wo.payment_method || wo.paymentMethod || wo.支付方式,
          wo.remarks || wo.备注,
          batchId,
          orderId
        ]);
      } else {
        await db.run(`
          INSERT INTO work_orders (id, order_no, customer_name, customer_phone, store_id, 
            service_advisor, order_date, finish_date, total_amount, paid_amount, status, 
            payment_method, remarks, reconciliation_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          orderNo,
          wo.customer_name || wo.customerName || wo.客户姓名,
          wo.customer_phone || wo.customerPhone || wo.客户电话,
          wo.store_id || storeId,
          wo.service_advisor || wo.serviceAdvisor || wo.服务顾问,
          wo.order_date || wo.orderDate || wo.开单日期,
          wo.finish_date || wo.finishDate || wo.完成日期,
          parseFloat(wo.total_amount || wo.totalAmount || wo.总金额 || 0),
          parseFloat(wo.paid_amount || wo.paidAmount || wo.实付金额 || 0),
          wo.status || 'completed',
          wo.payment_method || wo.paymentMethod || wo.支付方式,
          wo.remarks || wo.备注,
          batchId
        ]);
      }

      await db.run('DELETE FROM work_order_items WHERE work_order_id = ?', [orderId]);

      const items = wo.items || wo.明细 || [];
      for (const item of items) {
        let relatedPkgId = item.related_package_id || item.relatedPackageId || null;
        if (relatedPkgId && pkgCodeToId.has(relatedPkgId)) {
          relatedPkgId = pkgCodeToId.get(relatedPkgId);
        }

        await db.run(`
          INSERT INTO work_order_items (id, work_order_id, item_type, item_code, item_name, 
            quantity, unit_price, total_price, is_package_item, related_package_id, 
            replaced_from_item_code, replacement_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          orderId,
          item.type || item.item_type || item.项目类型 || 'service',
          item.code || item.item_code || item.项目编码,
          item.name || item.item_name || item.项目名称,
          item.quantity || item.数量 || 1,
          parseFloat(item.unit_price || item.unitPrice || item.单价 || 0),
          parseFloat(item.total_price || item.totalPrice || item.金额 || 0),
          item.is_package_item ? 1 : 0,
          relatedPkgId,
          item.replaced_from || item.replacedFrom || item.replaced_from_item_code || null,
          item.replacement_reason || item.replacementReason || null
        ]);
      }

      successCount++;
    } catch (e) {
      errors.push(`第${i + 1}条工单导入失败: ${e.message}`);
      failCount++;
    }
  }

  return { success: true, successCount, failCount, errors };
}

async function importInventoryFromCsv(filePath, batchId, storeId, clearExisting = false) {
  const results = [];
  const errors = [];
  let successCount = 0;
  let failCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (let i = 0; i < results.length; i++) {
          try {
            const row = results[i];
            const validation = validateInventoryRow(row, i + 2);
            
            if (!validation.valid) {
              errors.push(...validation.errors);
              failCount++;
              continue;
            }

            const partCode = row.part_code || row.配件编码;
            const invDate = row.inventory_date || row.盘点日期;
            const actualStoreId = row.store_id || storeId;

            const existing = await db.get(
              'SELECT id FROM inventory WHERE store_id = ? AND part_code = ? AND inventory_date = ?',
              [actualStoreId, partCode, invDate]
            );
            const invId = existing ? existing.id : uuidv4();

            if (existing) {
              await db.run(`
                UPDATE inventory SET
                  part_name = ?, category = ?, unit = ?, unit_price = ?,
                  opening_quantity = ?, purchased_quantity = ?, used_quantity = ?,
                  adjusted_quantity = ?, closing_quantity = ?, reconciliation_batch_id = ?
                WHERE id = ?
              `, [
                row.part_name || row.配件名称,
                row.category || row.分类,
                row.unit || row.单位,
                parseFloat(row.unit_price || row.单价 || 0),
                parseInt(row.opening_quantity || row.期初数量 || 0),
                parseInt(row.purchased_quantity || row.入库数量 || 0),
                parseInt(row.used_quantity || row.出库数量 || 0),
                parseInt(row.adjusted_quantity || row.调整数量 || 0),
                parseInt(row.closing_quantity || row.结存数量 || 0),
                batchId,
                invId
              ]);
            } else {
              await db.run(`
                INSERT INTO inventory (id, store_id, part_code, part_name, category, unit, 
                  unit_price, opening_quantity, purchased_quantity, used_quantity, 
                  adjusted_quantity, closing_quantity, inventory_date, reconciliation_batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                invId,
                actualStoreId,
                partCode,
                row.part_name || row.配件名称,
                row.category || row.分类,
                row.unit || row.单位,
                parseFloat(row.unit_price || row.单价 || 0),
                parseInt(row.opening_quantity || row.期初数量 || 0),
                parseInt(row.purchased_quantity || row.入库数量 || 0),
                parseInt(row.used_quantity || row.出库数量 || 0),
                parseInt(row.adjusted_quantity || row.调整数量 || 0),
                parseInt(row.closing_quantity || row.结存数量 || 0),
                invDate,
                batchId
              ]);
            }

            successCount++;
          } catch (e) {
            errors.push(`第${i + 2}行导入失败: ${e.message}`);
            failCount++;
          }
        }
        resolve({ success: true, successCount, failCount, errors });
      })
      .on('error', reject);
  });
}

function validatePackageRow(row, lineNum) {
  const errors = [];
  
  if (!row.package_code && !row.套餐编号) {
    errors.push(`第${lineNum}行缺少套餐编号`);
  }
  if (!row.name && !row.套餐名称) {
    errors.push(`第${lineNum}行缺少套餐名称`);
  }

  return { valid: errors.length === 0, errors };
}

function validateWorkOrder(wo, index) {
  const errors = [];
  
  if (!wo.order_no && !wo.orderNo && !wo.工单号) {
    errors.push(`第${index}条工单缺少工单号`);
  }

  return { valid: errors.length === 0, errors };
}

function validateInventoryRow(row, lineNum) {
  const errors = [];
  
  if (!row.part_code && !row.配件编码) {
    errors.push(`第${lineNum}行缺少配件编码`);
  }
  if (!row.part_name && !row.配件名称) {
    errors.push(`第${lineNum}行缺少配件名称`);
  }

  return { valid: errors.length === 0, errors };
}

function parseItemsString(str) {
  try {
    if (!str) return [];
    
    let cleaned = str.trim();
    
    if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
      if (cleaned.includes('\\"')) {
        cleaned = cleaned.replace(/\\"/g, '"');
      }
      return JSON.parse(cleaned);
    }
    
    const items = str.split(';').map(itemStr => {
      const parts = itemStr.split(',');
      const item = {};
      for (const part of parts) {
        const [key, value] = part.split(':');
        if (key && value) {
          item[key.trim()] = value.trim();
        }
      }
      return item;
    });
    return items;
  } catch (e) {
    return [];
  }
}

module.exports = {
  importPackagesFromCsv,
  importWorkOrdersFromJson,
  importInventoryFromCsv,
  clearBatchData
};
