const db = require('./database');

db.exec(`
  CREATE TABLE IF NOT EXISTS mock_invoices (
    id TEXT PRIMARY KEY,
    business_no TEXT UNIQUE NOT NULL,
    invoice_no TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    amount REAL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mock_sms (
    id TEXT PRIMARY KEY,
    business_no TEXT UNIQUE NOT NULL,
    phone TEXT,
    content TEXT,
    sent_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mock_inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT UNIQUE NOT NULL,
    product_name TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mock_inventory_logs (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    business_no TEXT,
    change INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
  );
`);

const getInvoice = (businessNo) => {
  return db.prepare('SELECT * FROM mock_invoices WHERE business_no = ?').get(businessNo);
};

const createOrUpdateInvoice = (businessNo, data) => {
  const existing = getInvoice(businessNo);
  const now = new Date().toISOString();
  
  if (existing) {
    db.prepare(`
      UPDATE mock_invoices 
      SET invoice_no = ?, status = ?, amount = ?
      WHERE business_no = ?
    `).run(data.invoiceNo || existing.invoice_no, data.status || existing.status, data.amount || existing.amount, businessNo);
    return getInvoice(businessNo);
  } else {
    db.prepare(`
      INSERT INTO mock_invoices (id, business_no, invoice_no, status, amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.id || require('./utils').generateId(), businessNo, data.invoiceNo, data.status || 'pending', data.amount, now);
    return getInvoice(businessNo);
  }
};

const getSms = (businessNo) => {
  return db.prepare('SELECT * FROM mock_sms WHERE business_no = ?').get(businessNo);
};

const createOrUpdateSms = (businessNo, data) => {
  const existing = getSms(businessNo);
  const now = new Date().toISOString();
  
  if (existing) {
    const newCount = data.sent ? existing.sent_count + 1 : existing.sent_count;
    db.prepare(`
      UPDATE mock_sms 
      SET phone = ?, content = ?, sent_count = ?, status = ?
      WHERE business_no = ?
    `).run(data.phone || existing.phone, data.content || existing.content, newCount, data.status || existing.status, businessNo);
    return getSms(businessNo);
  } else {
    db.prepare(`
      INSERT INTO mock_sms (id, business_no, phone, content, sent_count, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.id || require('./utils').generateId(), businessNo, data.phone, data.content, data.sent ? 1 : 0, data.status || 'pending', now);
    return getSms(businessNo);
  }
};

const getInventory = (productId) => {
  return db.prepare('SELECT * FROM mock_inventory WHERE product_id = ?').get(productId);
};

const getInventoryLogs = (productId) => {
  return db.prepare('SELECT * FROM mock_inventory_logs WHERE product_id = ? ORDER BY created_at DESC').all(productId);
};

const initInventory = (productId, productName, initialStock) => {
  const existing = getInventory(productId);
  const now = new Date().toISOString();
  
  if (!existing) {
    db.prepare(`
      INSERT INTO mock_inventory (id, product_id, product_name, stock, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(require('./utils').generateId(), productId, productName, initialStock, now);
  }
  return getInventory(productId);
};

const updateInventory = (productId, change, businessNo, reason) => {
  const existing = getInventory(productId);
  if (!existing) {
    throw new Error(`Product ${productId} not found`);
  }
  
  const now = new Date().toISOString();
  const newStock = existing.stock + change;
  
  if (newStock < 0) {
    throw new Error(`Insufficient stock for product ${productId}`);
  }
  
  db.prepare(`
    UPDATE mock_inventory 
    SET stock = ?, updated_at = ?
    WHERE product_id = ?
  `).run(newStock, now, productId);
  
  db.prepare(`
    INSERT INTO mock_inventory_logs (id, product_id, business_no, change, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(require('./utils').generateId(), productId, businessNo, change, reason, now);
  
  return getInventory(productId);
};

const getAllInvoices = () => db.prepare('SELECT * FROM mock_invoices ORDER BY created_at DESC').all();
const getAllSms = () => db.prepare('SELECT * FROM mock_sms ORDER BY created_at DESC').all();
const getAllInventory = () => db.prepare('SELECT * FROM mock_inventory ORDER BY updated_at DESC').all();

module.exports = {
  getInvoice,
  createOrUpdateInvoice,
  getSms,
  createOrUpdateSms,
  getInventory,
  getInventoryLogs,
  initInventory,
  updateInventory,
  getAllInvoices,
  getAllSms,
  getAllInventory
};
