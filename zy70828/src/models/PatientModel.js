const { runAsync, getAsync, allAsync } = require('../utils/db');

class PatientModel {
  static async create(patientData) {
    const sql = `INSERT OR REPLACE INTO patients 
      (patient_id, name, gender, age, diagnosis, from_department, to_department, status, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    return runAsync(sql, [
      patientData.patient_id, patientData.name, patientData.gender,
      patientData.age, patientData.diagnosis, patientData.from_department,
      patientData.to_department, patientData.status || 'pending'
    ]);
  }

  static async findByPatientId(patientId) {
    return getAsync('SELECT * FROM patients WHERE patient_id = ?', [patientId]);
  }

  static async findByStatus(status) {
    return allAsync('SELECT * FROM patients WHERE status = ?', [status]);
  }

  static async updateStatus(patientId, status) {
    const sql = `UPDATE patients SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE patient_id = ?`;
    return runAsync(sql, [status, patientId]);
  }

  static async getAll() {
    return allAsync('SELECT * FROM patients ORDER BY created_at DESC');
  }
}

module.exports = PatientModel;
