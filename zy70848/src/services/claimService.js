const db = require('../models/database');
const { Parser } = require('json2csv');
const importService = require('./importService');

class ClaimService {
  async updateRecordStatus(recordId, newStatus, handler, reviewOpinion) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT status FROM claim_records WHERE id = ?`,
        [recordId],
        async (err, record) => {
          if (err) {
            reject(err);
            return;
          }

          const previousStatus = record ? record.status : null;

          db.run(
            `UPDATE claim_records 
             SET status = ?, reviewer = ?, review_opinion = ?, review_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newStatus, handler, reviewOpinion, recordId],
            async (err) => {
              if (err) {
                reject(err);
                return;
              }

              await importService.addProcessingLog(
                recordId,
                'manual_review',
                reviewOpinion,
                handler,
                previousStatus,
                newStatus
              );

              resolve({ success: true, recordId, newStatus });
            }
          );
        }
      );
    });
  }

  async approveRecord(recordId, handler, reviewOpinion = '人工审核通过，材料齐全') {
    return this.updateRecordStatus(recordId, 'approved', handler, reviewOpinion);
  }

  async returnForRevision(recordId, handler, reviewOpinion) {
    return this.updateRecordStatus(recordId, 'returned', handler, reviewOpinion);
  }

  async requestMoreMaterials(recordId, handler, reviewOpinion) {
    return this.updateRecordStatus(recordId, 'needs_materials', handler, reviewOpinion);
  }

  async queryRecords(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT cr.*, b.batch_no, b.material_version, b.batch_name
        FROM claim_records cr
        LEFT JOIN batches b ON cr.batch_id = b.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.caseNo) {
        sql += ` AND cr.case_no LIKE ?`;
        params.push(`%${filters.caseNo}%`);
      }

      if (filters.materialVersion) {
        sql += ` AND b.material_version LIKE ?`;
        params.push(`%${filters.materialVersion}%`);
      }

      if (filters.reviewOpinion) {
        sql += ` AND cr.review_opinion LIKE ?`;
        params.push(`%${filters.reviewOpinion}%`);
      }

      if (filters.status) {
        sql += ` AND cr.status = ?`;
        params.push(filters.status);
      }

      if (filters.batchId) {
        sql += ` AND cr.batch_id = ?`;
        params.push(filters.batchId);
      }

      sql += ` ORDER BY cr.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getRecordLogs(recordId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM processing_logs WHERE record_id = ? ORDER BY created_at DESC`,
        [recordId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getBatches() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM batches ORDER BY created_at DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async exportToCSV(records) {
    const fields = [
      { label: '案件号', value: 'case_no' },
      { label: '批次号', value: 'batch_no' },
      { label: '材料版本', value: 'material_version' },
      { label: '保单号', value: 'policy_no' },
      { label: '报案人', value: 'claimant_name' },
      { label: '身份证号', value: 'id_card' },
      { label: '理赔金额', value: 'claim_amount' },
      { label: '是否有发票', value: (row) => row.has_invoice === 1 ? '是' : '否' },
      { label: '状态', value: 'status' },
      { label: '复核人', value: 'reviewer' },
      { label: '复核意见', value: 'review_opinion' },
      { label: '复核时间', value: 'review_time' },
      { label: '创建时间', value: 'created_at' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(records);
  }

  async getStatistics() {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'auto_approved' THEN 1 ELSE 0 END) as auto_approved,
          SUM(CASE WHEN status = 'needs_manual_review' THEN 1 ELSE 0 END) as needs_review,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
          SUM(CASE WHEN status = 'needs_materials' THEN 1 ELSE 0 END) as needs_materials
        FROM claim_records`,
        [],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });
  }
}

module.exports = new ClaimService();
