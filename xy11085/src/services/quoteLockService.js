const db = require('../database');
const moment = require('moment');

class QuoteLockService {
  static calculatePrice(fields) {
    const { width, height, quantity, paper_type, color_mode, double_sided } = fields;
    let basePrice = 0;
    
    const paperPrices = { '铜版纸': 0.8, '双胶纸': 0.5, '哑粉纸': 0.7, '白卡纸': 1.2 };
    const colorPrices = { '单色': 1, '四色': 2.5, '专色': 3 };
    
    const area = (width * height) / 1000000;
    const paperRate = paperPrices[paper_type] || 0.6;
    const colorRate = colorPrices[color_mode] || 1;
    const sideMultiplier = double_sided ? 2 : 1;
    
    basePrice = area * quantity * paperRate * colorRate * sideMultiplier;
    return Math.round(basePrice * 100) / 100;
  }

  static async create(data, operator) {
    return new Promise((resolve, reject) => {
      const originalPrice = this.calculatePrice(data);
      const lockedPrice = data.locked_price || originalPrice;
      const discountRate = originalPrice > 0 ? ((originalPrice - lockedPrice) / originalPrice * 100).toFixed(2) : 0;

      const quoteNo = `QL${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
      
      db.run(`
        INSERT INTO quote_locks (
          quote_no, customer_id, customer_name, store_id, store_name,
          product_type, paper_type, paper_size, width, height, quantity,
          color_mode, double_sided, locked_price, original_price, discount_rate,
          status, responsible_person, lock_date, valid_from, valid_to,
          batch_no, review_conclusion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        quoteNo, data.customer_id, data.customer_name, data.store_id, data.store_name,
        data.product_type, data.paper_type, data.paper_size, data.width, data.height, data.quantity,
        data.color_mode, data.double_sided ? 1 : 0, lockedPrice, originalPrice, discountRate,
        data.status || 'pending', data.responsible_person,
        data.lock_date || moment().format('YYYY-MM-DD'),
        data.valid_from, data.valid_to,
        data.batch_no, data.review_conclusion
      ], function(err) {
        if (err) return reject(err);
        
        db.run(`
          INSERT INTO quote_lock_history (quote_lock_id, quote_no, action, new_value, changed_by)
          VALUES (?, ?, 'create', ?, ?)
        `, [this.lastID, quoteNo, JSON.stringify(data), operator]);
        
        resolve({ id: this.lastID, quote_no: quoteNo, original_price: originalPrice, discount_rate: discountRate });
      });
    });
  }

  static async update(id, data, operator) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM quote_locks WHERE id = ?', [id], (err, oldRecord) => {
        if (err) return reject(err);
        if (!oldRecord) return reject(new Error('记录不存在'));

        const recalcPrice = this.calculatePrice({ ...oldRecord, ...data });
        const lockedPrice = data.locked_price !== undefined ? data.locked_price : oldRecord.locked_price;
        const discountRate = recalcPrice > 0 ? ((recalcPrice - lockedPrice) / recalcPrice * 100).toFixed(2) : 0;

        const sizeChanged = (data.width !== undefined && data.width !== oldRecord.width) ||
                         (data.height !== undefined && data.height !== oldRecord.height);

        db.run(`
          UPDATE quote_locks SET
            customer_id = COALESCE(?, customer_id),
            customer_name = COALESCE(?, customer_name),
            store_id = COALESCE(?, store_id),
            store_name = COALESCE(?, store_name),
            product_type = COALESCE(?, product_type),
            paper_type = COALESCE(?, paper_type),
            paper_size = COALESCE(?, paper_size),
            width = COALESCE(?, width),
            height = COALESCE(?, height),
            quantity = COALESCE(?, quantity),
            color_mode = COALESCE(?, color_mode),
            double_sided = COALESCE(?, double_sided),
            locked_price = ?,
            original_price = ?,
            discount_rate = ?,
            status = COALESCE(?, status),
            responsible_person = COALESCE(?, responsible_person),
            lock_date = COALESCE(?, lock_date),
            valid_from = COALESCE(?, valid_from),
            valid_to = COALESCE(?, valid_to),
            review_conclusion = COALESCE(?, review_conclusion),
            review_by = COALESCE(?, review_by),
            review_time = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1
          WHERE id = ?
        `, [
          data.customer_id, data.customer_name, data.store_id, data.store_name,
          data.product_type, data.paper_type, data.paper_size,
          data.width, data.height, data.quantity,
          data.color_mode, data.double_sided !== undefined ? (data.double_sided ? 1 : 0) : undefined,
          lockedPrice, recalcPrice, discountRate,
          data.status, data.responsible_person, data.lock_date,
          data.valid_from, data.valid_to,
          data.review_conclusion, data.review_by,
          id
        ], (err) => {
          if (err) return reject(err);

          const changes = {};
          Object.keys(data).forEach(key => {
            if (data[key] !== undefined && oldRecord[key] !== data[key]) {
              changes[key] = { old: oldRecord[key], new: data[key] };
            }
          });

          if (sizeChanged && lockedPrice === oldRecord.locked_price) {
            changes.price_note = '尺寸变更但沿用旧锁价';
          }

          db.run(`
            INSERT INTO quote_lock_history (quote_lock_id, quote_no, action, old_value, new_value, changed_by)
            VALUES (?, ?, 'update', ?, ?, ?)
          `, [id, oldRecord.quote_no, JSON.stringify(oldRecord), JSON.stringify(changes), operator]);

          resolve({ success: true, size_changed: sizeChanged, price_unchanged: lockedPrice === oldRecord.locked_price });
        });
      });
    });
  }

  static async query(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM quote_locks WHERE 1=1';
      const params = [];

      if (filters.start_date) {
        sql += ' AND lock_date >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND lock_date <= ?';
        params.push(filters.end_date);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.responsible_person) {
        sql += ' AND responsible_person = ?';
        params.push(filters.responsible_person);
      }
      if (filters.store_id) {
        sql += ' AND store_id = ?';
        params.push(filters.store_id);
      }
      if (filters.customer_id) {
        sql += ' AND customer_id = ?';
        params.push(filters.customer_id);
      }

      sql += ' ORDER BY lock_date DESC, created_at DESC';

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM quote_locks WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  static async getHistory(quoteLockId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM quote_lock_history WHERE quote_lock_id = ? ORDER BY changed_at DESC', [quoteLockId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async batchImport(records, operator) {
    const batchNo = `BATCH${moment().format('YYYYMMDDHHmmss')}`;
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < records.length; i++) {
      try {
        const record = { ...records[i], batch_no: batchNo };
        const result = await this.create(record, operator);
        
        const sizeChanged = records[i].width || records[i].height;
        const usedOldPrice = records[i].locked_price !== undefined;

        results.push({
          row: i + 1, success: true, quote_no: result.quote_no,
          warning: sizeChanged && usedOldPrice ? '尺寸变更但沿用旧锁价' : null
        });
        successCount++;
      } catch (error) {
        results.push({
          row: i + 1, success: false, error: error.message });
        failCount++;
      }
    }

    await new Promise((resolve) => {
      db.run(`
        INSERT INTO import_batches (batch_no, total_count, success_count, fail_count, imported_by)
        VALUES (?, ?, ?, ?, ?)
      `, [batchNo, records.length, successCount, failCount, operator], resolve);
    });

    return { batch_no: batchNo, total: records.length, success: successCount, fail: failCount, details: results };
  }

  static async export(filters = {}) {
    const data = await this.query(filters);
    return data.map(item => ({
      ...item,
      batch_no: item.batch_no || '-',
      review_conclusion: item.review_conclusion || '待复核'
    }));
  }
}

module.exports = QuoteLockService;
