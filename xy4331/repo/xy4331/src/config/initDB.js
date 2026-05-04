const { runAsync, allAsync } = require('./database');

const initTables = async () => {
  try {
    await runAsync(`
      CREATE TABLE IF NOT EXISTS animals (
        id TEXT PRIMARY KEY,
        animal_id TEXT UNIQUE NOT NULL,
        species TEXT NOT NULL,
        strain TEXT,
        gender TEXT,
        birth_date TEXT,
        arrival_date TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS cages (
        id TEXT PRIMARY KEY,
        cage_id TEXT UNIQUE NOT NULL,
        rack_id TEXT NOT NULL,
        position TEXT,
        max_capacity INTEGER DEFAULT 5,
        current_occupancy INTEGER DEFAULT 0,
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS cage_occupancy (
        id TEXT PRIMARY KEY,
        animal_id TEXT NOT NULL,
        cage_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_active INTEGER DEFAULT 1,
        transfer_reason TEXT,
        transferred_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (animal_id) REFERENCES animals(animal_id),
        FOREIGN KEY (cage_id) REFERENCES cages(cage_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS sensor_alerts (
        id TEXT PRIMARY KEY,
        alert_id TEXT UNIQUE NOT NULL,
        cage_id TEXT NOT NULL,
        sensor_type TEXT NOT NULL,
        threshold_value REAL,
        measured_value REAL NOT NULL,
        alert_time TEXT NOT NULL,
        severity TEXT DEFAULT 'warning',
        status TEXT DEFAULT 'open',
        acknowledged_by TEXT,
        acknowledged_at TEXT,
        resolution_notes TEXT,
        resolved_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cage_id) REFERENCES cages(cage_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS transfer_records (
        id TEXT PRIMARY KEY,
        transfer_id TEXT UNIQUE NOT NULL,
        animal_id TEXT NOT NULL,
        from_cage_id TEXT,
        to_cage_id TEXT NOT NULL,
        transfer_date TEXT NOT NULL,
        transfer_reason TEXT,
        performed_by TEXT NOT NULL,
        verified_by TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (animal_id) REFERENCES animals(animal_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS veterinary_orders (
        id TEXT PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        animal_id TEXT NOT NULL,
        examination_date TEXT NOT NULL,
        symptoms TEXT,
        diagnosis TEXT,
        treatment_plan TEXT,
        medications TEXT,
        observation_period_days INTEGER DEFAULT 7,
        start_observation_date TEXT,
        veterinarian_signature TEXT,
        signature_date TEXT,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (animal_id) REFERENCES animals(animal_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS care_inspections (
        id TEXT PRIMARY KEY,
        inspection_id TEXT UNIQUE NOT NULL,
        cage_id TEXT NOT NULL,
        inspection_date TEXT NOT NULL,
        inspector TEXT NOT NULL,
        general_condition TEXT,
        food_level TEXT,
        water_level TEXT,
        bedding_condition TEXT,
        abnormal_signs TEXT,
        actions_taken TEXT,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cage_id) REFERENCES cages(cage_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS animal_timelines (
        id TEXT PRIMARY KEY,
        animal_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_id TEXT,
        event_time TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (animal_id) REFERENCES animals(animal_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS validation_violations (
        id TEXT PRIMARY KEY,
        violation_type TEXT NOT NULL,
        severity TEXT DEFAULT 'high',
        related_entity_type TEXT,
        related_entity_id TEXT,
        description TEXT NOT NULL,
        detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'open',
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_comments TEXT,
        resolution_notes TEXT,
        resolved_at TEXT
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS review_decisions (
        id TEXT PRIMARY KEY,
        violation_id TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        decision TEXT NOT NULL,
        comments TEXT,
        action_items TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (violation_id) REFERENCES validation_violations(id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS import_sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        import_type TEXT NOT NULL,
        file_name TEXT,
        record_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        errors TEXT,
        imported_by TEXT,
        imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'completed'
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        old_values TEXT,
        new_values TEXT,
        performed_by TEXT,
        performed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT
      )
    `);

    console.log('所有表初始化完成');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_animals_animal_id ON animals(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_cages_cage_id ON cages(cage_id)',
      'CREATE INDEX IF NOT EXISTS idx_cage_occupancy_animal ON cage_occupancy(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_cage_occupancy_cage ON cage_occupancy(cage_id)',
      'CREATE INDEX IF NOT EXISTS idx_sensor_alerts_cage ON sensor_alerts(cage_id)',
      'CREATE INDEX IF NOT EXISTS idx_sensor_alerts_status ON sensor_alerts(status)',
      'CREATE INDEX IF NOT EXISTS idx_transfer_records_animal ON transfer_records(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_veterinary_orders_animal ON veterinary_orders(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_care_inspections_cage ON care_inspections(cage_id)',
      'CREATE INDEX IF NOT EXISTS idx_animal_timelines_animal ON animal_timelines(animal_id)',
      'CREATE INDEX IF NOT EXISTS idx_validation_violations_status ON validation_violations(status)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(performed_at)'
    ];

    for (const indexSql of indexes) {
      await runAsync(indexSql);
    }

    console.log('所有索引创建完成');

  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
};

module.exports = { initTables };
