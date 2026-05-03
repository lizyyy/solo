async function saveOrUpdateCylinder(db, cylinder) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM cylinders WHERE serial_number = ?
    `, [cylinder.serialNumber], (err, existing) => {
      if (err) {
        reject(err);
        return;
      }

      if (existing) {
        db.run(`
          UPDATE cylinders SET
            gas_type = ?,
            capacity = ?,
            manufacturer = ?,
            manufacture_date = ?,
            last_inspection_date = ?,
            next_inspection_date = ?,
            location = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          cylinder.gasType,
          cylinder.capacity,
          cylinder.manufacturer,
          cylinder.manufactureDate,
          cylinder.lastInspectionDate,
          cylinder.nextInspectionDate,
          cylinder.location,
          existing.id
        ], (updateErr) => {
          if (updateErr) {
            reject(updateErr);
            return;
          }
          resolve({
            id: existing.id,
            serialNumber: cylinder.serialNumber,
            action: 'updated'
          });
        });
      } else {
        db.run(`
          INSERT INTO cylinders (
            serial_number, gas_type, capacity, manufacturer, 
            manufacture_date, last_inspection_date, next_inspection_date, 
            status, location
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          cylinder.serialNumber,
          cylinder.gasType,
          cylinder.capacity,
          cylinder.manufacturer,
          cylinder.manufactureDate,
          cylinder.lastInspectionDate,
          cylinder.nextInspectionDate,
          cylinder.status || 'in_stock',
          cylinder.location
        ], function(insertErr) {
          if (insertErr) {
            reject(insertErr);
            return;
          }
          resolve({
            id: this.lastID,
            serialNumber: cylinder.serialNumber,
            action: 'created'
          });
        });
      }
    });
  });
}

async function getCylinderBySerialNumber(db, serialNumber) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM cylinders WHERE serial_number = ?
    `, [serialNumber], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function getCylinderById(db, id) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM cylinders WHERE id = ?
    `, [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function getInventory(db, filters = {}) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM cylinders WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.gasType) {
      query += ' AND gas_type = ?';
      params.push(filters.gasType);
    }
    if (filters.location) {
      query += ' AND location = ?';
      params.push(filters.location);
    }
    if (filters.serialNumber) {
      query += ' AND serial_number LIKE ?';
      params.push(`%${filters.serialNumber}%`);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function getInventoryStats(db) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END) as inStock,
        SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END) as borrowed,
        SUM(CASE WHEN status = 'inspecting' THEN 1 ELSE 0 END) as inspecting,
        SUM(CASE WHEN status = 'scrapped' THEN 1 ELSE 0 END) as scrapped
      FROM cylinders
    `, (err, totalStats) => {
      if (err) {
        reject(err);
        return;
      }

      db.all(`
        SELECT gas_type, COUNT(*) as count
        FROM cylinders
        WHERE status != 'scrapped'
        GROUP BY gas_type
      `, (err2, gasTypeStats) => {
        if (err2) {
          reject(err2);
          return;
        }

        db.all(`
          SELECT location, COUNT(*) as count
          FROM cylinders
          WHERE status = 'in_stock' AND location IS NOT NULL
          GROUP BY location
        `, (err3, locationStats) => {
          if (err3) {
            reject(err3);
            return;
          }

          resolve({
            total: totalStats.total,
            byStatus: {
              inStock: totalStats.inStock || 0,
              borrowed: totalStats.borrowed || 0,
              inspecting: totalStats.inspecting || 0,
              scrapped: totalStats.scrapped || 0
            },
            byGasType: gasTypeStats.reduce((acc, item) => {
              acc[item.gas_type] = item.count;
              return acc;
            }, {}),
            byLocation: locationStats.reduce((acc, item) => {
              acc[item.location] = item.count;
              return acc;
            }, {})
          });
        });
      });
    });
  });
}

