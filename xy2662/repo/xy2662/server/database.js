const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'repair.db');

let db;
let isInitialized = false;
let initPromise;

const STATUS_FLOW = {
  'pending': ['quoting', 'cancelled'],
  'quoting': ['repairing', 'cancelled'],
  'repairing': ['ready', 'cancelled'],
  'ready': ['completed', 'cancelled'],
  'completed': [],
  'cancelled': []
};

const STATUS_NAMES = {
  'pending': '待检测',
  'quoting': '报价中',
  'repairing': '维修中',
  'ready': '待取机',
  'completed': '已完成',
  'cancelled': '已取消'
};

function getStatusName(status) {
  return STATUS_NAMES[status] || status;
}

function canTransition(fromStatus, toStatus) {
  if (!STATUS_FLOW[fromStatus]) return false;
  return STATUS_FLOW[fromStatus].includes(toStatus);
}

function getAvailableTransitions(status) {
  return STATUS_FLOW[status] || [];
}

function getTransitionReason(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    const nextStatus = getAvailableTransitions(fromStatus);
    if (nextStatus.length === 0) {
      return `当前状态「${getStatusName(fromStatus)}」无法进行状态变更`;
    }
    return `当前状态「${getStatusName(fromStatus)}」只能变更为：${nextStatus.map(s => getStatusName(s)).join('、')}`;
  }
  return null;
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('已连接到 SQLite 数据库');
      
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS repair_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            device_model TEXT NOT NULL,
            fault_description TEXT NOT NULL,
            quote_amount REAL,
            repair_parts TEXT,
            expected_pickup_time TEXT,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repair_order_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (repair_order_id) REFERENCES repair_orders (id)
          )
        `);

        db.run(`CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_repair_orders_phone ON repair_orders(phone)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_repair_orders_name ON repair_orders(customer_name)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_repair_order ON audit_logs(repair_order_id)`, (err) => {
          if (err) {
            console.error('创建索引失败:', err);
            reject(err);
          } else {
            console.log('数据库表初始化完成');
            isInitialized = true;
            resolve();
          }
        });
      });
    });
  });
}

function waitForInitialization() {
  if (isInitialized) {
    return Promise.resolve();
  }
  if (!initPromise) {
    initPromise = initializeDatabase();
  }
  return initPromise;
}

async function run(sql, params = []) {
  await waitForInitialization();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

async function get(sql, params = []) {
  await waitForInitialization();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function all(sql, params = []) {
  await waitForInitialization();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function createRepairOrder(data) {
  await waitForInitialization();
  const {
    customer_name, phone, device_model, fault_description,
    quote_amount, repair_parts, expected_pickup_time, notes
  } = data;

  const result = await run(`
    INSERT INTO repair_orders 
    (customer_name, phone, device_model, fault_description, quote_amount, repair_parts, expected_pickup_time, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    customer_name, phone, device_model, fault_description,
    quote_amount, repair_parts, expected_pickup_time, notes
  ]);

  await run(`
    INSERT INTO audit_logs (repair_order_id, action, note)
    VALUES (?, 'create', '创建工单')
  `, [result.lastID]);

  return result.lastID;
}

async function updateRepairOrder(id, data) {
  await waitForInitialization();
  const {
    customer_name, phone, device_model, fault_description,
    quote_amount, repair_parts, expected_pickup_time, notes
  } = data;

  const existingOrder = await get(`
    SELECT * FROM repair_orders WHERE id = ?
  `, [id]);

  if (!existingOrder) {
    throw new Error('工单不存在');
  }

  await run(`
    UPDATE repair_orders SET
      customer_name = ?, phone = ?, device_model = ?,
      fault_description = ?, quote_amount = ?, repair_parts = ?,
      expected_pickup_time = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    customer_name, phone, device_model, fault_description,
    quote_amount, repair_parts, expected_pickup_time, notes, id
  ]);

  await run(`
    INSERT INTO audit_logs (repair_order_id, action, note)
    VALUES (?, 'update', '更新工单信息')
  `, [id]);

  return true;
}

async function updateStatus(id, newStatus, note = '') {
  await waitForInitialization();
  const existingOrder = await get(`
    SELECT * FROM repair_orders WHERE id = ?
  `, [id]);

  if (!existingOrder) {
    throw new Error('工单不存在');
  }

  const oldStatus = existingOrder.status;

  if (!canTransition(oldStatus, newStatus)) {
    const reason = getTransitionReason(oldStatus, newStatus);
    throw new Error(reason || '状态变更不允许');
  }

  await run(`
    UPDATE repair_orders SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newStatus, id]);

  const actionNote = note || `从「${getStatusName(oldStatus)}」变更为「${getStatusName(newStatus)}」`;
  await run(`
    INSERT INTO audit_logs (repair_order_id, action, from_status, to_status, note)
    VALUES (?, 'status_change', ?, ?, ?)
  `, [id, oldStatus, newStatus, actionNote]);

  return true;
}

async function getRepairOrderById(id) {
  await waitForInitialization();
  return await get(`
    SELECT * FROM repair_orders WHERE id = ?
  `, [id]);
}

async function getRepairOrders(filters = {}) {
  await waitForInitialization();
  let sql = `SELECT * FROM repair_orders WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }

  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    sql += ` AND (customer_name LIKE ? OR phone LIKE ? OR device_model LIKE ?)`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  sql += ` ORDER BY created_at DESC`;

  return await all(sql, params);
}

async function getAuditLogs(repairOrderId) {
  await waitForInitialization();
  return await all(`
    SELECT * FROM audit_logs WHERE repair_order_id = ? ORDER BY created_at DESC
  `, [repairOrderId]);
}

async function init() {
  await waitForInitialization();
}

module.exports = {
  init,
  run,
  get,
  all,
  createRepairOrder,
  updateRepairOrder,
  updateStatus,
  getRepairOrderById,
  getRepairOrders,
  getAuditLogs,
  getStatusName,
  canTransition,
  getAvailableTransitions,
  getTransitionReason,
  STATUS_FLOW,
  STATUS_NAMES
};
