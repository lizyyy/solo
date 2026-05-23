const db = require('../config/database');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // 会员表
        db.run(`
          CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            gender TEXT,
            birthday DATE,
            status TEXT DEFAULT 'active',
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 教练表
        db.run(`
          CREATE TABLE IF NOT EXISTS coaches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            gender TEXT,
            specialty TEXT,
            status TEXT DEFAULT 'active',
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 课程包表
        db.run(`
          CREATE TABLE IF NOT EXISTS course_packages (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            total_lessons INTEGER NOT NULL,
            price REAL NOT NULL,
            valid_days INTEGER NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 会员卡表（会员购买的课程包）
        db.run(`
          CREATE TABLE IF NOT EXISTS membership_cards (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL,
            course_package_id TEXT NOT NULL,
            coach_id TEXT NOT NULL,
            remaining_lessons INTEGER NOT NULL,
            total_lessons INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status TEXT DEFAULT 'active',
            freeze_start_date DATE,
            freeze_end_date DATE,
            freeze_days INTEGER DEFAULT 0,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (course_package_id) REFERENCES course_packages(id),
            FOREIGN KEY (coach_id) REFERENCES coaches(id)
          )
        `);

        // 预约记录表
        db.run(`
          CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            membership_card_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            coach_id TEXT NOT NULL,
            appointment_date DATE NOT NULL,
            appointment_time TEXT NOT NULL,
            status TEXT DEFAULT 'scheduled',
            cancel_reason TEXT,
            cancelled_at DATETIME,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (membership_card_id) REFERENCES membership_cards(id),
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (coach_id) REFERENCES coaches(id)
          )
        `);

        // 请假申请表
        db.run(`
          CREATE TABLE IF NOT EXISTS leave_applications (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            approved_by TEXT,
            approved_at DATETIME,
            reject_reason TEXT,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
          )
        `);

        // 代课记录表
        db.run(`
          CREATE TABLE IF NOT EXISTS substitute_records (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            original_coach_id TEXT NOT NULL,
            substitute_coach_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            confirmed_by TEXT,
            confirmed_at DATETIME,
            reject_reason TEXT,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id),
            FOREIGN KEY (original_coach_id) REFERENCES coaches(id),
            FOREIGN KEY (substitute_coach_id) REFERENCES coaches(id)
          )
        `);

        // 消课记录表
        db.run(`
          CREATE TABLE IF NOT EXISTS course_consumptions (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            membership_card_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            coach_id TEXT NOT NULL,
            consumption_date DATETIME NOT NULL,
            lessons_consumed INTEGER DEFAULT 1,
            before_remaining INTEGER NOT NULL,
            after_remaining INTEGER NOT NULL,
            status TEXT DEFAULT 'completed',
            operator TEXT NOT NULL,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id),
            FOREIGN KEY (membership_card_id) REFERENCES membership_cards(id),
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (coach_id) REFERENCES coaches(id)
          )
        `);

        // 补课记录表
        db.run(`
          CREATE TABLE IF NOT EXISTS makeup_lessons (
            id TEXT PRIMARY KEY,
            original_appointment_id TEXT NOT NULL,
            new_appointment_id TEXT,
            member_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (original_appointment_id) REFERENCES appointments(id),
            FOREIGN KEY (new_appointment_id) REFERENCES appointments(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
          )
        `);

        // 异常日志表（保存原始输入和处理结论）
        db.run(`
          CREATE TABLE IF NOT EXISTS exception_logs (
            id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            raw_input TEXT NOT NULL,
            error_message TEXT NOT NULL,
            error_code TEXT NOT NULL,
            processing_result TEXT NOT NULL,
            related_record_id TEXT,
            related_record_type TEXT,
            operator TEXT,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 人工修正记录表
        db.run(`
          CREATE TABLE IF NOT EXISTS manual_corrections (
            id TEXT PRIMARY KEY,
            membership_card_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            correction_type TEXT NOT NULL,
            before_value INTEGER NOT NULL,
            after_value INTEGER NOT NULL,
            reason TEXT NOT NULL,
            operator TEXT NOT NULL,
            remark TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (membership_card_id) REFERENCES membership_cards(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
          )
        `);

        // 创建索引提高查询性能
        db.run('CREATE INDEX IF NOT EXISTS idx_appointments_member ON appointments(member_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_appointments_coach ON appointments(coach_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)');
        db.run('CREATE INDEX IF NOT EXISTS idx_consumptions_card ON course_consumptions(membership_card_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_consumptions_member ON course_consumptions(member_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_consumptions_date ON course_consumptions(consumption_date)');
        db.run('CREATE INDEX IF NOT EXISTS idx_exceptions_related ON exception_logs(related_record_id)');

        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            console.log('数据库表创建成功');
            resolve();
          }
        });
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
};

initDatabase()
  .then(() => {
    console.log('数据库初始化完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
