const express = require('express');
const router = express.Router();
const migrationService = require('../services/migrationService');
const { validate, validateQuery } = require('../middleware/validation');
const logger = require('../utils/logger');

router.get('/scripts', async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const result = await migrationService.listMigrationScripts(
      parseInt(page),
      parseInt(page_size)
    );
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取迁移脚本列表失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scripts/:id', async (req, res) => {
  try {
    const script = await migrationService.getMigrationScript(req.params.id);
    if (!script) {
      return res.status(404).json({ success: false, error: '脚本不存在' });
    }
    res.json({ success: true, data: script });
  } catch (error) {
    logger.error('获取迁移脚本失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scripts', validate('createMigrationScript'), async (req, res) => {
  try {
    const script = await migrationService.createMigrationScript(req.validatedBody);
    res.status(201).json({ success: true, data: script });
  } catch (error) {
    logger.error('创建迁移脚本失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/databases', async (req, res) => {
  try {
    const databases = await migrationService.listTargetDatabases();
    res.json({ success: true, data: databases });
  } catch (error) {
    logger.error('获取目标数据库列表失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/databases/:id', async (req, res) => {
  try {
    const database = await migrationService.getTargetDatabase(req.params.id);
    if (!database) {
      return res.status(404).json({ success: false, error: '数据库不存在' });
    }
    res.json({ success: true, data: database });
  } catch (error) {
    logger.error('获取目标数据库失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/databases', validate('createTargetDatabase'), async (req, res) => {
  try {
    const database = await migrationService.createTargetDatabase(req.validatedBody);
    res.status(201).json({ success: true, data: database });
  } catch (error) {
    logger.error('创建目标数据库失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches', validateQuery('queryBatches'), async (req, res) => {
  try {
    const result = await migrationService.listPreviewBatches(req.validatedQuery);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取预演批次列表失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:id', async (req, res) => {
  try {
    const batch = await migrationService.getPreviewBatch(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error) {
    logger.error('获取预演批次失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:id/details', async (req, res) => {
  try {
    const details = await migrationService.getBatchDetails(req.params.id);
    if (!details.batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.json({ success: true, data: details });
  } catch (error) {
    logger.error('获取批次详情失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:id/export', async (req, res) => {
  try {
    const data = await migrationService.exportBatchData(req.params.id);
    if (!data.batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="batch-${req.params.id}.json"`);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('导出批次数据失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches', validate('createPreviewBatch'), async (req, res) => {
  try {
    const batch = await migrationService.createPreviewBatch(req.validatedBody);
    res.status(201).json({ success: true, data: batch });
  } catch (error) {
    logger.error('创建预演批次失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/batches/:id/status', validate('updateBatchStatus'), async (req, res) => {
  try {
    const batch = await migrationService.updateBatchStatus(req.params.id, req.validatedBody);
    res.json({ success: true, data: batch });
  } catch (error) {
    logger.error('更新批次状态失败', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batches/:id/execute', async (req, res) => {
  try {
    const batch = await migrationService.executePreview(req.params.id);
    res.json({ success: true, data: batch });
  } catch (error) {
    logger.error('执行预演失败', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batches/:id/rollback-validation', validate('rollbackValidation'), async (req, res) => {
  try {
    const validation = await migrationService.createRollbackValidation(req.params.id, req.validatedBody);
    res.status(201).json({ success: true, data: validation });
  } catch (error) {
    logger.error('创建回滚验证失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:id/compensation-actions', validate('createCompensationAction'), async (req, res) => {
  try {
    const action = await migrationService.createCompensationAction(req.params.id, req.validatedBody);
    res.status(201).json({ success: true, data: action });
  } catch (error) {
    logger.error('创建补偿操作失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/compensation-actions/:id/execute', validate('executeCompensation'), async (req, res) => {
  try {
    const action = await migrationService.executeCompensation(req.params.id, req.validatedBody);
    res.json({ success: true, data: action });
  } catch (error) {
    logger.error('执行补偿操作失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await migrationService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('获取统计数据失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
