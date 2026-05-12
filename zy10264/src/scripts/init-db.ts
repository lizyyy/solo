import db from '../db';

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS tourists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      passport_number TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS material_types (
      id TEXT PRIMARY KEY,
      country_id TEXT NOT NULL REFERENCES countries(id),
      name TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT 1,
      validity_days INTEGER,
      UNIQUE(country_id, name)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      tourist_id TEXT NOT NULL REFERENCES tourists(id),
      country_id TEXT NOT NULL REFERENCES countries(id),
      status TEXT NOT NULL DEFAULT 'DRAFT',
      submitted_at INTEGER,
      reviewed_at INTEGER,
      sent_at INTEGER,
      returned_at INTEGER,
      closed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      CHECK(status IN ('DRAFT', 'SUBMITTED', 'REVIEWING', 'REJECTED', 'SUPPLEMENT', 'SENT', 'RETURNED', 'APPROVED', 'CLOSED'))
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      type_id TEXT NOT NULL REFERENCES material_types(id),
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PENDING',
      file_url TEXT,
      remark TEXT,
      expire_at INTEGER,
      uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      reviewed_at INTEGER,
      reviewer_note TEXT,
      UNIQUE(application_id, type_id, version),
      CHECK(status IN ('PENDING', 'UPLOADED', 'REVIEWING', 'APPROVED', 'REJECTED', 'EXPIRED'))
    );

    CREATE TABLE IF NOT EXISTS supplement_requests (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      material_id TEXT NOT NULL REFERENCES materials(id),
      reason TEXT NOT NULL,
      requested_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      resolved_at INTEGER,
      status TEXT NOT NULL DEFAULT 'PENDING',
      CHECK(status IN ('PENDING', 'RESOLVED', 'CLOSED'))
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id),
      from_status TEXT,
      to_status TEXT NOT NULL,
      remark TEXT,
      operator TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_applications_tourist ON applications(tourist_id);
    CREATE INDEX IF NOT EXISTS idx_applications_country ON applications(country_id);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_materials_application ON materials(application_id);
    CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type_id);
    CREATE INDEX IF NOT EXISTS idx_supplement_app ON supplement_requests(application_id);
    CREATE INDEX IF NOT EXISTS idx_history_app ON status_history(application_id);
  `);

  console.log('数据库表初始化完成');
};

initTables();
db.close();
