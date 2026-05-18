const express = require('express');
const router = express.Router();
const degradeService = require('../services/degradeService');
const exportService = require('../services/exportService');
const fs = require('fs');

router.post('/degrade', async (req, res) => {
  try {
    const { cache_key, business_line, degrade_reason, executor } = req.body;
    
    if (!cache_key || !business_line || !degrade_reason || !executor) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段: cache_key, business_line, degrade_reason, executor'
      });
    }

    const result = await degradeService.createDegrade(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { applicant } = req.body;
    
    if (!applicant) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段: applicant'
      });
    }

    const result = await degradeService.applyRestore(parseInt(id), applicant);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/cleanup/:taskId/confirm', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { operator } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段: operator'
      });
    }

    const result = await degradeService.confirmCleanup(parseInt(taskId), operator);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/records', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      business_line: req.query.business_line,
      cache_key: req.query.cache_key,
      limit: req.query.limit ? parseInt(req.query.limit) : null
    };

    const records = await degradeService.queryRecords(filters);
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/cleanup-tasks', async (req, res) => {
  try {
    const filters = {
      status: req.query.status
    };

    const tasks = await degradeService.queryCleanupTasks(filters);
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/export/records', async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const filters = {
      status: req.query.status,
      business_line: req.query.business_line
    };

    const records = await degradeService.queryRecords(filters);
    const { filePath, filename } = await exportService.exportDegradeRecords(records, format);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/export/cleanup-tasks', async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const filters = {
      status: req.query.status
    };

    const tasks = await degradeService.queryCleanupTasks(filters);
    const { filePath, filename } = await exportService.exportCleanupTasks(tasks, format);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/cache-hit', async (req, res) => {
  try {
    const { cache_key, value_type, is_null_cache } = req.body;
    
    if (!cache_key) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段: cache_key'
      });
    }

    const hitResult = await degradeService.recordCacheHit(
      cache_key, 
      value_type || 'unknown', 
      is_null_cache || false
    );

    const cleanupResult = await degradeService.checkAndMarkCleanup(cache_key);

    res.json({
      success: true,
      data: {
        cache_hit: hitResult,
        cleanup_marked: cleanupResult
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await degradeService.getRecordById(parseInt(id));
    
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;