const fs = require('fs');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const db = require('../database');
const validationService = require('./validationService');

class CsvService {
  async parseDeliveryCsv(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowIndex = 0;

      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_')
        }))
        .on('data', (data) => {
          rowIndex++;
          try {
            const item = this.transformRow(data);
            item.row_index = rowIndex;
            results.push(item);
          } catch (e) {
            errors.push({
              row: rowIndex,
              data: data,
              error: e.message
            });
          }
        })
        .on('end', () => {
          resolve({ items: results, parseErrors: errors });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  transformRow(row) {
    const requiredFields = ['product_code', 'product_name', 'batch_no', 'quantity'];
    for (const field of requiredFields) {
      if (!row[field] && !row[field.replace('_', '')]) {
        throw new Error(`缺少必填字段：${field}`);
      }
    }

    return {
      product_code: (row.product_code || row.productcode || '').trim(),
      product_name: (row.product_name || row.productname || '').trim(),
      batch_no: (row.batch_no || row.batchno || '').trim(),
      quantity: parseInt(row.quantity) || 0,
      unit: (row.unit || '支').trim(),
      temperature: row.temperature !== undefined && row.temperature !== '' ? parseFloat(row.temperature) : null,
      receiver_name: (row.receiver_name || row.receivername || '').trim(),
      receiver_phone: (row.receiver_phone || row.receiverphone || '').trim(),
      has_damage: (row.has_damage || row.hasdamage || '0') === '1' || (row.has_damage || '').toLowerCase() === 'true' ? 1 : 0,
      damage_description: (row.damage_description || row.damagedescription || '').trim(),
      damage_photo_path: (row.damage_photo_path || row.damPhotopPath || '').trim(),
      production_date: (row.production_date || row.productiondate || '').trim() || null,
      expiry_date: (row.expiry_date || row.expirydate || '').trim() || null
    };
  }

  async importDeliveryOrder(filePath, orderInfo = {}) {
    const { order_no, supplier, delivery_date, created_by } = orderInfo;
    
    if (!order_no) {
      throw new Error('订单号不能为空');
    }

    const existingOrder = await db.get('SELECT id FROM delivery_orders WHERE order_no = ?', [order_no]);
    if (existingOrder) {
      throw new Error('订单号已存在');
    }

    const { items, parseErrors } = await this.parseDeliveryCsv(filePath);
    
    if (items.length === 0 && parseErrors.length > 0) {
      throw new Error('CSV文件解析失败，没有有效数据');
    }

    const orderResult = await db.run(`
      INSERT INTO delivery_orders (order_no, supplier, delivery_date, status, created_by)
      VALUES (?, ?, ?, 'pending', ?)
    `, [order_no, supplier || '', delivery_date || new Date().toISOString().split('T')[0], created_by || 'system']);
    
    const orderId = orderResult.lastID;

    const validationResult = await validationService.validateBatch(items, orderId);
    
    const itemStmt = await db.prepare(`
      INSERT INTO delivery_items 
      (order_id, product_code, product_name, batch_no, quantity, unit, temperature, 
       receiver_name, receiver_phone, has_damage, damage_description, damage_photo_path,
       production_date, expiry_date, status, validation_result, validation_details, is_valid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const result of validationResult.results) {
      const item = result.item;
      await itemStmt.run([
        orderId,
        item.product_code,
        item.product_name,
        item.batch_no,
        item.quantity,
        item.unit,
        item.temperature,
        item.receiver_name,
        item.receiver_phone,
        item.has_damage,
        item.damage_description,
        item.damage_photo_path,
        item.production_date,
        item.expiry_date,
        result.status,
        result.validationResult,
        result.validationDetails,
        result.isValid ? 1 : 0
      ]);
    }

    await db.run(`
      UPDATE delivery_orders 
      SET total_items = ?, valid_items = ?, invalid_items = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [validationResult.totalCount, validationResult.validCount, validationResult.invalidCount, orderId]);

    return {
      orderId,
      order_no,
      totalItems: validationResult.totalCount,
      validItems: validationResult.validCount,
      invalidItems: validationResult.invalidCount,
      parseErrors,
      validationResults: validationResult.results.map(r => ({
        row_index: r.item.row_index,
        product_code: r.item.product_code,
        product_name: r.item.product_name,
        batch_no: r.item.batch_no,
        is_valid: r.isValid,
        errors: r.errors,
        warnings: r.warnings
      }))
    };
  }

  async exportDeliveryItems(orderId, format = 'json') {
    const items = await db.all(`
      SELECT di.*, do.order_no, do.supplier, do.delivery_date
      FROM delivery_items di
      JOIN delivery_orders do ON di.order_id = do.id
      WHERE di.order_id = ?
      ORDER BY di.id
    `, [orderId]);

    if (format === 'csv') {
      const fields = [
        'order_no', 'supplier', 'delivery_date',
        'product_code', 'product_name', 'batch_no', 'quantity', 'unit',
        'temperature', 'receiver_name', 'receiver_phone',
        'has_damage', 'damage_description',
        'production_date', 'expiry_date',
        'status', 'is_valid'
      ];
      const parser = new Parser({ fields });
      return parser.parse(items);
    }

    return items;
  }

  async exportInventory(format = 'json') {
    const inventory = await db.all('SELECT * FROM inventory ORDER BY product_code, batch_no');
    
    if (format === 'csv') {
      const fields = [
        'product_code', 'product_name', 'batch_no', 'quantity', 'unit',
        'production_date', 'expiry_date', 'created_at'
      ];
      const parser = new Parser({ fields });
      return parser.parse(inventory);
    }

    return inventory;
  }
}

module.exports = new CsvService();
