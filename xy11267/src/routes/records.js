const express = require('express');
const router = express.Router();
const {
  createRecord,
  getRecord,
  getRecords,
  updateRecordStatus,
  reRunInspection,
  reRunAllOldRecords,
  getStatistics,
  getRecordCount
} = require('../services/recordService');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
  try {
    const { data, operator, role } = req.body;
    
    if (!data || !operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const result = await createRecord(data, operator, role, req.ip);
    logger.info(`创建质检记录: ${result.recordId}`, { operator, role });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('创建质检记录失败', { error: error.message });
    res.status(500).json({ error: '创建失败' });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('获取统计数据失败', { error: error.message });
    res.status(500).json({ error: '获取失败' });
  }
});

router.get('/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const record = await getRecord(recordId);
    
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    logger.error('获取记录详情失败', { error: error.message });
    res.status(500).json({ error: '获取失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      risk_level: req.query.risk_level,
      session_id: req.query.session_id,
      operator: req.query.operator,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const records = await getRecords(filters);
    const total = await getRecordCount(filters);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset
        }
      }
    });
  } catch (error) {
    logger.error('获取记录列表失败', { error: error.message });
    res.status(500).json({ error: '获取失败' });
  }
});

router.put('/:recordId/status', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { status, inspector, role, reason } = req.body;

    if (!status || !inspector || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const success = await updateRecordStatus(recordId, status, inspector, role, reason, req.ip);
    
    if (!success) {
      return res.status(404).json({ error: '记录不存在' });
    }

    logger.info(`更新记录状态: ${recordId} -> ${status}`, { inspector, role });
    res.json({ success: true });
  } catch (error) {
    logger.error('更新记录状态失败', { error: error.message });
    res.status(500).json({ error: '更新失败' });
  }
});

router.post('/:recordId/rerun', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { operator, role } = req.body;

    if (!operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const result = await reRunInspection(recordId, operator, role, req.ip);
    
    if (!result) {
      return res.status(404).json({ error: '记录不存在' });
    }

    logger.info(`重新质检记录: ${recordId}`, { operator, role });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('重新质检失败', { error: error.message });
    res.status(500).json({ error: '重新质检失败' });
  }
});

router.post('/rerun-all', async (req, res) => {
  try {
    const { operator, role } = req.body;

    if (!operator || !role) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const result = await reRunAllOldRecords(operator, role, req.ip);
    
    logger.info(`批量重新质检: ${result.processed}条记录`, { operator, role });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('批量重新质检失败', { error: error.message });
    res.status(500).json({ error: '批量重新质检失败' });
  }
});

module.exports = router;
