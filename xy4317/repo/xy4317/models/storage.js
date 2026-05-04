const { db } = require('./database');

const storage = {
  getBuildings: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM buildings', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getBuildingByCode: (buildingCode) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM buildings WHERE building_code = ?', [buildingCode], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  createBuilding: (buildingData) => {
    return new Promise((resolve, reject) => {
      const { building_code, building_name, total_floors, units_per_floor, total_units } = buildingData;
      db.run(`
        INSERT INTO buildings (building_code, building_name, total_floors, units_per_floor, total_units)
        VALUES (?, ?, ?, ?, ?)
      `, [building_code, building_name, total_floors, units_per_floor, total_units], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...buildingData });
      });
    });
  },

  getHouseholdsByBuilding: (buildingId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM households WHERE building_id = ?', [buildingId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getHouseholdByUnit: (buildingId, unitNumber) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM households WHERE building_id = ? AND unit_number = ?', [buildingId, unitNumber], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  createHousehold: (householdData) => {
    return new Promise((resolve, reject) => {
      const { building_id, unit_number, floor, owner_name, phone, area } = householdData;
      db.run(`
        INSERT INTO households (building_id, unit_number, floor, owner_name, phone, area)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [building_id, unit_number, floor, owner_name || null, phone || null, area || null], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...householdData });
      });
    });
  },

  updateHousehold: (householdId, householdData) => {
    return new Promise((resolve, reject) => {
      const { owner_name, phone, area } = householdData;
      db.run(`
        UPDATE households SET owner_name = ?, phone = ?, area = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [owner_name || null, phone || null, area || null, householdId], function(err) {
        if (err) reject(err);
        else resolve({ id: householdId, changes: this.changes });
      });
    });
  },

  getSignatures: () => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT s.*, h.unit_number, h.floor, h.building_id, b.building_name, b.building_code
        FROM signatures s
        JOIN households h ON s.household_id = h.id
        JOIN buildings b ON h.building_id = b.id
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getSignatureByHousehold: (householdId) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM signatures WHERE household_id = ?', [householdId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  createSignature: (signatureData) => {
    return new Promise((resolve, reject) => {
      const { household_id, is_agree, signature_date, notes } = signatureData;
      db.run(`
        INSERT INTO signatures (household_id, is_agree, signature_date, notes)
        VALUES (?, ?, ?, ?)
      `, [household_id, is_agree ? 1 : 0, signature_date, notes || null], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...signatureData });
      });
    });
  },

  getConstructionBatches: () => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT cb.*, b.building_name, b.building_code
        FROM construction_batches cb
        JOIN buildings b ON cb.building_id = b.id
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  createConstructionBatch: (batchData) => {
    return new Promise((resolve, reject) => {
      const { batch_name, building_id, start_date, end_date, work_hours_start, work_hours_end, status } = batchData;
      db.run(`
        INSERT INTO construction_batches (batch_name, building_id, start_date, end_date, work_hours_start, work_hours_end, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [batch_name, building_id, start_date, end_date, work_hours_start, work_hours_end, status || 'pending'], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...batchData });
      });
    });
  },

  getComplaints: () => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT c.*, h.unit_number, h.floor, b.building_name, b.building_code
        FROM complaints c
        LEFT JOIN households h ON c.household_id = h.id
        JOIN buildings b ON c.building_id = b.id
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  createComplaint: (complaintData) => {
    return new Promise((resolve, reject) => {
      const { building_id, household_id, complaint_date, complaint_type, description, status, resolution } = complaintData;
      db.run(`
        INSERT INTO complaints (building_id, household_id, complaint_date, complaint_type, description, status, resolution)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [building_id, household_id || null, complaint_date, complaint_type, description, status || 'pending', resolution || null], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...complaintData });
      });
    });
  },

  getValidationRules: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM validation_rules WHERE is_active = 1', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          rule_config: JSON.parse(row.rule_config)
        })));
      });
    });
  },

  getBuildingSignaturesSummary: (buildingId) => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          h.floor,
          COUNT(DISTINCT h.id) as total_households,
          COUNT(DISTINCT s.id) as signed_count,
          SUM(CASE WHEN s.is_agree = 1 THEN 1 ELSE 0 END) as agree_count,
          SUM(CASE WHEN s.is_agree = 0 THEN 1 ELSE 0 END) as oppose_count
        FROM households h
        LEFT JOIN signatures s ON h.id = s.household_id
        WHERE h.building_id = ?
        GROUP BY h.floor
        ORDER BY h.floor
      `, [buildingId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getHouseholdWithSignature: (buildingId, unitNumber) => {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT h.*, s.is_agree, s.signature_date, s.notes as signature_notes
        FROM households h
        LEFT JOIN signatures s ON h.id = s.household_id
        WHERE h.building_id = ? AND h.unit_number = ?
      `, [buildingId, unitNumber], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

module.exports = storage;
