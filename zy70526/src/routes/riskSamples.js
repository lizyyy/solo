const express = require('express');
const router = express.Router();
const RiskSample = require('../models/RiskSample');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { validate } = require('../middleware/validation');

router.post('/', validate('riskSample'), async (req, res) => {
  try {
    const sample = await RiskSample.create(req.body);
    res.status(201).json({
      message: '风险样本创建成功',
      data: sample
    });
  } catch (err) {
    res.status(500).json({
      error: '创建风险样本失败',
      code: 'SAMPLE_CREATE_ERROR',
      message: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      dataset_id: req.query.dataset_id,
      status: req.query.status,
      risk_level: req.query.risk_level
    };
    const samples = await RiskSample.findAll(filters);
    res.json({ data: samples });
  } catch (err) {
    res.status(500).json({
      error: '获取风险样本列表失败',
      code: 'SAMPLE_LIST_ERROR',
      message: err.message
    });
  }
});

router.post('/:id/correction', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, correction_reason, new_risk_level, new_status, new_identified_fields, remarks } = req.body;

    if (!operator || !correction_reason) {
      return res.status(400).json({
        error: '操作者和修正原因为必填项',
        code: 'CORRECTION_PARAM_ERROR'
      });
    }

    const oldSample = await RiskSample.findById(id);
    if (!oldSample) {
      return res.status(404).json({
        error: '风险样本不存在',
        code: 'SAMPLE_NOT_FOUND'
      });
    }

    const updates = [];
    const params = [];
    
    if (new_risk_level) {
      updates.push('risk_level = ?');
      params.push(new_risk_level);
    }
    if (new_status) {
      updates.push('status = ?');
      params.push(new_status);
    }
    if (new_identified_fields !== undefined) {
      updates.push('identified_fields = ?');
      params.push(JSON.stringify(new_identified_fields));
    }

    if (updates.length > 0) {
      params.push(id);
      await new Promise((resolveUpdate, rejectUpdate) => {
        db.run(
          `UPDATE risk_samples SET ${updates.join(', ')} WHERE id = ?`,
          params,
          function(err) {
            if (err) rejectUpdate(err);
            else resolveUpdate();
          }
        );
      });
    }

    const correctionId = uuidv4();
    const correctionData = {
      id: correctionId,
      risk_sample_id: id,
      operator,
      correction_reason,
      old_risk_level: oldSample.risk_level,
      new_risk_level: new_risk_level || oldSample.risk_level,
      old_status: oldSample.status,
      new_status: new_status || oldSample.status,
      old_identified_fields: oldSample.identified_fields,
      new_identified_fields: new_identified_fields || oldSample.identified_fields,
      remarks,
      created_at: new Date().toISOString()
    };

    await new Promise((resolveInsert, rejectInsert) => {
      db.run(
        `INSERT INTO manual_corrections 
         (id, risk_sample_id, operator, correction_reason, old_risk_level, new_risk_level, 
          old_status, new_status, old_identified_fields, new_identified_fields, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [correctionId, id, operator, correction_reason, 
         correctionData.old_risk_level, correctionData.new_risk_level,
         correctionData.old_status, correctionData.new_status,
         JSON.stringify(correctionData.old_identified_fields), 
         JSON.stringify(correctionData.new_identified_fields),
         remarks],
        function(err) {
          if (err) rejectInsert(err);
          else resolveInsert();
        }
      );
    });

    res.json({
      message: '人工修正成功',
      data: correctionData
    });
  } catch (err) {
    res.status(500).json({
      error: '人工修正失败',
      code: 'CORRECTION_ERROR',
      message: err.message
    });
  }
});

router.get('/:id/corrections', async (req, res) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM manual_corrections WHERE risk_sample_id = ? ORDER BY created_at DESC',
        [req.params.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const corrections = rows.map(row => ({
      ...row,
      old_identified_fields: row.old_identified_fields ? JSON.parse(row.old_identified_fields) : [],
      new_identified_fields: row.new_identified_fields ? JSON.parse(row.new_identified_fields) : []
    }));

    res.json({ data: corrections });
  } catch (err) {
    res.status(500).json({
      error: '获取修正记录失败',
      code: 'CORRECTION_LIST_ERROR',
      message: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sample = await RiskSample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({
        error: '风险样本不存在',
        code: 'SAMPLE_NOT_FOUND'
      });
    }
    res.json({ data: sample });
  } catch (err) {
    res.status(500).json({
      error: '获取风险样本失败',
      code: 'SAMPLE_GET_ERROR',
      message: err.message
    });
  }
});

router.patch('/:id/status', validate('statusUpdate'), async (req, res) => {
  try {
    const updated = await RiskSample.updateStatus(req.params.id, req.body.status);
    if (!updated) {
      return res.status(404).json({
        error: '风险样本不存在',
        code: 'SAMPLE_NOT_FOUND'
      });
    }
    res.json({
      message: '风险样本状态更新成功',
      status: req.body.status
    });
  } catch (err) {
    res.status(400).json({
      error: '更新风险样本状态失败',
      code: 'SAMPLE_STATUS_ERROR',
      message: err.message
    });
  }
});

module.exports = router;
