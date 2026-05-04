const express = require('express');
const router = express.Router();
const { uploadMultiple } = require('../utils/uploadConfig');
const { 
  createBatch, 
  processBatchFiles, 
  getBatchDetails,
  addReview,
  resolveRisk
} = require('../services/batchService');
const { exportAuditMarkdown, exportAuditJSON } = require('../services/exportService');
const { Batch, Vehicle, RiskRecord, Review } = require('../models');
const { Op } = require('sequelize');

const uploadFields = [
  { name: 'weighingCSV', maxCount: 10 },
  { name: 'waybillJSON', maxCount: 10 },
  { name: 'gpsTrack', maxCount: 5 }
];

router.post('/', async (req, res) => {
  try {
    const { vehicleId, date, driverName, batchNumber } = req.body;
    
    const batch = await createBatch({
      vehicleId,
      date,
      driverName,
      batchNumber
    });
    
    res.status(201).json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:batchId/upload', uploadMultiple(uploadFields), async (req, res) => {
  try {
    const { batchId } = req.params;
    const files = req.files || {};
    
    const results = await processBatchFiles(batchId, files);
    
    res.status(200).json({
      success: true,
      data: {
        message: '文件处理完成',
        weighingRecords: results.weighingRecords,
        waybills: results.waybills,
        gpsTracks: results.gpsTracks,
        risksFound: results.risks.length
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { date, status, hasRisks, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    if (date) where.date = date;
    if (status) where.status = status;
    if (hasRisks !== undefined) where.hasRisks = hasRisks === 'true';
    
    const { count, rows } = await Batch.findAndCountAll({
      where,
      include: [
        { model: Vehicle, as: 'vehicle' }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        items: rows
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const details = await getBatchDetails(batchId);
    
    if (!details) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      });
    }
    
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:batchId/review', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { reviewerName, comment, decision } = req.body;
    
    if (!reviewerName || !decision) {
      return res.status(400).json({
        success: false,
        error: '复核人和决定是必填项'
      });
    }
    
    const validDecisions = ['approve', 'reject', 'pending', 'escalate'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        error: `决定值无效，有效值: ${validDecisions.join(', ')}`
      });
    }
    
    const review = await addReview(batchId, {
      reviewerName,
      comment,
      decision
    });
    
    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/risks/:riskId/resolve', async (req, res) => {
  try {
    const { riskId } = req.params;
    const { resolvedBy, resolutionNote } = req.body;
    
    if (!resolvedBy) {
      return res.status(400).json({
        success: false,
        error: '解决人是必填项'
      });
    }
    
    const risk = await resolveRisk(riskId, {
      resolvedBy,
      resolutionNote
    });
    
    res.json({
      success: true,
      data: risk
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export/markdown', async (req, res) => {
  try {
    const { date } = req.query;
    
    const markdown = await exportAuditMarkdown(date);
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${date || 'today'}.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const { date } = req.query;
    
    const auditData = await exportAuditJSON(date);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${date || 'today'}.json"`);
    res.json(auditData);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
