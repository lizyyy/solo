const db = require('./init');

class BaseDAO {
  constructor(tableName) {
    this.tableName = tableName;
  }

  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async create(data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const values = Object.values(data);
    const sql = `INSERT INTO ${this.tableName} (${keys.join(',')}) VALUES (${placeholders})`;
    return this.runQuery(sql, values);
  }

  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    return this.getQuery(sql, [id]);
  }

  async findAll(where = '', params = []) {
    let sql = `SELECT * FROM ${this.tableName}`;
    if (where) sql += ` WHERE ${where}`;
    return this.allQuery(sql, params);
  }

  async update(id, data) {
    const updates = Object.keys(data).map(k => `${k} = ?`).join(',');
    const values = [...Object.values(data), id];
    const sql = `UPDATE ${this.tableName} SET ${updates} WHERE id = ?`;
    return this.runQuery(sql, values);
  }

  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    return this.runQuery(sql, [id]);
  }
}

class StoreDAO extends BaseDAO {
  constructor() { super('stores'); }
  async findByCode(storeCode) {
    return this.getQuery('SELECT * FROM stores WHERE store_code = ?', [storeCode]);
  }
}

class ProductDAO extends BaseDAO {
  constructor() { super('products'); }
  async findByBarcode(barcode) {
    return this.getQuery('SELECT * FROM products WHERE barcode = ?', [barcode]);
  }
}

class PriceVersionDAO extends BaseDAO {
  constructor() { super('price_versions'); }
  async findByVersionCode(versionCode) {
    return this.getQuery('SELECT * FROM price_versions WHERE version_code = ?', [versionCode]);
  }
  async findByBarcode(barcode) {
    return this.allQuery('SELECT * FROM price_versions WHERE barcode = ? ORDER BY created_at DESC', [barcode]);
  }
  async findActiveVersions() {
    return this.allQuery(`
      SELECT pv.*, p.product_name 
      FROM price_versions pv 
      JOIN products p ON pv.barcode = p.barcode 
      WHERE pv.status = 'active' 
      ORDER BY pv.created_at DESC
    `);
  }
}

class PromotionWindowDAO extends BaseDAO {
  constructor() { super('promotion_windows'); }
  async findByCode(promotionCode) {
    return this.getQuery('SELECT * FROM promotion_windows WHERE promotion_code = ?', [promotionCode]);
  }
  async findExpiredPromotions(currentTime) {
    return this.allQuery(`
      SELECT pw.*, pv.version_code, pv.price 
      FROM promotion_windows pw 
      JOIN price_versions pv ON pw.price_version_id = pv.id 
      WHERE pw.end_time <= ? AND pw.status = 'active'
    `, [currentTime]);
  }
}

class ConfirmationDAO extends BaseDAO {
  constructor() { super('confirmations'); }
  async findByCode(confirmationCode) {
    return this.getQuery('SELECT * FROM confirmations WHERE confirmation_code = ?', [confirmationCode]);
  }
  async findByStoreAndVersion(storeCode, priceVersionId) {
    return this.getQuery('SELECT * FROM confirmations WHERE store_code = ? AND price_version_id = ?', [storeCode, priceVersionId]);
  }
}

class DiscrepancyReportDAO extends BaseDAO {
  constructor() { super('discrepancy_reports'); }
  async findByCode(reportCode) {
    return this.getQuery('SELECT * FROM discrepancy_reports WHERE report_code = ?', [reportCode]);
  }
  async findByStatus(status) {
    return this.allQuery('SELECT * FROM discrepancy_reports WHERE status = ? ORDER BY created_at DESC', [status]);
  }
  async findPendingReview() {
    return this.allQuery(`
      SELECT dr.*, s.store_name, p.product_name 
      FROM discrepancy_reports dr 
      JOIN stores s ON dr.store_code = s.store_code 
      JOIN products p ON dr.barcode = p.barcode 
      WHERE dr.status = 'pending_review' 
      ORDER BY dr.created_at DESC
    `);
  }
}

class ExceptionLogDAO extends BaseDAO {
  constructor() { super('exception_logs'); }
  async findByCode(exceptionCode) {
    return this.getQuery('SELECT * FROM exception_logs WHERE exception_code = ?', [exceptionCode]);
  }
  async findPending() {
    return this.allQuery('SELECT * FROM exception_logs WHERE status = ? ORDER BY created_at DESC', ['pending']);
  }
}

class ManualCorrectionDAO extends BaseDAO {
  constructor() { super('manual_corrections'); }
  async findByCode(correctionCode) {
    return this.getQuery('SELECT * FROM manual_corrections WHERE correction_code = ?', [correctionCode]);
  }
}

module.exports = {
  db,
  StoreDAO,
  ProductDAO,
  PriceVersionDAO,
  PromotionWindowDAO,
  ConfirmationDAO,
  DiscrepancyReportDAO,
  ExceptionLogDAO,
  ManualCorrectionDAO
};
