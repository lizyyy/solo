const { Qualification, STATUS, SOURCE_TYPES } = require('../models/Qualification');
const { db } = require('../database');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const multer = require('multer');
const fs = require('fs');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const qualificationController = {
  async create(req, res) {
    try {
      const { member_id, activity_id, reason, operator_id, operator_name } = req.body;
      
      if (!member_id || !activity_id || !reason) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const hasConflict = await Qualification.checkConflict(member_id, activity_id);
      if (hasConflict) {
        return res.status(409).json({ error: '该成员在此活动中已有有效资格记录' });
      }

      const result = await Qualification.create({
        member_id,
        activity_id,
        source_type: SOURCE_TYPES.MANUAL,
        reason,
        operator_id,
        operator_name
      });

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { reason, operator_id, operator_name } = req.body;

      if (!reason) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const result = await Qualification.update(id, { reason, operator_id, operator_name });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async review(req, res) {
    try {
      const { id } = req.params;
      const { approved, remark, operator_id, operator_name } = req.body;

      if (typeof approved !== 'boolean') {
        return res.status(400).json({ error: 'approved 必须是布尔值' });
      }

      const result = await Qualification.review(id, approved, remark, operator_id, operator_name);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async revoke(req, res) {
    try {
      const { id } = req.params;
      const { reason, operator_id, operator_name } = req.body;

      if (!reason) {
        return res.status(400).json({ error: '缺少撤销原因' });
      }

      const result = await Qualification.revoke(id, reason, operator_id, operator_name);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async list(req, res) {
    try {
      const filters = {
        member_id: req.query.member_id,
        activity_id: req.query.activity_id,
        status: req.query.status
      };

      const result = await Qualification.list(filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async detail(req, res) {
    try {
      const { id } = req.params;
      const result = await Qualification.getDetail(id);
      
      if (!result) {
        return res.status(404).json({ error: '资格记录不存在' });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async export(req, res) {
    try {
      const filters = {
        member_id: req.query.member_id,
        activity_id: req.query.activity_id,
        status: req.query.status
      };

      const data = await Qualification.export(filters);
      
      const fields = [
        'qualification_id',
        'member_id',
        'member_name',
        'group_name',
        'activity_id',
        'activity_name',
        'source_type',
        'reason',
        'status',
        'operator_name',
        'created_at',
        'is_in_group'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=qualifications.csv');
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async batchImport(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传CSV文件' });
      }

      const { operator_id, operator_name } = req.body;
      const results = [];
      const errors = [];
      let rowIndex = 0;

      const rows = await new Promise((resolve, reject) => {
        const data = [];
        const bufferStream = require('stream').Readable.from(req.file.buffer);
        
        bufferStream
          .pipe(csv())
          .on('data', (row) => data.push(row))
          .on('end', () => resolve(data))
          .on('error', reject);
      });

      for (const row of rows) {
        rowIndex++;
        try {
          const { member_id, activity_id, reason } = row;
          
          if (!member_id || !activity_id || !reason) {
            errors.push({
              row: rowIndex,
              error: '缺少必要字段',
              data: row
            });
            continue;
          }

          const member = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM members WHERE member_id = ?`, [member_id], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          if (!member) {
            errors.push({
              row: rowIndex,
              error: '成员不存在',
              data: row
            });
            continue;
          }

          if (!member.is_in_group) {
            errors.push({
              row: rowIndex,
              error: '成员已退群',
              member_name: member.member_name,
              data: row
            });
            continue;
          }

          const hasConflict = await Qualification.checkConflict(member_id, activity_id);
          if (hasConflict) {
            errors.push({
              row: rowIndex,
              error: '该成员在此活动中已有有效资格记录',
              member_name: member.member_name,
              data: row
            });
            continue;
          }

          const result = await Qualification.create({
            member_id,
            activity_id,
            source_type: SOURCE_TYPES.BATCH_IMPORT,
            reason,
            operator_id,
            operator_name
          });

          results.push({
            row: rowIndex,
            success: true,
            qualification_id: result.id,
            member_name: member.member_name
          });
        } catch (error) {
          errors.push({
            row: rowIndex,
            error: error.message,
            data: row
          });
        }
      }

      res.json({
        total: rows.length,
        success: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = { qualificationController, upload };
