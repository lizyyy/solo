const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/permissions.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (parent_id) REFERENCES departments(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS api_resources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    description TEXT,
    sensitivity_level TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS permission_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tenant_id TEXT NOT NULL,
    is_inheritable BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS package_permissions (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    api_resource_id TEXT NOT NULL,
    access_level TEXT DEFAULT 'read',
    FOREIGN KEY (package_id) REFERENCES permission_packages(id),
    FOREIGN KEY (api_resource_id) REFERENCES api_resources(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    assigned_by TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (package_id) REFERENCES permission_packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS approval_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    role_id TEXT,
    package_id TEXT,
    requester TEXT NOT NULL,
    approver TEXT,
    status TEXT DEFAULT 'pending',
    request_type TEXT NOT NULL,
    request_data TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (package_id) REFERENCES permission_packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS call_rejections (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    department_id TEXT,
    role_id TEXT,
    api_resource_id TEXT NOT NULL,
    requester TEXT NOT NULL,
    reason TEXT NOT NULL,
    rejection_type TEXT NOT NULL,
    request_input TEXT,
    resolved BOOLEAN DEFAULT 0,
    resolved_by TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (api_resource_id) REFERENCES api_resources(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS request_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    department_id TEXT,
    role_id TEXT,
    api_resource_id TEXT,
    requester TEXT NOT NULL,
    request_input TEXT,
    request_result TEXT,
    status TEXT NOT NULL,
    responsible_node TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
