const { run, get, all } = require('../config/dbUtils');

class SupplementaryDeduction {
  static generateNo() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BK${timestamp}${random}`;
  }

  static async create(data) {
    const supplementaryNo = data.supplementary_no || this.generateNo();
    const result = await run(
      `INSERT INTO supplementary_deductions 
       (supplementary_no, plate_number, original_event_id, amount, reason, applicant, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        supplementaryNo,
        data.plate_number,
        data.original_event_id || null,
        data.amount,
        data.reason,
        data.applicant || null,
        'pending'
      ]
    );
    return { id: result.lastID, supplementary_no: supplementaryNo, status: 'pending' };
  }

  static async findById(id) {
    return await get('SELECT * FROM supplementary_deductions WHERE id = ?', [id]);
  }

  static async findBySupplementaryNo(supplementaryNo) {
    return await get('SELECT * FROM supplementary_deductions WHERE supplementary_no = ?', [supplementaryNo]);
  }

  static async updateStatus(id, status, reviewer, reviewRemark) {
    return await run(
      `UPDATE supplementary_deductions 
       SET status = ?, reviewer = ?, review_remark = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, reviewer, reviewRemark, id]
    );
  }

  static async markDeducted(id) {
    return await run(
      `UPDATE supplementary_deductions 
       SET status = 'deducted', deducted_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  }

  static async listByStatus(status, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return await all(
      `SELECT * FROM supplementary_deductions 
       WHERE status = ? 
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [status, pageSize, offset]
    );
  }

  static async listByPlate(plateNumber) {
    return await all(
      `SELECT * FROM supplementary_deductions 
       WHERE plate_number = ? 
       ORDER BY created_at DESC`,
      [plateNumber]
    );
  }
}

module.exports = SupplementaryDeduction;
