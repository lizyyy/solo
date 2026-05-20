const express = require('express');
const router = express.Router();
const { 
  processBatch, 
  getBatch, 
  getBatchResults, 
  getBatchStats, 
  listBatches,
  getDailySummaries
} = require('../services/batchService');
const { exportToCSV } = require('../services/exportService');

router.post('/', async (req, res) => {
  try {
    const { submitter, records } = req.body;

    if (!submitter || !records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        error: '参数不完整',
        message: '需要提供 submitter 和非空的 records 数组'
      });
    }

    const requiredFields = ['object_id', 'object_name', 'checkin_date', 'risk_level'];
    for (const record of records) {
      for (const field of requiredFields) {
        if (!record[field]) {
          return res.status(400).json({
            error: '记录字段缺失',
            message: `每条记录必须包含 ${requiredFields.join(', ')} 字段`,
            record
          });
        }
      }
    }

    const result = await processBatch(submitter, records);

    if (result.isDuplicate) {
      return res.status(200).json({
        warning: '检测到重复提交',
        message: '该批次材料已提交过，返回原有处理结果',
        ...result
      });
    }

    res.status(201).json({
      message: '批次处理完成',
      ...result
    });
  } catch (error) {
    console.error('处理批次失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const batches = await listBatches(limit);
    res.json(batches);
  } catch (error) {
    console.error('获取批次列表失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await getBatch(batchId);

    if (!batch) {
      return res.status(404).json({
        error: '未找到',
        message: '该批次不存在'
      });
    }

    res.json(batch);
  } catch (error) {
    console.error('获取批次信息失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/:batchId/results', async (req, res) => {
  try {
    const { batchId } = req.params;
    const results = await getBatchResults(batchId);
    res.json(results);
  } catch (error) {
    console.error('获取处理结果失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/:batchId/stats', async (req, res) => {
  try {
    const { batchId } = req.params;
    const stats = await getBatchStats(batchId);

    if (!stats) {
      return res.status(404).json({
        error: '未找到',
        message: '该批次不存在'
      });
    }

    res.json(stats);
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/:batchId/summaries', async (req, res) => {
  try {
    const { batchId } = req.params;
    const summaries = await getDailySummaries(batchId);
    res.json(summaries);
  } catch (error) {
    console.error('获取每日汇总失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

router.get('/:batchId/export', async (req, res) => {
  try {
    const { batchId } = req.params;
    const exportResult = await exportToCSV(batchId);

    if (!exportResult) {
      return res.status(404).json({
        error: '未找到',
        message: '该批次不存在或无数据可导出'
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=warning_report_${batchId}.csv`);
    res.setHeader('X-Record-Count', exportResult.recordCount);
    
    if (exportResult.stats) {
      res.setHeader('X-Stats', JSON.stringify({
        normal: exportResult.stats.batch.normal_count,
        pending: exportResult.stats.batch.pending_count,
        blocked: exportResult.stats.batch.blocked_count
      }));
    }

    res.send('\uFEFF' + exportResult.csv);
  } catch (error) {
    console.error('导出CSV失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

module.exports = router;
