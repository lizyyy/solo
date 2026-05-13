const db = require('../config/database');
const { ApprovalStatus } = require('../utils/constants');

class ApprovalRecordModel {
  static async findByRequestId(requestId, client = null) {
    const query = client || db;
    const result = await query.query(
      'SELECT * FROM approval_records WHERE request_id = $1',
      [requestId]
    );
    return result.rows[0];
  }

  static async create(data, client) {
    const result = await client.query(`
      INSERT INTO approval_records (
        request_id, quota_id, quota_code, apply_amount, 
        applicant, reason, status, expired_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.requestId,
      data.quotaId,
      data.quotaCode,
      data.applyAmount,
      data.applicant,
      data.reason,
      ApprovalStatus.PENDING,
      data.expiredAt,
    ]);
    return result.rows[0];
  }

  static async updateStatus(id, status, approver, comments, client) {
    const result = await client.query(`
      UPDATE approval_records 
      SET status = $2, approver = $3, approval_comments = $4
      WHERE id = $1 AND status = '${ApprovalStatus.PENDING}'
      RETURNING *
    `, [id, status, approver, comments]);
    return result.rows[0];
  }

  static async expirePendingRecords(client) {
    const result = await client.query(`
      UPDATE approval_records 
      SET status = '${ApprovalStatus.EXPIRED}'
      WHERE status = '${ApprovalStatus.PENDING}' AND expired_at <= CURRENT_TIMESTAMP
      RETURNING *
    `);
    return result.rows;
  }

  static async getStatistics(client = null) {
    const query = client || db;
    const result = await query.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(apply_amount) as total_amount
      FROM approval_records
      GROUP BY status
    `);
    return result.rows;
  }

  static async getPendingForRelease(client) {
    const result = await client.query(`
      SELECT ar.*, q.id as quota_id, q.quota_code
      FROM approval_records ar
      JOIN quotas q ON ar.quota_id = q.id
      WHERE ar.status IN ('${ApprovalStatus.REJECTED}', '${ApprovalStatus.CANCELED}', '${ApprovalStatus.EXPIRED}')
      AND NOT EXISTS (
        SELECT 1 FROM quota_operations qo 
        WHERE qo.approval_record_id = ar.id 
        AND qo.operation_type = 'release'
      )
    `);
    return result.rows;
  }
}

module.exports = ApprovalRecordModel;
