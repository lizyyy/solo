const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'data.db'));
    this.initialized = false;
    this.init();
  }

  async init() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        endpoint TEXT,
        payload TEXT,
        response TEXT,
        created_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        contract_no TEXT UNIQUE,
        vendor_name TEXT,
        vendor_id TEXT,
        base_price REAL,
        overtime_rate REAL,
        repair_hours_limit INTEGER,
        effective_date TEXT,
        expiry_date TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS contract_history (
        id TEXT PRIMARY KEY,
        contract_id TEXT,
        field TEXT,
        old_value TEXT,
        new_value TEXT,
        modified_by TEXT,
        modified_at TEXT,
        reason TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS work_orders (
        id TEXT PRIMARY KEY,
        order_no TEXT UNIQUE,
        contract_id TEXT,
        asset_name TEXT,
        asset_id TEXT,
        fault_description TEXT,
        vendor_name TEXT,
        vendor_id TEXT,
        assigned_worker TEXT,
        scheduled_at TEXT,
        arrived_at TEXT,
        completed_at TEXT,
        actual_hours REAL,
        base_amount REAL,
        overtime_amount REAL,
        deduction_amount REAL,
        total_amount REAL,
        status TEXT,
        created_by TEXT,
        reviewed_by TEXT,
        created_at TEXT,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS work_order_status_history (
        id TEXT PRIMARY KEY,
        work_order_id TEXT,
        old_status TEXT,
        new_status TEXT,
        changed_by TEXT,
        changed_at TEXT,
        remark TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS work_order_history (
        id TEXT PRIMARY KEY,
        work_order_id TEXT,
        field TEXT,
        old_value TEXT,
        new_value TEXT,
        modified_by TEXT,
        modified_at TEXT,
        reason TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS arrival_photos (
        id TEXT PRIMARY KEY,
        work_order_id TEXT,
        photo_url TEXT,
        photo_name TEXT,
        uploaded_by TEXT,
        uploaded_at TEXT,
        is_primary INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS arrival_photos_history (
        id TEXT PRIMARY KEY,
        photo_id TEXT,
        work_order_id TEXT,
        old_photo_url TEXT,
        new_photo_url TEXT,
        old_photo_name TEXT,
        new_photo_name TEXT,
        modified_by TEXT,
        modified_at TEXT,
        reason TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS overtime_deductions (
        id TEXT PRIMARY KEY,
        work_order_id TEXT,
        overtime_hours REAL,
        overtime_rate REAL,
        deduction_amount REAL,
        deduction_reason TEXT,
        verified_by TEXT,
        verified_at TEXT,
        created_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS evidence_missing_records (
        id TEXT PRIMARY KEY,
        work_order_id TEXT,
        missing_type TEXT,
        description TEXT,
        severity TEXT,
        responsible_person TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS rework_relations (
        id TEXT PRIMARY KEY,
        original_work_order_id TEXT,
        rework_work_order_id TEXT,
        relation_type TEXT,
        reason TEXT,
        created_by TEXT,
        created_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS outsourcing_bills (
        id TEXT PRIMARY KEY,
        bill_no TEXT UNIQUE,
        contract_id TEXT,
        work_order_ids TEXT,
        vendor_name TEXT,
        vendor_id TEXT,
        base_total REAL,
        overtime_total REAL,
        deduction_total REAL,
        final_amount REAL,
        status TEXT,
        created_by TEXT,
        approved_by TEXT,
        created_at TEXT,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS outsourcing_bill_items (
        id TEXT PRIMARY KEY,
        bill_id TEXT,
        work_order_id TEXT,
        base_amount REAL,
        overtime_amount REAL,
        deduction_amount REAL,
        total_amount REAL
      )`
    ];

    for (const sql of tables) {
      await new Promise((resolve, reject) => {
        this.db.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    this.initialized = true;
  }

  async waitForInit() {
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async run(sql, params = []) {
    await this.waitForInit();
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    await this.waitForInit();
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    await this.waitForInit();
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async checkIdempotency(key) {
    return this.get('SELECT * FROM idempotency_keys WHERE key = ?', [key]);
  }

  async saveIdempotency(key, endpoint, payload, response) {
    return this.run(
      'INSERT INTO idempotency_keys (key, endpoint, payload, response, created_at) VALUES (?, ?, ?, ?, ?)',
      [key, endpoint, JSON.stringify(payload), JSON.stringify(response), moment().format()]
    );
  }

  async createContract(data) {
    const id = require('uuid').v4();
    const now = moment().format();
    await this.run(
      `INSERT INTO contracts (id, contract_no, vendor_name, vendor_id, base_price, overtime_rate, 
        repair_hours_limit, effective_date, expiry_date, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.contract_no, data.vendor_name, data.vendor_id, data.base_price, data.overtime_rate,
       data.repair_hours_limit, data.effective_date, data.expiry_date, data.status || 'active', now, now]
    );
    return this.getContract(id);
  }

  async getContract(id) {
    return this.get('SELECT * FROM contracts WHERE id = ?', [id]);
  }

  async getContractByNo(contractNo) {
    return this.get('SELECT * FROM contracts WHERE contract_no = ?', [contractNo]);
  }

  async getAllContracts() {
    return this.all('SELECT * FROM contracts ORDER BY created_at DESC');
  }

  async updateContract(id, data, modifiedBy, reason) {
    const existing = await this.getContract(id);
    if (!existing) return null;

    const now = moment().format();
    const updates = [];
    const params = [];

    Object.keys(data).forEach(key => {
      if (existing[key] !== undefined && existing[key] !== data[key]) {
        updates.push(`${key} = ?`);
        params.push(data[key]);
        
        this.run(
          `INSERT INTO contract_history (id, contract_id, field, old_value, new_value, modified_by, modified_at, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [require('uuid').v4(), id, key, String(existing[key]), String(data[key]), modifiedBy, now, reason]
        );
      }
    });

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);
      await this.run(`UPDATE contracts SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getContract(id);
  }

  async createWorkOrder(data) {
    const id = require('uuid').v4();
    const now = moment().format();
    await this.run(
      `INSERT INTO work_orders (id, order_no, contract_id, asset_name, asset_id, fault_description,
        vendor_name, vendor_id, assigned_worker, scheduled_at, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.order_no, data.contract_id, data.asset_name, data.asset_id, data.fault_description,
       data.vendor_name, data.vendor_id, data.assigned_worker, data.scheduled_at,
       data.status || 'pending', data.created_by, now, now]
    );

    await this.run(
      `INSERT INTO work_order_status_history (id, work_order_id, old_status, new_status, changed_by, changed_at, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [require('uuid').v4(), id, null, data.status || 'pending', data.created_by, now, '工单创建']
    );

    return this.getWorkOrder(id);
  }

  async getWorkOrder(id) {
    return this.get('SELECT * FROM work_orders WHERE id = ?', [id]);
  }

  async getWorkOrderByNo(orderNo) {
    return this.get('SELECT * FROM work_orders WHERE order_no = ?', [orderNo]);
  }

  async getAllWorkOrders() {
    return this.all('SELECT * FROM work_orders ORDER BY created_at DESC');
  }

  async updateWorkOrderStatus(id, newStatus, changedBy, remark) {
    const existing = await this.getWorkOrder(id);
    if (!existing) return null;

    const now = moment().format();
    await this.run(
      `INSERT INTO work_order_status_history (id, work_order_id, old_status, new_status, changed_by, changed_at, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [require('uuid').v4(), id, existing.status, newStatus, changedBy, now, remark]
    );

    await this.run(
      'UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?',
      [newStatus, now, id]
    );

    return this.getWorkOrder(id);
  }

  async updateWorkOrder(id, data, modifiedBy, reason) {
    const existing = await this.getWorkOrder(id);
    if (!existing) return null;

    const now = moment().format();
    const updates = [];
    const params = [];

    Object.keys(data).forEach(key => {
      if (existing[key] !== undefined && existing[key] !== data[key]) {
        updates.push(`${key} = ?`);
        params.push(data[key]);
        
        this.run(
          `INSERT INTO work_order_history (id, work_order_id, field, old_value, new_value, modified_by, modified_at, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [require('uuid').v4(), id, key, String(existing[key]), String(data[key]), modifiedBy, now, reason]
        );
      }
    });

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);
      await this.run(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getWorkOrder(id);
  }

  async addArrivalPhoto(data) {
    const id = require('uuid').v4();
    const now = moment().format();
    await this.run(
      `INSERT INTO arrival_photos (id, work_order_id, photo_url, photo_name, uploaded_by, uploaded_at, is_primary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.work_order_id, data.photo_url, data.photo_name, data.uploaded_by, now, data.is_primary || 0]
    );
    return this.getArrivalPhoto(id);
  }

  async getArrivalPhoto(id) {
    return this.get('SELECT * FROM arrival_photos WHERE id = ?', [id]);
  }

  async getArrivalPhotosByWorkOrder(workOrderId) {
    return this.all('SELECT * FROM arrival_photos WHERE work_order_id = ? ORDER BY uploaded_at DESC', [workOrderId]);
  }

  async updateArrivalPhoto(id, data, modifiedBy, reason) {
    const existing = await this.getArrivalPhoto(id);
    if (!existing) return null;

    const now = moment().format();
    
    if ((data.photo_url && existing.photo_url !== data.photo_url) || 
        (data.photo_name && existing.photo_name !== data.photo_name)) {
      await this.run(
        `INSERT INTO arrival_photos_history (id, photo_id, work_order_id, old_photo_url, new_photo_url,
          old_photo_name, new_photo_name, modified_by, modified_at, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [require('uuid').v4(), id, existing.work_order_id, existing.photo_url, data.photo_url || existing.photo_url,
         existing.photo_name, data.photo_name || existing.photo_name, modifiedBy, now, reason]
      );
    }

    const updates = [];
    const params = [];
    if (data.photo_url) { updates.push('photo_url = ?'); params.push(data.photo_url); }
    if (data.photo_name) { updates.push('photo_name = ?'); params.push(data.photo_name); }
    
    if (updates.length > 0) {
      params.push(id);
      await this.run(`UPDATE arrival_photos SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getArrivalPhoto(id);
  }

  async createOvertimeDeduction(data) {
    const id = require('uuid').v4();
    const now = moment().format();
    await this.run(
      `INSERT INTO overtime_deductions (id, work_order_id, overtime_hours, overtime_rate, deduction_amount,
        deduction_reason, verified_by, verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.work_order_id, data.overtime_hours, data.overtime_rate, data.deduction_amount,
       data.deduction_reason, data.verified_by, data.verified_at || now, now]
    );
    return this.getOvertimeDeduction(id);
  }

  async getOvertimeDeduction(id) {
    return this.get('SELECT * FROM overtime_deductions WHERE id = ?', [id]);
  }

  async getOvertimeDeductionsByWorkOrder(workOrderId) {
    return this.all('SELECT * FROM overtime_deductions WHERE work_order_id = ?', [workOrderId]);
  }

  async createEvidenceMissing(data) {
    const id = require('uuid').v4();
    const now = moment().format();
    await this.run(
      `INSERT INTO evidence_missing_records (id, work_order_id, missing_type, description, severity,
        responsible_person, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.work_order_id, data.missing_type, data.description, data.severity,
       data.responsible_person, data.status || 'pending', now, now]
    );
    return this.getEvidenceMissing(id);
  }

  async getEvidenceMissing(id) {
    return this.get('SELECT * FROM evidence_missing_records WHERE id = ?', [id]);
  }

  async getEvidenceMissingByWorkOrder(workOrderId) {
    return this.all('SELECT * FROM evidence_missing_records WHERE work_order_id = ?', [workOrderId]);
  }

  async getAllEvidenceMissing() {
    return this.all('SELECT * FROM evidence_missing_records ORDER BY created_at DESC');
  }

  async updateEvidenceMissing(id, data) {
    const existing = await this.getEvidenceMissing(id);
    if (!existing) return null;

    const now = moment().format();
    const updates = [];
    const params = [];

    Object.keys(data).forEach(key => {
      if (existing[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(data[key]);
      }
    });

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);
      await this.run(`UPDATE evidence_missing_records SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.getEvidenceMissing(id);
  }

  async createReworkRelation(data) {
    const original = await this.getWorkOrder(data.original_work_order_id);
    const rework = await this.getWorkOrder(data.rework_work_order_id);
    
    if (!original || !rework) {
      return { error: '关联的工单不存在' };
    }

    const existing = await this.get(
      'SELECT * FROM rework_relations WHERE original_work_order_id = ? AND rework_work_order_id = ?',
      [data.original_work_order_id, data.rework_work_order_id]
    );
    
    if (existing) {
      return { error: '复修关联已存在' };
    }

    if (original.vendor_id !== rework.vendor_id) {
      return { error: '复修工单必须与原工单属于同一外包商' };
    }

    const id = require('uuid').v4();
    const now = moment().format();
    await this.run(
      `INSERT INTO rework_relations (id, original_work_order_id, rework_work_order_id, relation_type, reason, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.original_work_order_id, data.rework_work_order_id, data.relation_type || 'rework',
       data.reason, data.created_by, now]
    );

    return this.getReworkRelation(id);
  }

  async getReworkRelation(id) {
    return this.get('SELECT * FROM rework_relations WHERE id = ?', [id]);
  }

  async getReworkRelationsByWorkOrder(workOrderId) {
    return this.all(
      `SELECT r.*, o.order_no as original_order_no, rw.order_no as rework_order_no
       FROM rework_relations r
       LEFT JOIN work_orders o ON r.original_work_order_id = o.id
       LEFT JOIN work_orders rw ON r.rework_work_order_id = rw.id
       WHERE r.original_work_order_id = ? OR r.rework_work_order_id = ?`,
      [workOrderId, workOrderId]
    );
  }

  async getAllReworkRelations() {
    return this.all(
      `SELECT r.*, o.order_no as original_order_no, rw.order_no as rework_order_no
       FROM rework_relations r
       LEFT JOIN work_orders o ON r.original_work_order_id = o.id
       LEFT JOIN work_orders rw ON r.rework_work_order_id = rw.id
       ORDER BY r.created_at DESC`
    );
  }

  async createOutsourcingBill(data) {
    const id = require('uuid').v4();
    const now = moment().format();
    
    await this.run(
      `INSERT INTO outsourcing_bills (id, bill_no, contract_id, work_order_ids, vendor_name, vendor_id,
        base_total, overtime_total, deduction_total, final_amount, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.bill_no, data.contract_id, JSON.stringify(data.work_order_ids), data.vendor_name, data.vendor_id,
       data.base_total, data.overtime_total, data.deduction_total, data.final_amount,
       data.status || 'draft', data.created_by, now, now]
    );

    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await this.run(
          `INSERT INTO outsourcing_bill_items (id, bill_id, work_order_id, base_amount, overtime_amount, deduction_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [require('uuid').v4(), id, item.work_order_id, item.base_amount, item.overtime_amount,
           item.deduction_amount, item.total_amount]
        );
      }
    }

    return this.getOutsourcingBill(id);
  }

  async getOutsourcingBill(id) {
    const bill = await this.get('SELECT * FROM outsourcing_bills WHERE id = ?', [id]);
    if (bill) {
      bill.work_order_ids = JSON.parse(bill.work_order_ids);
      bill.items = await this.all('SELECT * FROM outsourcing_bill_items WHERE bill_id = ?', [id]);
    }
    return bill;
  }

  async getOutsourcingBillByNo(billNo) {
    const bill = await this.get('SELECT * FROM outsourcing_bills WHERE bill_no = ?', [billNo]);
    if (bill) {
      bill.work_order_ids = JSON.parse(bill.work_order_ids);
      bill.items = await this.all('SELECT * FROM outsourcing_bill_items WHERE bill_id = ?', [bill.id]);
    }
    return bill;
  }

  async getAllOutsourcingBills() {
    const bills = await this.all('SELECT * FROM outsourcing_bills ORDER BY created_at DESC');
    for (const bill of bills) {
      bill.work_order_ids = JSON.parse(bill.work_order_ids);
    }
    return bills;
  }

  async getStatistics() {
    const stats = {};
    
    const workOrderStats = await this.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
        SUM(CASE WHEN status = 'exception' THEN 1 ELSE 0 END) as exception,
        SUM(total_amount) as total_amount
      FROM work_orders
    `);
    stats.work_orders = workOrderStats;

    const evidenceStats = await this.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM evidence_missing_records
    `);
    stats.evidence_missing = evidenceStats;

    const billStats = await this.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(final_amount) as total_amount
      FROM outsourcing_bills
    `);
    stats.bills = billStats;

    return stats;
  }

  async getWorkOrdersForExport(filters = {}) {
    let sql = `SELECT 
      wo.*,
      c.contract_no,
      c.base_price,
      c.overtime_rate
    FROM work_orders wo
    LEFT JOIN contracts c ON wo.contract_id = c.id
    WHERE 1=1`;
    
    const params = [];
    
    if (filters.responsible_person) {
      sql += ' AND wo.assigned_worker = ?';
      params.push(filters.responsible_person);
    }
    
    if (filters.start_date) {
      sql += ' AND wo.created_at >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      sql += ' AND wo.created_at <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY wo.created_at DESC';
    
    const orders = await this.all(sql, params);
    
    for (const order of orders) {
      order.arrival_photos = await this.getArrivalPhotosByWorkOrder(order.id);
      order.overtime_deductions = await this.getOvertimeDeductionsByWorkOrder(order.id);
      order.evidence_missing = await this.getEvidenceMissingByWorkOrder(order.id);
      order.rework_relations = await this.getReworkRelationsByWorkOrder(order.id);
      order.status_history = await this.all(
        'SELECT * FROM work_order_status_history WHERE work_order_id = ? ORDER BY changed_at',
        [order.id]
      );
      order.history = await this.all(
        'SELECT * FROM work_order_history WHERE work_order_id = ? ORDER BY modified_at',
        [order.id]
      );
    }
    
    return orders;
  }

  async getStatusHistory(workOrderId) {
    return this.all(
      'SELECT * FROM work_order_status_history WHERE work_order_id = ? ORDER BY changed_at',
      [workOrderId]
    );
  }

  async getContractHistory(contractId) {
    return this.all(
      'SELECT * FROM contract_history WHERE contract_id = ? ORDER BY modified_at',
      [contractId]
    );
  }

  async getWorkOrderHistory(workOrderId) {
    return this.all(
      'SELECT * FROM work_order_history WHERE work_order_id = ? ORDER BY modified_at',
      [workOrderId]
    );
  }

  async getArrivalPhotosHistory(photoId) {
    return this.all(
      'SELECT * FROM arrival_photos_history WHERE photo_id = ? ORDER BY modified_at',
      [photoId]
    );
  }
}

module.exports = Database;
