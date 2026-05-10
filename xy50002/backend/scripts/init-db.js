const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'support.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  order_date TEXT NOT NULL,
  total_amount REAL NOT NULL,
  shipping_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL,
  weight REAL,
  dimensions TEXT,
  warranty_months INTEGER DEFAULT 12,
  description TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  tracking_number TEXT,
  carrier TEXT,
  package_status TEXT NOT NULL DEFAULT 'in_transit',
  shipped_date TEXT,
  delivered_date TEXT,
  weight REAL,
  dimensions TEXT,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS logistics (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_messages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'customer',
  content TEXT NOT NULL,
  author TEXT,
  attachment_url TEXT,
  is_evidence INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS spare_parts (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  product_sku TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  ticket_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to TEXT,
  sla_deadline TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  risk_reason TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_actions (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT,
  attachment_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_notes (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT,
  is_internal INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  return_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_cost REAL,
  shipping_cost_responsibility TEXT,
  refund_amount REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS replacements (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  replacement_type TEXT NOT NULL,
  item_sku TEXT,
  item_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_risk ON support_tickets(risk_level);
CREATE INDEX IF NOT EXISTS idx_tickets_sla ON support_tickets(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_messages_order ON customer_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_packages_order ON packages(order_id);
CREATE INDEX IF NOT EXISTS idx_logistics_package ON logistics(package_id);
`);

console.log('Database created successfully!');

const sampleData = require('./sample-data');
sampleData.insertSampleData(db);

console.log('Sample data inserted!');

db.close();
