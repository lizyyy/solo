const express = require('express');
const router = express.Router();
const cleaningService = require('../services/cleaningService');
const exportService = require('../services/exportService');
const ruleService = require('../services/ruleService');

router.post('/', async (req, res) => {
  try {
    const record = await cleaningService.createRecord(req.body);
    res.status(201).json({
      success: true,
      data: record,
      message: record.status === 'blocked' ? '记录已被拦截，请查看原因' : '记录创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      cleaner_name: req.query.cleaner_name,
      status: req.query.status,
      exception_type: req.query.exception_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      room_number: req.query.room_number
    };

    const result = await cleaningService.getRecords(filters);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const filters = {
      cleaner_name: req.query.cleaner_name,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const summary = await cleaningService.getSummary(filters);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await cleaningService.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const record = await cleaningService.updateRecord(req.params.id, req.body);
    res.json({
      success: true,
      data: record,
      message: '更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:id/audit', async (req, res) => {
  try {
    const record = await cleaningService.auditRecord(req.params.id, req.body);
    res.json({
      success: true,
      data: record,
      message: '审核成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:id/rework', async (req, res) => {
  try {
    const record = await cleaningService.createRework(req.params.id, req.body);
    res.json({
      success: true,
      data: record,
      message: '返工记录创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:id/audit-logs', async (req, res) => {
  try {
    const logs = await ruleService.getAuditLogs(req.params.id);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      cleaner_name: req.query.cleaner_name,
      status: req.query.status,
      exception_type: req.query.exception_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      room_number: req.query.room_number
    };

    const result = await exportService.exportToCSV(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send('\uFEFF' + result.csv);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/export/data', async (req, res) => {
  try {
    const filters = {
      cleaner_name: req.query.cleaner_name,
      status: req.query.status,
      exception_type: req.query.exception_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      room_number: req.query.room_number
    };

    const result = await exportService.getExportData(filters);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
