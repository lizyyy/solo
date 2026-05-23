const { run, get, all } = require('../config/dbUtils');

class DeductionRecord {
  static generateNo() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `DK${timestamp}${random}`;
  }

  static async create(data) {
    const deductionNo = data.deduction_no || this.generateNo();
    await run(
      `INSERT INTO deduction_records 
       (deduction_no, plate_number, vehicle_id, subscription_id, event_id, 
        amount, deduction_type, balance_before, balance_after, status, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deductionNo,
        data.plate_number,
        data.vehicle_id || null,
        data.subscription_id || null,
        data.event_id || null,
        data.amount,
        data.deduction_type,
        data.balance_before || null,
        data.balance_after || null,
        data.status || 'success',
        data.remark || null
      ]
    );
    return { id: null, deduction_no: deductionNo };
  }

  static async findByDeductionNo(deductionNo) {
    return await get('SELECT * FROM deduction_records WHERE deduction_no = ?', [deductionNo]);
  }

  static async listByPlate(plateNumber, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return await all(
      `SELECT * FROM deduction_records 
       WHERE plate_number = ? 
       ORDER BY deduction_time DESC LIMIT ? OFFSET ?`,
      [plateNumber, pageSize, offset]
    );
  }

  static async listByDateRange(startDate, endDate) {
    return await all(
      `SELECT * FROM deduction_records 
       WHERE deduction_time >= ? AND deduction_time <= ?
       ORDER BY deduction_time DESC`,
      [startDate, endDate]
    );
  }
}

module.exports = DeductionRecord;
