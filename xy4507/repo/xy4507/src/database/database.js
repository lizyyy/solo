const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class AppDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    const SQL = await initSqlJs();
    
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    
    this.initTables();
    this.save();
  }

  async ensureReady() {
    await this.initPromise;
  }

  initTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        patient_name TEXT NOT NULL,
        phone TEXT,
        order_date TEXT NOT NULL,
        pickup_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        eye_type TEXT NOT NULL,
        sphere REAL,
        cylinder REAL,
        axis INTEGER,
        add_power REAL,
        pd REAL,
        ph REAL,
        UNIQUE(order_id, eye_type)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS frames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        frame_model TEXT,
        frame_brand TEXT,
        frame_width REAL,
        bridge_width REAL,
        temple_length REAL,
        lens_width REAL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS lenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        eye_type TEXT NOT NULL,
        lens_brand TEXT,
        lens_type TEXT,
        lens_diameter REAL,
        base_curve REAL,
        center_thickness REAL,
        UNIQUE(order_id, eye_type)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS grinding_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        grinding_date TEXT,
        grinding_machine TEXT,
        operator TEXT,
        lens_size_w REAL,
        lens_size_h REAL,
        bevel_type TEXT,
        edge_thickness REAL,
        quality_check TEXT,
        remarks TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS quality_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        check_date TEXT,
        checker TEXT,
        visual_acuity_left TEXT,
        visual_acuity_right TEXT,
        prism_check TEXT,
        axis_verification TEXT,
        surface_quality TEXT,
        fitting_check TEXT,
        overall_result TEXT,
        remarks TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS risk_detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        risk_type TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        reviewer_remark TEXT,
        reviewed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number)`);
    } catch (e) {}
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date)`);
    } catch (e) {}
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_risks_order ON risk_detections(order_id)`);
    } catch (e) {}
    try {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_risks_status ON risk_detections(status)`);
    } catch (e) {}
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    this.save();
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return result;
    }
    stmt.free();
    return undefined;
  }

  all(sql, params = []) {
    const results = [];
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  getLastInsertRowid() {
    const result = this.get("SELECT last_insert_rowid() as id");
    return result ? result.id : 0;
  }

  createOrder(orderData) {
    const {
      order_number, patient_name, phone, order_date, pickup_date,
      prescriptions, frames, lenses, grinding_log, quality_check
    } = orderData;

    const now = new Date().toISOString();

    this.run(`
      INSERT INTO orders (order_number, patient_name, phone, order_date, pickup_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [order_number, patient_name, phone || null, order_date, pickup_date, now, now]);
    
    const orderId = this.getLastInsertRowid();

    if (prescriptions && prescriptions.length > 0) {
      for (const p of prescriptions) {
        this.run(`
          INSERT INTO prescriptions (order_id, eye_type, sphere, cylinder, axis, add_power, pd, ph)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [orderId, p.eye_type, p.sphere || null, p.cylinder || null, p.axis || null, p.add_power || null, p.pd || null, p.ph || null]);
      }
    }

    if (frames) {
      this.run(`
        INSERT INTO frames (order_id, frame_model, frame_brand, frame_width, bridge_width, temple_length, lens_width)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [orderId, frames.frame_model || null, frames.frame_brand || null, frames.frame_width || null, frames.bridge_width || null, frames.temple_length || null, frames.lens_width || null]);
    }

    if (lenses && lenses.length > 0) {
      for (const l of lenses) {
        this.run(`
          INSERT INTO lenses (order_id, eye_type, lens_brand, lens_type, lens_diameter, base_curve, center_thickness)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [orderId, l.eye_type, l.lens_brand || null, l.lens_type || null, l.lens_diameter || null, l.base_curve || null, l.center_thickness || null]);
      }
    }

    if (grinding_log) {
      this.run(`
        INSERT INTO grinding_logs (order_id, grinding_date, grinding_machine, operator, 
          lens_size_w, lens_size_h, bevel_type, edge_thickness, quality_check, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderId, grinding_log.grinding_date || null, grinding_log.grinding_machine || null, grinding_log.operator || null, grinding_log.lens_size_w || null, grinding_log.lens_size_h || null, grinding_log.bevel_type || null, grinding_log.edge_thickness || null, grinding_log.quality_check || null, grinding_log.remarks || null]);
    }

    if (quality_check) {
      this.run(`
        INSERT INTO quality_checks (order_id, check_date, checker, visual_acuity_left,
          visual_acuity_right, prism_check, axis_verification, surface_quality, fitting_check,
          overall_result, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderId, quality_check.check_date || null, quality_check.checker || null, quality_check.visual_acuity_left || null, quality_check.visual_acuity_right || null, quality_check.prism_check || null, quality_check.axis_verification || null, quality_check.surface_quality || null, quality_check.fitting_check || null, quality_check.overall_result || null, quality_check.remarks || null]);
    }

    return orderId;
  }

  updateOrder(orderId, orderData) {
    const now = new Date().toISOString();

    this.run(`
      UPDATE orders SET 
        patient_name = ?, phone = ?, order_date = ?, pickup_date = ?, updated_at = ?
      WHERE id = ?
    `, [orderData.patient_name, orderData.phone || null, orderData.order_date, orderData.pickup_date, now, orderId]);

    if (orderData.prescriptions && orderData.prescriptions.length > 0) {
      this.run('DELETE FROM prescriptions WHERE order_id = ?', [orderId]);
      for (const p of orderData.prescriptions) {
        this.run(`
          INSERT INTO prescriptions (order_id, eye_type, sphere, cylinder, axis, add_power, pd, ph)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [orderId, p.eye_type, p.sphere || null, p.cylinder || null, p.axis || null, p.add_power || null, p.pd || null, p.ph || null]);
      }
    }

    if (orderData.frames) {
      this.run('DELETE FROM frames WHERE order_id = ?', [orderId]);
      this.run(`
        INSERT INTO frames (order_id, frame_model, frame_brand, frame_width, bridge_width, temple_length, lens_width)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [orderId, orderData.frames.frame_model || null, orderData.frames.frame_brand || null, orderData.frames.frame_width || null, orderData.frames.bridge_width || null, orderData.frames.temple_length || null, orderData.frames.lens_width || null]);
    }

    if (orderData.lenses && orderData.lenses.length > 0) {
      this.run('DELETE FROM lenses WHERE order_id = ?', [orderId]);
      for (const l of orderData.lenses) {
        this.run(`
          INSERT INTO lenses (order_id, eye_type, lens_brand, lens_type, lens_diameter, base_curve, center_thickness)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [orderId, l.eye_type, l.lens_brand || null, l.lens_type || null, l.lens_diameter || null, l.base_curve || null, l.center_thickness || null]);
      }
    }
  }

  getOrderById(orderId) {
    const order = this.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return null;

    const prescriptions = this.all('SELECT * FROM prescriptions WHERE order_id = ?', [orderId]);
    const frames = this.get('SELECT * FROM frames WHERE order_id = ?', [orderId]);
    const lenses = this.all('SELECT * FROM lenses WHERE order_id = ?', [orderId]);
    const grinding_logs = this.all('SELECT * FROM grinding_logs WHERE order_id = ?', [orderId]);
    const quality_checks = this.all('SELECT * FROM quality_checks WHERE order_id = ?', [orderId]);

    return {
      ...order,
      prescriptions,
      frames: frames || null,
      lenses,
      grinding_logs,
      quality_checks
    };
  }

  getAllOrders(filters = {}) {
    let sql = `
      SELECT o.*,
        (SELECT COUNT(*) FROM risk_detections r WHERE r.order_id = o.id AND r.status = 'pending') as pending_risks,
        (SELECT COUNT(*) FROM risk_detections r WHERE r.order_id = o.id AND r.risk_level = 'high') as high_risks
      FROM orders o
    `;
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('o.status = ?');
      params.push(filters.status);
    }

    if (filters.hasRisk === 'true') {
      conditions.push('(SELECT COUNT(*) FROM risk_detections r WHERE r.order_id = o.id AND r.status = "pending") > 0');
    }

    if (filters.startDate) {
      conditions.push('o.order_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('o.order_date <= ?');
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY o.order_date DESC, o.id DESC';

    return this.all(sql, params);
  }

  searchOrders(keyword) {
    const searchTerm = `%${keyword}%`;
    return this.all(`
      SELECT o.*,
        (SELECT COUNT(*) FROM risk_detections r WHERE r.order_id = o.id AND r.status = 'pending') as pending_risks
      FROM orders o
      WHERE o.order_number LIKE ? OR o.patient_name LIKE ? OR o.phone LIKE ?
      ORDER BY o.order_date DESC
    `, [searchTerm, searchTerm, searchTerm]);
  }

  getOrderRisks(orderId) {
    return this.all(`
      SELECT * FROM risk_detections 
      WHERE order_id = ? 
      ORDER BY 
        CASE risk_level 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END,
        created_at DESC
    `, [orderId]);
  }

  createRisk(orderId, riskType, riskLevel, description, evidence) {
    const now = new Date().toISOString();
    this.run(`
      INSERT INTO risk_detections (order_id, risk_type, risk_level, description, evidence, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [orderId, riskType, riskLevel, description, evidence, now]);
    return this.getLastInsertRowid();
  }

  updateRiskStatus(riskId, status, remark) {
    const now = new Date().toISOString();
    this.run(`
      UPDATE risk_detections 
      SET status = ?, reviewer_remark = ?, reviewed_at = ?
      WHERE id = ?
    `, [status, remark || null, now, riskId]);
  }

  clearOrderRisks(orderId) {
    this.run('DELETE FROM risk_detections WHERE order_id = ?', [orderId]);
  }

  addNote(orderId, content) {
    const now = new Date().toISOString();
    this.run(`
      INSERT INTO notes (order_id, content, created_at)
      VALUES (?, ?, ?)
    `, [orderId, content, now]);
    return this.getLastInsertRowid();
  }

  getNotes(orderId) {
    return this.all(`
      SELECT * FROM notes 
      WHERE order_id = ? 
      ORDER BY created_at DESC
    `, [orderId]);
  }

  getRiskStatistics() {
    return this.all(`
      SELECT 
        risk_type,
        risk_level,
        status,
        COUNT(*) as count
      FROM risk_detections
      GROUP BY risk_type, risk_level, status
    `);
  }

  getAllDataForExport() {
    const orders = this.getAllOrders();
    return orders.map(order => {
      const fullOrder = this.getOrderById(order.id);
      const risks = this.getOrderRisks(order.id);
      const notes = this.getNotes(order.id);
      return {
        ...fullOrder,
        risks,
        notes
      };
    });
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
    }
  }
}

module.exports = AppDatabase;
