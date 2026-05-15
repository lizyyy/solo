const express = require('express');
const router = express.Router();
const queryService = require('../services/query');

router.get('/tasks', async (req, res) => {
  try {
    const filters = req.query;
    const result = await queryService.queryTasks(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/tasks/:detailId/trace', async (req, res) => {
  try {
    const { detailId } = req.params;
    const result = await queryService.getTaskTrace(detailId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: '任务明细不存在'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const result = await queryService.getStatistics();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;