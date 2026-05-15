const express = require('express');
const router = express.Router();
const inspectionService = require('../services/inspection');

router.post('/generate-nightly', async (req, res) => {
  try {
    const { inspectionDate } = req.body;
    const result = inspectionService.generateNightlyInspection(inspectionDate);

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

router.post('/:reportId/add-review-sample', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = inspectionService.addReviewSample(reportId);

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

router.post('/:reportId/review-item/:detailId', async (req, res) => {
  try {
    const { reportId, detailId } = req.params;
    const reviewData = req.body;
    const result = inspectionService.reviewItem(reportId, detailId, reviewData);

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

router.get('/:reportId/trace', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = inspectionService.getInspectionWithRerunTrace(reportId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: '巡检报告不存在'
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

router.get('/', async (req, res) => {
  try {
    const result = inspectionService.listReports();

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