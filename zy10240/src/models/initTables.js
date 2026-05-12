const db = require('../config/database');

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contact_person TEXT,
          phone TEXT,
          address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          name TEXT NOT NULL,
          floor TEXT,
          area TEXT,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS plants (
          id TEXT PRIMARY KEY,
          location_id TEXT,
          name TEXT NOT NULL,
          species TEXT,
          pot_number TEXT UNIQUE,
          status TEXT NOT NULL,
          rental_start_date DATE,
          monthly_rent REAL DEFAULT 0,
          current_value REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (location_id) REFERENCES locations(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS maintenance_tasks (
          id TEXT PRIMARY KEY,
          plant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          scheduled_date DATE NOT NULL,
          task_type TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          assigned_to TEXT,
          completed_at DATETIME,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT UNIQUE,
          FOREIGN KEY (plant_id) REFERENCES plants(id),
          FOREIGN KEY (location_id) REFERENCES locations(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS repotting_records (
          id TEXT PRIMARY KEY,
          plant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          maintenance_task_id TEXT,
          repot_date DATE NOT NULL,
          old_pot_number TEXT,
          new_pot_number TEXT,
          reason TEXT,
          handled_by TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT UNIQUE,
          FOREIGN KEY (plant_id) REFERENCES plants(id),
          FOREIGN KEY (location_id) REFERENCES locations(id),
          FOREIGN KEY (maintenance_task_id) REFERENCES maintenance_tasks(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS withering_treatments (
          id TEXT PRIMARY KEY,
          plant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          maintenance_task_id TEXT,
          treatment_date DATE NOT NULL,
          treatment_type TEXT NOT NULL,
          severity TEXT,
          result TEXT,
          handled_by TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT UNIQUE,
          FOREIGN KEY (plant_id) REFERENCES plants(id),
          FOREIGN KEY (location_id) REFERENCES locations(id),
          FOREIGN KEY (maintenance_task_id) REFERENCES maintenance_tasks(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS compensations (
          id TEXT PRIMARY KEY,
          plant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          withering_treatment_id TEXT,
          amount REAL NOT NULL,
          reason TEXT,
          status TEXT NOT NULL,
          approved_by TEXT,
          approved_at DATETIME,
          handled_by TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT UNIQUE,
          FOREIGN KEY (plant_id) REFERENCES plants(id),
          FOREIGN KEY (location_id) REFERENCES locations(id),
          FOREIGN KEY (withering_treatment_id) REFERENCES withering_treatments(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS plant_movements (
          id TEXT PRIMARY KEY,
          plant_id TEXT NOT NULL,
          from_location_id TEXT NOT NULL,
          to_location_id TEXT NOT NULL,
          move_date DATE NOT NULL,
          reason TEXT,
          handled_by TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT UNIQUE,
          FOREIGN KEY (plant_id) REFERENCES plants(id),
          FOREIGN KEY (from_location_id) REFERENCES locations(id),
          FOREIGN KEY (to_location_id) REFERENCES locations(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS renewal_contracts (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          location_id TEXT,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status TEXT NOT NULL,
          total_amount REAL DEFAULT 0,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT UNIQUE,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (location_id) REFERENCES locations(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS renewal_bills (
          id TEXT PRIMARY KEY,
          renewal_contract_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          bill_date DATE NOT NULL,
          due_date DATE,
          plant_details TEXT,
          rental_amount REAL DEFAULT 0,
          compensation_amount REAL DEFAULT 0,
          total_amount REAL DEFAULT 0,
          status TEXT NOT NULL,
          paid_at DATETIME,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT UNIQUE,
          FOREIGN KEY (renewal_contract_id) REFERENCES renewal_contracts(id),
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS operation_history (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL,
          record_id TEXT NOT NULL,
          record_type TEXT NOT NULL,
          action TEXT NOT NULL,
          old_data TEXT,
          new_data TEXT,
          operated_by TEXT NOT NULL,
          operated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          request_id TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS request_deduplication (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE NOT NULL,
          operation_type TEXT NOT NULL,
          record_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_request_id ON request_deduplication(request_id);
        CREATE INDEX IF NOT EXISTS idx_plant_status ON plants(status);
        CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_bill_status ON renewal_bills(status);
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

module.exports = initTables;
