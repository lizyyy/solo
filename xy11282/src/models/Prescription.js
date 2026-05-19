const db = require('../config/database');

class Prescription {
  static async create(data, items) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          `INSERT INTO prescriptions (petId, doctor, diagnosis, status) VALUES (?, ?, ?, ?)`,
          [data.petId, data.doctor, data.diagnosis, data.status || 'pending'],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const prescriptionId = this.lastID;
            const itemPlaceholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
            const itemValues = [];
            
            items.forEach(item => {
              itemValues.push(
                prescriptionId,
                item.medicineId,
                item.inventoryId,
                item.dosage,
                item.dosageUnit,
                item.totalDosage,
                item.quantity,
                item.notes,
                item.checkReason || '校验通过'
              );
            });
            
            db.run(
              `INSERT INTO prescription_items 
               (prescriptionId, medicineId, inventoryId, dosage, dosageUnit, totalDosage, quantity, notes, checkReason)
               VALUES ${itemPlaceholders}`,
              itemValues,
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                  } else {
                    resolve({ id: prescriptionId, ...data, items });
                  }
                });
              }
            );
          }
        );
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT p.*, pet.name as petName, pet.weight, pet.species
        FROM prescriptions p
        LEFT JOIN pets pet ON p.petId = pet.id
        ORDER BY p.createdAt DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT p.*, pet.name as petName, pet.weight, pet.species
        FROM prescriptions p
        LEFT JOIN pets pet ON p.petId = pet.id
        WHERE p.id = ?
      `, [id], (err, prescription) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!prescription) {
          resolve(null);
          return;
        }
        
        db.all(`
          SELECT pi.*, m.name as medicineName, m.specification, i.batchNumber
          FROM prescription_items pi
          LEFT JOIN medicines m ON pi.medicineId = m.id
          LEFT JOIN inventory i ON pi.inventoryId = i.id
          WHERE pi.prescriptionId = ?
        `, [id], (err, items) => {
          if (err) reject(err);
          else resolve({ ...prescription, items });
        });
      });
    });
  }

  static review(id, reviewer, action, comments) {
    return new Promise((resolve, reject) => {
      const status = action === 'approve' ? 'approved' : 'rejected';
      db.run(
        `UPDATE prescriptions SET status = ?, reviewedBy = ?, reviewNotes = ?, reviewedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, reviewer, comments, id],
        function(err) {
          if (err) reject(err);
          else resolve({ success: this.changes > 0, id, status });
        }
      );
    });
  }
}

module.exports = Prescription;
