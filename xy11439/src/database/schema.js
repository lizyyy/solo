const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  batch_no TEXT UNIQUE NOT NULL,
  source_type TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  merge_strategy TEXT NOT NULL,
  status TEXT NOT NULL,
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  remark TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_calendars (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  order_no TEXT NOT NULL,
  room_no TEXT NOT NULL,
  guest_name TEXT,
  guest_phone TEXT,
  guest_id_card TEXT,
  check_in_date INTEGER NOT NULL,
  check_out_date INTEGER NOT NULL,
  is_extended INTEGER DEFAULT 0,
  linen_change_required INTEGER DEFAULT 1,
  cleaning_type TEXT,
  cleaning_time TEXT,
  room_password TEXT,
  status TEXT NOT NULL,
  workflow_status TEXT NOT NULL,
  is_conflict INTEGER DEFAULT 0,
  conflict_reason TEXT,
  is_missed INTEGER DEFAULT 0,
  missed_reason TEXT,
  operator_id TEXT,
  operator_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_order_calendars_date ON order_calendars(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_order_calendars_room ON order_calendars(room_no);
CREATE INDEX IF NOT EXISTS idx_order_calendars_workflow ON order_calendars(workflow_status);

CREATE TABLE IF NOT EXISTS cleaning_messages (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  message_id TEXT UNIQUE,
  room_no TEXT,
  cleaner_name TEXT,
  cleaner_phone TEXT,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  image_urls TEXT,
  send_time INTEGER NOT NULL,
  sender_name TEXT,
  status TEXT NOT NULL,
  workflow_status TEXT NOT NULL,
  operator_id TEXT,
  operator_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cleaning_messages_time ON cleaning_messages(send_time);
CREATE INDEX IF NOT EXISTS idx_cleaning_messages_room ON cleaning_messages(room_no);

CREATE TABLE IF NOT EXISTS maintenance_notes (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  room_no TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  reporter TEXT,
  report_time INTEGER NOT NULL,
  image_urls TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT NOT NULL,
  workflow_status TEXT NOT NULL,
  handler TEXT,
  handle_time INTEGER,
  handle_result TEXT,
  operator_id TEXT,
  operator_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_notes_room ON maintenance_notes(room_no);
CREATE INDEX IF NOT EXISTS idx_maintenance_notes_status ON maintenance_notes(status);

CREATE TABLE IF NOT EXISTS change_history (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  batch_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_history_record ON change_history(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_change_history_operator ON change_history(operator_id);
CREATE INDEX IF NOT EXISTS idx_change_history_time ON change_history(created_at);

CREATE TABLE IF NOT EXISTS async_tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  fail_reason TEXT,
  fail_type TEXT,
  handler_id TEXT,
  handler_name TEXT,
  batch_id TEXT,
  scheduled_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_async_tasks_status ON async_tasks(status);
CREATE INDEX IF NOT EXISTS idx_async_tasks_scheduled ON async_tasks(scheduled_at);

CREATE TABLE IF NOT EXISTS workflow_records (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  action TEXT NOT NULL,
  remark TEXT,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_record ON workflow_records(table_name, record_id);
`;

module.exports = schema;
