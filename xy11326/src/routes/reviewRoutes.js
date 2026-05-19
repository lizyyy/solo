const express = require('express');
const { reviewRecord, batchReview, getPendingRecords, getRecordReviews } = require('../services/reviewService');

const router = express.Router();

router.get('/pending', async (req, res) => {
  try {
    const records = await getPendingRecords(req.query);
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id', async (req, res) => {
  try {
    const reviewer = req.headers['x-operator'] || 'system';
    const result = await reviewRecord(req.params.id, req.body, reviewer);
    
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

router.post('/batch', async (req, res) => {
  try {
    const reviewer = req.headers['x-operator'] || 'system';
    const { recordIds, reviewResult, reviewComments } = req.body;
    
    if (!recordIds || !Array.isArray(recordIds)) {
      return res.status(400).json({
        success: false,
        error: '请提供记录ID数组'
      });
    }
    
    const result = await batchReview(recordIds, { reviewResult, reviewComments }, reviewer);
    
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

router.get('/record/:workRecordId', async (req, res) => {
  try {
    const reviews = await getRecordReviews(req.params.workRecordId);
    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
