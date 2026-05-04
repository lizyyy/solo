import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');
const dbPath = path.join(dataDir, 'network-mgmt.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initTables = () => {
  db.exec(`
    -- 资产表
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      mac_address TEXT UNIQUE,
      serial_number TEXT UNIQUE,
      department TEXT,
      owner TEXT,
      location TEXT,
      purchase_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- IP地址表
    CREATE TABLE IF NOT EXISTS ip_addresses (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL UNIQUE,
      asset_id TEXT,
      network_segment_id TEXT,
      vlan_id TEXT,
      status TEXT DEFAULT 'assigned',
      is_static INTEGER DEFAULT 0,
      last_seen TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
      FOREIGN KEY (network_segment_id) REFERENCES network_segments(id) ON DELETE SET NULL,
      FOREIGN KEY (vlan_id) REFERENCES vlans(id) ON DELETE SET NULL
    );

    -- 网段表
    CREATE TABLE IF NOT EXISTS network_segments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cidr TEXT NOT NULL UNIQUE,
      gateway TEXT,
      dns_servers TEXT,
      vlan_id TEXT,
      description TEXT,
      total_ips INTEGER DEFAULT 0,
      used_ips INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vlan_id) REFERENCES vlans(id) ON DELETE SET NULL
    );

    -- VLAN表
    CREATE TABLE IF NOT EXISTS vlans (
      id TEXT PRIMARY KEY,
      vlan_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'data',
      description TEXT,
      is_guest INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 交换机端口表
    CREATE TABLE IF NOT EXISTS switch_ports (
      id TEXT PRIMARY KEY,
      switch_id TEXT NOT NULL,
      port_number TEXT NOT NULL,
      port_type TEXT DEFAULT 'access',
      vlan_id TEXT,
      status TEXT DEFAULT 'up',
      connected_asset_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (switch_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (vlan_id) REFERENCES vlans(id) ON DELETE SET NULL,
      FOREIGN KEY (connected_asset_id) REFERENCES assets(id) ON DELETE SET NULL,
      UNIQUE(switch_id, port_number)
    );

    -- DHCP租约表
    CREATE TABLE IF NOT EXISTS dhcp_leases (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      mac_address TEXT NOT NULL,
      hostname TEXT,
      start_time TEXT NOT NULL,
      expire_time TEXT,
      server_id TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ip, mac_address)
    );

    -- 防火墙规则表
    CREATE TABLE IF NOT EXISTS firewall_rules (
      id TEXT PRIMARY KEY,
      rule_number INTEGER,
      name TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'allow',
      source TEXT,
      destination TEXT,
      protocol TEXT DEFAULT 'any',
      ports TEXT,
      description TEXT,
      is_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 告警表
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      asset_id TEXT,
      ip_address TEXT,
      description TEXT,
      raw_data TEXT,
      is_acknowledged INTEGER DEFAULT 0,
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      group_key TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );

    -- 变更单表
    CREATE TABLE IF NOT EXISTS change_orders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending_evaluation',
      requested_by TEXT,
      approved_by TEXT,
      executed_by TEXT,
      rolled_back_by TEXT,
      impact_analysis TEXT,
      change_details TEXT,
      rollback_plan TEXT,
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      approved_at TEXT,
      executed_at TEXT,
      rolled_back_at TEXT,
      completed_at TEXT
    );

    -- 变更单影响的资产表
    CREATE TABLE IF NOT EXISTS change_affected_assets (
      change_order_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      impact_type TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (change_order_id, asset_id),
      FOREIGN KEY (change_order_id) REFERENCES change_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    -- 风险表
    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      asset_id TEXT,
      ip_address TEXT,
      details TEXT,
      is_resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );

    -- 服务端口表
    CREATE TABLE IF NOT EXISTS service_ports (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      port INTEGER NOT NULL,
      protocol TEXT DEFAULT 'tcp',
      service_name TEXT,
      is_exposed INTEGER DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      UNIQUE(asset_id, port, protocol)
    );

    -- 拓扑关系表
    CREATE TABLE IF NOT EXISTS topology (
      id TEXT PRIMARY KEY,
      parent_asset_id TEXT NOT NULL,
      child_asset_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      connection_details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (child_asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      UNIQUE(parent_asset_id, child_asset_id, relationship_type)
    );

    -- 索引优化
    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department);
    CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner);
    CREATE INDEX IF NOT EXISTS idx_ips_ip ON ip_addresses(ip);
    CREATE INDEX IF NOT EXISTS idx_ips_asset ON ip_addresses(asset_id);
    CREATE INDEX IF NOT EXISTS idx_ips_segment ON ip_addresses(network_segment_id);
    CREATE INDEX IF NOT EXISTS idx_segments_cidr ON network_segments(cidr);
    CREATE INDEX IF NOT EXISTS idx_vlans_vlan_id ON vlans(vlan_id);
    CREATE INDEX IF NOT EXISTS idx_dhcp_leases_ip ON dhcp_leases(ip);
    CREATE INDEX IF NOT EXISTS idx_dhcp_leases_mac ON dhcp_leases(mac_address);
    CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_group ON alerts(group_key);
    CREATE INDEX IF NOT EXISTS idx_changes_status ON change_orders(status);
    CREATE INDEX IF NOT EXISTS idx_changes_requested ON change_orders(requested_at);
    CREATE INDEX IF NOT EXISTS idx_risks_type ON risks(type);
    CREATE INDEX IF NOT EXISTS idx_risks_severity ON risks(severity);
    CREATE INDEX IF NOT EXISTS idx_risks_resolved ON risks(is_resolved);
  `);

  console.log('数据库表初始化完成');
};

export { db, initTables };
