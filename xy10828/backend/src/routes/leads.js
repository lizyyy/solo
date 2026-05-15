const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const { allQuery, getQuery } = require('../database');
const dedupeService = require('../services/dedupeService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, company, source, source_id } = req.body;
    const requestId = req.headers['x-request-id'] || uuidv4();

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '手机号或邮箱至少提供一项',
        requestId
      });
    }

    const result = await dedupeService.processNewLead({
      name, phone, email, company, source, source_id
    }, requestId);

    res.json({
      success: true,
      requestId,
      ...result
    });
  } catch (error) {
    console.error('创建线索错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, source, page = 1, limit = 20 } = req.query;
    
    let query = `SELECT * FROM leads WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (source) {
      query += ` AND source = ?`;
      params.push(source);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const leads = await allQuery(query, params);

    const countResult = await getQuery(
      `SELECT COUNT(*) as total FROM leads WHERE 1=1${status ? ' AND status = ?' : ''}${source ? ' AND source = ?' : ''}`,
      status && source ? [status, source] : status ? [status] : source ? [source] : []
    );

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (error) {
    console.error('查询列表错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await allQuery(`
      SELECT status, COUNT(*) as count 
      FROM leads 
      GROUP BY status
    `);

    const sourceStats = await allQuery(`
      SELECT source, COUNT(*) as count 
      FROM leads 
      GROUP BY source
    `);

    const total = stats.reduce((sum, s) => sum + s.count, 0);

    res.json({
      success: true,
      data: {
        total,
        byStatus: stats,
        bySource: sourceStats
      }
    });
  } catch (error) {
    console.error('统计错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const details = await dedupeService.getLeadDetails(req.params.id);
    
    if (!details) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '线索不存在'
      });
    }

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('查询详情错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/approve-merge', async (req, res) => {
  try {
    const { suggestionId, resolvedFields, operator = 'admin' } = req.body;

    if (!suggestionId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: '缺少 suggestionId'
      });
    }

    const result = await dedupeService.approveMerge(suggestionId, resolvedFields, operator);

    res.json({
      success: true,
      data: result,
      message: '合并已批准'
    });
  } catch (error) {
    console.error('批准合并错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/:id/reject-duplicate', async (req, res) => {
  try {
    const { operator = 'admin' } = req.body;

    await dedupeService.rejectDuplicate(req.params.id, operator);

    res.json({
      success: true,
      message: '已确认非重复'
    });
  } catch (error) {
    console.error('拒绝重复错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
        id, name, phone, email, company, source, status,
        created_at, updated_at
      FROM leads
    `;
    const params = [];

    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    const leads = await allQuery(query, params);

    const fields = ['id', 'name', 'phone', 'email', 'company', 'source', 'status', 'created_at', 'updated_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(leads);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('导出错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/export/logs', async (req, res) => {
  try {
    const logs = await allQuery(`
      SELECT 
        pl.id, pl.lead_id, l.name as lead_name, pl.action, pl.status, pl.details, pl.operator, pl.created_at
      FROM processing_logs pl
      JOIN leads l ON pl.lead_id = l.id
      ORDER BY pl.created_at DESC
    `);

    const fields = ['id', 'lead_id', 'lead_name', 'action', 'status', 'details', 'operator', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(logs);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="processing_logs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('导出日志错误:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
