const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const BusinessRules = require('../services/businessRules');
const OperationLogService = require('../services/operationLog');

class HazardController {
  static async create(req, res) {
    const { description, location, risk_level, team_id, deadline, photo_url, operator } = req.body;
    const requestId = req.requestId;
    const hazardId = uuidv4();

    try {
      const newHazard = {
        id: hazardId,
        description,
        location,
        risk_level: risk_level || '中',
        team_id,
        deadline: deadline || moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss'),
        photo_url,
        status: '待整改'
      };

      db.run(
        `INSERT INTO hazards (id, description, location, risk_level, team_id, deadline, photo_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newHazard.id, newHazard.description, newHazard.location, newHazard.risk_level, 
         newHazard.team_id, newHazard.deadline, newHazard.photo_url, newHazard.status],
        async (err) => {
          if (err) {
            await OperationLogService.log(requestId, hazardId, '创建隐患', operator, null, null, '拦截', err.message);
            return res.status(500).json({ success: false, message: err.message });
          }

          await OperationLogService.log(requestId, hazardId, '创建隐患', operator, null, newHazard, '成功', '隐患创建成功');
          res.json({ success: true, data: newHazard, requestId });
        }
      );
    } catch (error) {
      await OperationLogService.log(requestId, hazardId, '创建隐患', operator, null, null, '拦截', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async list(req, res) {
    const { status, team_id, risk_level, keyword, page = 1, pageSize = 20 } = req.query;
    
    let query = `SELECT h.*, t.name as team_name FROM hazards h LEFT JOIN teams t ON h.team_id = t.id WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) as total FROM hazards h WHERE 1=1`;
    let params = [];

    if (status) {
      query += ` AND h.status = ?`;
      countQuery += ` AND h.status = ?`;
      params.push(status);
    }
    if (team_id) {
      query += ` AND h.team_id = ?`;
      countQuery += ` AND h.team_id = ?`;
      params.push(team_id);
    }
    if (risk_level) {
      query += ` AND h.risk_level = ?`;
      countQuery += ` AND h.risk_level = ?`;
      params.push(risk_level);
    }
    if (keyword) {
      query += ` AND (h.description LIKE ? OR h.location LIKE ?)`;
      countQuery += ` AND (h.description LIKE ? OR h.location LIKE ?)`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ` ORDER BY h.created_at DESC LIMIT ? OFFSET ?`;
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

  static async get(req, res) {
    const { id } = req.params;
    
    db.get(`SELECT h.*, t.name as team_name FROM hazards h LEFT JOIN teams t ON h.team_id = t.id WHERE h.id = ?`, [id], async (err, hazard) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      if (!hazard) {
        return res.status(404).json({ success: false, message: '隐患不存在' });
      }

      const timeline = await OperationLogService.getTimeline(id);
      res.json({ success: true, data: { ...hazard, timeline } });
    });
  }

  static async updateDeadline(req, res) {
    const { id } = req.params;
    const { new_deadline, reason, operator, manual_override = false } = req.body;
    const requestId = req.requestId;

    db.get('SELECT * FROM hazards WHERE id = ?', [id], async (err, hazard) => {
      if (err) {
        await OperationLogService.log(requestId, id, '变更期限', operator, null, null, '拦截', err.message);
        return res.status(500).json({ success: false, message: err.message });
      }
      if (!hazard) {
        await OperationLogService.log(requestId, id, '变更期限', operator, null, null, '拦截', '隐患不存在');
        return res.status(404).json({ success: false, message: '隐患不存在' });
      }

      const validation = BusinessRules.validateDeadlineChange(hazard.deadline, new_deadline, reason);
      
      if (!validation.valid && !manual_override) {
        await OperationLogService.log(requestId, id, '变更期限', operator, hazard, null, '拦截', validation.reason);
        return res.status(400).json({ success: false, message: validation.reason, needManualReview: true });
      }

      const resultType = validation.valid ? '成功' : '人工修正';
      const resultReason = validation.valid ? '期限变更成功' : `人工审批通过: ${validation.reason}`;

      db.run(
        `UPDATE hazards SET deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [new_deadline, id],
        async (err) => {
          if (err) {
            await OperationLogService.log(requestId, id, '变更期限', operator, hazard, null, '拦截', err.message);
            return res.status(500).json({ success: false, message: err.message });
          }

          db.run(
            `INSERT INTO deadline_changes (id, hazard_id, old_deadline, new_deadline, reason, operator)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), id, hazard.deadline, new_deadline, reason, operator]
          );

          const updatedHazard = { ...hazard, deadline: new_deadline };
          await OperationLogService.log(requestId, id, '变更期限', operator, hazard, updatedHazard, resultType, resultReason);
          res.json({ success: true, message: resultReason, requestId });
        }
      );
    });
  }

  static async submitReview(req, res) {
    const { id } = req.params;
    const { opinion, result, reviewer, photo_url, manual_override = false } = req.body;
    const requestId = req.requestId;

    db.get('SELECT * FROM hazards WHERE id = ?', [id], async (err, hazard) => {
      if (err) {
        await OperationLogService.log(requestId, id, '提交复查', reviewer, null, null, '拦截', err.message);
        return res.status(500).json({ success: false, message: err.message });
      }
      if (!hazard) {
        await OperationLogService.log(requestId, id, '提交复查', reviewer, null, null, '拦截', '隐患不存在');
        return res.status(404).json({ success: false, message: '隐患不存在' });
      }

      const validation = BusinessRules.validateReviewOpinion(hazard.status, opinion);
      
      if (!validation.valid && !manual_override) {
        await OperationLogService.log(requestId, id, '提交复查', reviewer, hazard, null, '拦截', validation.reason);
        return res.status(400).json({ success: false, message: validation.reason, needManualReview: true });
      }

      const resultType = validation.valid ? '成功' : '人工修正';
      const resultReason = validation.valid ? '复查提交成功' : `人工审批通过: ${validation.reason}`;

      const reviewId = uuidv4();
      db.run(
        `INSERT INTO reviews (id, hazard_id, reviewer, opinion, result, photo_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [reviewId, id, reviewer, opinion, result, photo_url],
        async (err) => {
          if (err) {
            await OperationLogService.log(requestId, id, '提交复查', reviewer, hazard, null, '拦截', err.message);
            return res.status(500).json({ success: false, message: err.message });
          }

          const newStatus = result === '通过' ? '已通过' : result === '不通过' ? '已罚款' : '整改中';
          
          db.run(`UPDATE hazards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, id]);

          const fineInfo = BusinessRules.calculateOverdueFine(hazard.deadline, new Date(), hazard.risk_level);
          if (fineInfo.overdue) {
            db.run(
              `INSERT INTO fines (id, hazard_id, amount, reason, status)
               VALUES (?, ?, ?, ?, ?)`,
              [uuidv4(), id, fineInfo.amount, fineInfo.reason, '待复核']
            );
          }

          const updatedHazard = { ...hazard, status: newStatus };
          await OperationLogService.log(requestId, id, '提交复查', reviewer, hazard, updatedHazard, resultType, resultReason);
          res.json({ success: true, message: resultReason, fineInfo, requestId });
        }
      );
    });
  }

  static async getHighRiskList(req, res) {
    db.all(
      `SELECT h.*, t.name as team_name 
       FROM hazards h 
       LEFT JOIN teams t ON h.team_id = t.id 
       WHERE h.risk_level IN ('高', '极高') AND h.status NOT IN ('已通过', '已罚款')
       ORDER BY h.created_at DESC`,
      (err, rows) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
      }
    );
  }
}

module.exports = HazardController;