async function saveInspection(db, cylinderId, inspection) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO inspections (
        cylinder_id, inspection_date, inspector, result, notes, next_inspection_date
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      cylinderId,
      inspection.inspectionDate,
      inspection.inspector,
      inspection.result,
      inspection.notes,
      inspection.nextInspectionDate
    ], function(err) {
      if (err) {
        reject(err);
        return;
      }

      if (inspection.nextInspectionDate) {
        db.run(`
          UPDATE cylinders 
          SET last_inspection_date = ?, next_inspection_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [inspection.inspectionDate, inspection.nextInspectionDate, cylinderId]);
      }

      resolve({
        id: this.lastID,
        cylinderId,
        result: inspection.result
      });
    });
  });
}

async function getCylinderInspections(db, cylinderId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM inspections 
      WHERE cylinder_id = ? 
      ORDER BY inspection_date DESC
    `, [cylinderId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function getCylinderTransactions(db, cylinderId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM transactions 
      WHERE cylinder_id = ? 
      ORDER BY created_at DESC
    `, [cylinderId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function saveTransfer(db, transfer) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        INSERT INTO transfers (
          transfer_number, from_location, to_location, transfer_date, 
          sender, receiver, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transfer.transferNumber,
        transfer.fromLocation,
        transfer.toLocation,
        transfer.transferDate,
        transfer.sender,
        transfer.receiver,
        transfer.status || 'pending',
        transfer.notes
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }

        const transferId = this.lastID;
        
        if (transfer.items && transfer.items.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO transfer_items (transfer_id, cylinder_id, serial_number, gas_type)
            VALUES (?, ?, ?, ?)
          `);

          for (const item of transfer.items) {
            stmt.run([transferId, null, item.serialNumber, item.gasType]);
          }
          
          stmt.finalize();
        }

        resolve({
          id: transferId,
          transferNumber: transfer.transferNumber
        });
      });
    });
  });
}

async function logAudit(db, audit) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO audit_logs (
        operation, table_name, record_id, old_values, new_values, user, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      audit.operation,
      audit.tableName,
      audit.recordId,
      audit.oldValues,
      audit.newValues,
      audit.user,
      audit.ipAddress
    ], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID });
    });
  });
}

async function getAuditLogs(db, filters = {}) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }
    if (filters.operation) {
      query += ' AND operation = ?';
      params.push(filters.operation);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function createRiskAlert(db, risk) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO risk_alerts (
        cylinder_id, risk_type, risk_level, description
      ) VALUES (?, ?, ?, ?)
    `, [
      risk.cylinderId,
      risk.riskType,
      risk.riskLevel,
      risk.description
    ], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID });
    });
  });
}

async function getRiskAlerts(db, filters = {}) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM risk_alerts WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.riskType) {
      query += ' AND risk_type = ?';
      params.push(filters.riskType);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function getRiskAlertById(db, id) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM risk_alerts WHERE id = ?
    `, [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function reviewRiskAlert(db, id, review) {
  return new Promise((resolve, reject) => {
    const { action, notes, reviewedBy } = review;
    
    let newStatus = 'reviewed';
    if (action === 'dismiss') {
      newStatus = 'dismissed';
    } else if (action === 'resolve') {
      newStatus = 'resolved';
    }

    db.run(`
      UPDATE risk_alerts 
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, notes = ?
      WHERE id = ?
    `, [newStatus, reviewedBy, notes, id], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        id,
        status: newStatus,
        reviewedBy,
        notes
      });
    });
  });
}

module.exports = {
  saveOrUpdateCylinder,
  getCylinderBySerialNumber,
  getCylinderById,
  getInventory,
  getInventoryStats,
  saveInspection,
  getCylinderInspections,
  getCylinderTransactions,
  saveTransfer,
  logAudit,
  getAuditLogs,
  createRiskAlert,
  getRiskAlerts,
  getRiskAlertById,
  reviewRiskAlert
};
