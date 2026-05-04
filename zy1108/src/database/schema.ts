import { db } from './connection';

export const createTables = () => {
  db.exec(`
    -- 老师表
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      hourly_rate REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 学生表
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      gender TEXT,
      birth_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 班级表
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      dance_style TEXT,
      capacity INTEGER DEFAULT 10,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );

    -- 课包模板表
    CREATE TABLE IF NOT EXISTS package_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_lessons INTEGER NOT NULL,
      price REAL DEFAULT 0,
      valid_days INTEGER DEFAULT 365,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 学生课包表
    CREATE TABLE IF NOT EXISTS student_packages (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      template_id TEXT,
      name TEXT NOT NULL,
      total_lessons INTEGER NOT NULL,
      used_lessons INTEGER DEFAULT 0,
      freeze_lessons INTEGER DEFAULT 0,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      is_frozen INTEGER DEFAULT 0,
      frozen_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (template_id) REFERENCES package_templates(id)
    );

    -- 课次表
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      capacity INTEGER DEFAULT 10,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );

    -- 课次预约表
    CREATE TABLE IF NOT EXISTS lesson_bookings (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_package_id TEXT,
      status TEXT DEFAULT 'booked',
      check_in_time TEXT,
      is_makeup INTEGER DEFAULT 0,
      makeup_ticket_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (student_package_id) REFERENCES student_packages(id),
      FOREIGN KEY (makeup_ticket_id) REFERENCES makeup_tickets(id)
    );

    -- 请假表
    CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      lesson_booking_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      leave_type TEXT DEFAULT 'student',
      reason TEXT,
      status TEXT DEFAULT 'approved',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_booking_id) REFERENCES lesson_bookings(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    );

    -- 补课券表
    CREATE TABLE IF NOT EXISTS makeup_tickets (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      leave_id TEXT NOT NULL,
      original_lesson_id TEXT NOT NULL,
      used_lesson_id TEXT,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (leave_id) REFERENCES leaves(id),
      FOREIGN KEY (original_lesson_id) REFERENCES lessons(id),
      FOREIGN KEY (used_lesson_id) REFERENCES lessons(id)
    );

    -- 候补表
    CREATE TABLE IF NOT EXISTS waitlists (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      status TEXT DEFAULT 'waiting',
      converted_booking_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (converted_booking_id) REFERENCES lesson_bookings(id)
    );

    -- 通知待办表
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'info',
      target_type TEXT,
      target_id TEXT,
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 老师课酬记录表
    CREATE TABLE IF NOT EXISTS teacher_payments (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    );

    -- 课包使用记录表
    CREATE TABLE IF NOT EXISTS package_usage_logs (
      id TEXT PRIMARY KEY,
      student_package_id TEXT NOT NULL,
      lesson_booking_id TEXT,
      action TEXT NOT NULL,
      change_amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_package_id) REFERENCES student_packages(id),
      FOREIGN KEY (lesson_booking_id) REFERENCES lesson_bookings(id)
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
    CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons(class_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_time ON lessons(start_time);
    CREATE INDEX IF NOT EXISTS idx_bookings_lesson ON lesson_bookings(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_student ON lesson_bookings(student_id);
    CREATE INDEX IF NOT EXISTS idx_packages_student ON student_packages(student_id);
    CREATE INDEX IF NOT EXISTS idx_waitlists_lesson ON waitlists(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_makeup_tickets_student ON makeup_tickets(student_id);
    CREATE INDEX IF NOT EXISTS idx_payments_teacher ON teacher_payments(teacher_id);
  `);
};

export const dropTables = () => {
  db.exec(`
    DROP TABLE IF EXISTS package_usage_logs;
    DROP TABLE IF EXISTS teacher_payments;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS waitlists;
    DROP TABLE IF EXISTS makeup_tickets;
    DROP TABLE IF EXISTS leaves;
    DROP TABLE IF EXISTS lesson_bookings;
    DROP TABLE IF EXISTS lessons;
    DROP TABLE IF EXISTS student_packages;
    DROP TABLE IF EXISTS package_templates;
    DROP TABLE IF EXISTS classes;
    DROP TABLE IF EXISTS students;
    DROP TABLE IF EXISTS teachers;
  `);
};
