const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const BusinessRules = require('../services/businessRules');
const OperationLogService = require('../services/operationLog');

class FineController {
  static async list(req, res) {
    const { status, hazard_id, page = 1, pageSize = 20 } = req.query;
    
    let query = `SELECT f.*, h.description as hazard_description, t.name as team_name 
                 FROM fines f 
                 LEFT JOIN hazards h ON f.hazard_id = h.id 
                 LEFT JOIN teams t ON h.team_id = t.id 
                 WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) as total FROM fines f WHERE 1=1`;
    let params = [];

    if (status) {
      query += ` AND f.status = ?`;
      countQuery += ` AND f.status = ?`;
      params.push(status);
    }
    if (hazard_id) {
      query += ` AND f.hazard_id = ?`;
      countQuery += ` AND f.hazard_id = ?`;
      params.push(hazard_id);
    }

    query += ` ORDER BY f.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      
      db.get(countQuery, params.slice(0, -2), (err, countResult) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        res.json({
          success: true,
          data: rows,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: countResult.total
          }
        });
      });
    });
  }

  static async review(req, res) {
    const { id } = req.params;
    const { status, reviewer, manual_override = false, reason } = req.body;
    const requestId = req.requestId;

    db.get('SELECT * FROM fines WHERE id = ?', [id], async (err, fine) => {
      if (err) {
        await OperationLogService.log(requestId, fine?.hazard_id, '复核罚款', reviewer, null, null, '拦截', err.message);
        return res.status(500).json({ success: false, message: err.message });
      }
      if (!fine) {
        await OperationLogService.log(requestId, null, '复核罚款', reviewer, null, null, '拦截', '罚款记录不存在');
        return res.status(404).json({ success: false, message: '罚款记录不存在' });
      }

      const validation = BusinessRules.validateFineReview(fine.status, status, reviewer);
      
      if (!validation.valid && !manual_override) {
        await OperationLogService.log(requestId, fine.hazard_id, '复核罚款', reviewer, fine, null, '拦截', validation.reason);
        return res.status(400).json({ success: false, message: validation.reason, needManualReview: true });
      }

      const resultType = validation.valid ? '成功' : '人工修正';
      const resultReason = validation.valid ? '罚款复核成功' : `人工审批通过: ${validation.reason}`;

      db.run(
        `UPDATE fines SET status = ?, reviewed_by = ? WHERE id = ?`,
        [status, reviewer, id],
        async (err) => {
          if (err) {
            await OperationLogService.log(requestId, fine.hazard_id, '复核罚款', reviewer, fine, null, '拦截', err.message);
            return res.status(500).json({ success: false, message: err.message });
          }

          const updatedFine = { ...fine, status, reviewed_by: reviewer };
          await OperationLogService.log(requestId, fine.hazard_id, '复核罚款', reviewer, fine, updatedFine, resultType, resultReason);
          res.json({ success: true, message: resultReason, requestId });
        }
      );
    });
  }
}

module.exports = FineController;