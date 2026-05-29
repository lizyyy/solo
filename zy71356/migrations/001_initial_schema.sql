CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  power_requirement INTEGER NOT NULL DEFAULT 0,
  contact TEXT,
  note TEXT,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stalls (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  max_power INTEGER NOT NULL DEFAULT 500,
  is_entrance BOOLEAN DEFAULT FALSE,
  width INTEGER NOT NULL DEFAULT 1,
  height INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE arrangements (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  arrangement_id TEXT NOT NULL,
  stall_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  source TEXT,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (arrangement_id) REFERENCES arrangements(id),
  FOREIGN KEY (stall_id) REFERENCES stalls(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE swap_logs (
  id TEXT PRIMARY KEY,
  arrangement_id TEXT NOT NULL,
  stall_a TEXT NOT NULL,
  stall_b TEXT NOT NULL,
  reason TEXT NOT NULL,
  operator TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (arrangement_id) REFERENCES arrangements(id)
);

CREATE TABLE conflicts (
  id TEXT PRIMARY KEY,
  arrangement_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  affected_items TEXT NOT NULL,
  source TEXT,
  row_number INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (arrangement_id) REFERENCES arrangements(id)
);

CREATE INDEX idx_assignments_arrangement ON assignments(arrangement_id);
CREATE INDEX idx_swap_logs_arrangement ON swap_logs(arrangement_id);
CREATE INDEX idx_conflicts_arrangement ON conflicts(arrangement_id);

INSERT INTO vendors (id, name, category, power_requirement, contact, source) VALUES
  ('v1', '青瓷坊', 'ceramic', 800, '13800138001', '初始数据'),
  ('v2', '釉下彩工作室', 'ceramic', 1200, '13800138002', '初始数据'),
  ('v3', '墨香版画社', 'print', 300, '13800138003', '初始数据'),
  ('v4', '铜版艺术', 'print', 500, '13800138004', '初始数据'),
  ('v5', '小食光', 'food', 2000, '13800138005', '初始数据'),
  ('v6', '茶香居', 'food', 1500, '13800138006', '初始数据'),
  ('v7', '手工皮具', 'other', 200, '13800138007', '初始数据'),
  ('v8', '铁艺花器', 'ceramic', 600, '13800138008', '初始数据'),
  ('v9', '水印木刻', 'print', 400, '13800138009', '初始数据'),
  ('v10', '手冲咖啡', 'food', 1800, '13800138010', '初始数据');

INSERT INTO stalls (id, name, row, col, max_power, is_entrance, width, height) VALUES
  ('s1', 'A01', 0, 0, 500, true, 1, 1),
  ('s2', 'A02', 0, 1, 2000, true, 1, 1),
  ('s3', 'A03', 0, 2, 500, false, 1, 1),
  ('s4', 'A04', 0, 3, 500, false, 1, 1),
  ('s5', 'A05', 0, 4, 2000, false, 1, 1),
  ('s6', 'B01', 1, 0, 1000, false, 1, 1),
  ('s7', 'B02', 1, 1, 1000, false, 1, 1),
  ('s8', 'B03', 1, 2, 500, false, 1, 1),
  ('s9', 'B04', 1, 3, 2000, false, 1, 1),
  ('s10', 'B05', 1, 4, 500, false, 1, 1),
  ('s11', 'C01', 2, 0, 500, false, 1, 1),
  ('s12', 'C02', 2, 1, 1500, false, 1, 1),
  ('s13', 'C03', 2, 2, 1000, false, 1, 1),
  ('s14', 'C04', 2, 3, 500, false, 1, 1),
  ('s15', 'C05', 2, 4, 2000, true, 1, 1);

INSERT INTO arrangements (id, version, name, created_by) VALUES
  ('a1', 'v1.0', '2026春季艺术市集', '系统管理员');
