const { runAsync, getAsync, allAsync } = require('../utils/db');

class BedModel {
  static async create(bedData) {
    const sql = `INSERT OR REPLACE INTO beds 
      (bed_no, ward, department, status, patient_id, updated_at) 
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    return runAsync(sql, [
      bedData.bed_no, bedData.ward, bedData.department, 
      bedData.status || 'available', bedData.patient_id || null
    ]);
  }

  static async findByBedNo(bedNo) {
    return getAsync('SELECT * FROM beds WHERE bed_no = ?', [bedNo]);
  }

  static async findByWard(ward) {
    return allAsync('SELECT * FROM beds WHERE ward = ?', [ward]);
  }

  static async findByDepartment(department) {
    return allAsync('SELECT * FROM beds WHERE department = ?', [department]);
  }

  static async updateStatus(bedNo, status, patientId = null) {
    const sql = `UPDATE beds SET status = ?, patient_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE bed_no = ?`;
    return runAsync(sql, [status, patientId, bedNo]);
  }

  static async getAll() {
    return allAsync('SELECT * FROM beds ORDER BY ward, bed_no');
  }

  static async getOccupiedBeds() {
    return allAsync("SELECT * FROM beds WHERE status = 'occupied'");
  }
}

module.exports = BedModel;
