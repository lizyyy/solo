const { runAsync, getAsync, allAsync } = require('../utils/db');

class PatientTransferModel {
  static async create(transferData) {
    const sql = `INSERT OR REPLACE INTO patient_transfers 
      (transfer_id, patient_id, from_department, to_department, from_bed, to_bed, transfer_type, transfer_time, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    return runAsync(sql, [
      transferData.transfer_id, transferData.patient_id,
      transferData.from_department, transferData.to_department,
      transferData.from_bed, transferData.to_bed,
      transferData.transfer_type, transferData.transfer_time,
      transferData.status || 'pending'
    ]);
  }

  static async findByTransferId(transferId) {
    return getAsync('SELECT * FROM patient_transfers WHERE transfer_id = ?', [transferId]);
  }

  static async findByPatientId(patientId) {
    return allAsync('SELECT * FROM patient_transfers WHERE patient_id = ? ORDER BY transfer_time DESC', [patientId]);
  }

  static async updateStatus(transferId, status) {
    const sql = `UPDATE patient_transfers SET status = ? WHERE transfer_id = ?`;
    return runAsync(sql, [status, transferId]);
  }

  static async getAll() {
    return allAsync('SELECT * FROM patient_transfers ORDER BY created_at DESC');
  }
}

module.exports = PatientTransferModel;
