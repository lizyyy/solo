const pool = require('../config/database');
const { OPERATION_TYPE } = require('../constants/status');

class OperationLogService {
  async createLog(data) {
    const {
      reservationId,
      reservationNo,
      operationType,
      operationDesc,
      beforeStatus,
      afterStatus,
      beforeStock,
      afterStock,
      releaseReasonId = null,
      releaseReasonCode = null,
      remark = null,
      operator = 'system',
      operatorIp = null,
      requestId = null
    } = data;

    const sql = `
      INSERT INTO stock_reservation_logs 
      (reservation_id, reservation_no, operation_type, operation_desc, before_status, after_status, 
       before_stock, after_stock, release_reason_id, release_reason_code, remark, operator, operator_ip, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(sql, [
      reservationId,
      reservationNo,
      operationType,
      operationDesc,
      beforeStatus,
      afterStatus,
      beforeStock ? JSON.stringify(beforeStock) : null,
      afterStock ? JSON.stringify(afterStock) : null,
      releaseReasonId,
      releaseReasonCode,
      remark,
      operator,
      operatorIp,
      requestId
    ]);

    return result.insertId;
  }

  async getLogsByReservationId(reservationId) {
    const sql = `
      SELECT * FROM stock_reservation_logs 
      WHERE reservation_id = ? 
      ORDER BY created_at ASC
    `;
    const [rows] = await pool.execute(sql, [reservationId]);
    return rows;
  }

  async getLogsByReservationNo(reservationNo) {
    const sql = `
      SELECT * FROM stock_reservation_logs 
      WHERE reservation_no = ? 
      ORDER BY created_at ASC
    `;
    const [rows] = await pool.execute(sql, [reservationNo]);
    return rows;
  }

  async getLogList(params = {}) {
    const { page = 1, pageSize = 20, operationType, startDate, endDate, operator } = params;
    const offset = (page - 1) * pageSize;

    let whereSql = 'WHERE 1=1';
    const queryParams = [];

    if (operationType) {
      whereSql += ' AND operation_type = ?';
      queryParams.push(operationType);
    }
    if (operator) {
      whereSql += ' AND operator = ?';
      queryParams.push(operator);
    }
    if (startDate) {
      whereSql += ' AND created_at >= ?';
      queryParams.push(startDate);
    }
    if (endDate) {
      whereSql += ' AND created_at <= ?';
      queryParams.push(endDate);
    }

    const countSql = `SELECT COUNT(*) as total FROM stock_reservation_logs ${whereSql}`;
    const [countResult] = await pool.execute(countSql, queryParams);

    const listSql = `
      SELECT * FROM stock_reservation_logs 
      ${whereSql} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    queryParams.push(pageSize, offset);
    const [rows] = await pool.execute(listSql, queryParams);

    return {
      list: rows,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };
  }
}

module.exports = new OperationLogService();
