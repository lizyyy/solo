export const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS teacher_notes (
    id TEXT PRIMARY KEY,
    record_no TEXT,
    date TEXT,
    teacher_name TEXT,
    amount REAL,
    item_type TEXT,
    annotation TEXT,
    import_batch_id TEXT,
    imported_at TEXT,
    imported_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sampling_lists (
    id TEXT PRIMARY KEY,
    record_no TEXT,
    date TEXT,
    teacher_name TEXT,
    amount REAL,
    item_type TEXT,
    scene_description TEXT,
    is_old_format INTEGER DEFAULT 0,
    import_batch_id TEXT,
    imported_at TEXT,
    imported_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bill_records (
    id TEXT PRIMARY KEY,
    record_no TEXT,
    date TEXT,
    teacher_name TEXT,
    amount REAL,
    item_type TEXT,
    status TEXT DEFAULT 'pending',
    teacher_note_id TEXT,
    sampling_list_id TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS conflict_records (
    id TEXT PRIMARY KEY,
    record_id TEXT,
    teacher_note_id TEXT,
    sampling_list_id TEXT,
    conflicting_fields TEXT,
    resolution TEXT,
    resolution_note TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS gap_records (
    id TEXT PRIMARY KEY,
    record_id TEXT,
    missing_record_no TEXT,
    previous_record_no TEXT,
    next_record_no TEXT,
    review_status TEXT DEFAULT 'pending',
    review_note TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS param_versions (
    id TEXT PRIMARY KEY,
    version TEXT,
    snapshot TEXT,
    change_summary TEXT,
    operator TEXT,
    created_at TEXT,
    record_count TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS operation_histories (
    id TEXT PRIMARY KEY,
    record_id TEXT,
    operation_type TEXT,
    description TEXT,
    operator TEXT,
    operator_role TEXT,
    before_state TEXT,
    after_state TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    password TEXT,
    name TEXT,
    role TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bill_records_status ON bill_records(status)`,
  `CREATE INDEX IF NOT EXISTS idx_bill_records_record_no ON bill_records(record_no)`,
  `CREATE INDEX IF NOT EXISTS idx_operation_histories_record_id ON operation_histories(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_operation_histories_created_at ON operation_histories(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_conflict_records_record_id ON conflict_records(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gap_records_record_id ON gap_records(record_id)`
]
