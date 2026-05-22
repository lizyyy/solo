const express = require('express');
const router = express.Router();
const { 
  getTaskById, 
  confirmTask, 
  modifyConclusion,
  getCalculationResults,
  getCalculationResultById
} = require('../services/taskService');

router.get('/:id', async (req, res) => {
  try {
    const task = await getTaskById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const { operator } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        error: '缺少操作员信息'
      });
    }
    
    const task = await confirmTask(req.params.id, operator);
    
    res.json({
      success: true,
      data: task,
      message: '人工确认成功'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.put('/results/:resultId/conclusion', async (req, res) => {
  try {
    const { operator, category, subsidyAmount, reason } = req.body;
    
    if (!operator || !category || subsidyAmount === undefined || !reason) {
      return res.status(400).json({
        error: '缺少必填字段: operator, category, subsidyAmount, reason'
      });
    }
    
    const result = await modifyConclusion(
      req.params.resultId,
      operator,
      category,
      subsidyAmount,
      reason
    );
    
    res.json({
      success: true,
      data: result,
      message: '结论修改成功，已记录审计日志'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.get('/:id/results', async (req, res) => {
  try {
    const results = await getCalculationResults(req.params.id);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/results/:resultId', async (req, res) => {
  try {
    const result = await getCalculationResultById(req.params.resultId);
    
    if (!result) {
      return res.status(404).json({
        error: '核算结果不存在'
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
