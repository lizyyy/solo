const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const ReviewService = require('../services/ReviewService');
const { maskData } = require('../utils/mask');

router.get('/pending', async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const result = await ReviewService.getPendingReviews(type);
    
    const isAdmin = req.user?.role === 'admin';
    
    if (result.visitors) {
      result.visitors = isAdmin ? result.visitors : maskData(result.visitors);
    }
    if (result.temporaryPlates) {
      result.temporaryPlates = isAdmin ? result.temporaryPlates : maskData(result.temporaryPlates);
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get pending reviews error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/visitor/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '状态必须是 approved 或 rejected' });
    }
    
    const result = await ReviewService.reviewVisitor(
      parseInt(id), status, remark, req.user?.username || 'system'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Review visitor error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/temporary-plate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '状态必须是 approved 或 rejected' });
    }
    
    const result = await ReviewService.reviewTemporaryPlate(
      parseInt(id), status, remark, req.user?.username || 'system'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Review plate error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { type, ids, status, remark } = req.body;
    
    if (!type || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供类型和ID列表' });
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '状态必须是 approved 或 rejected' });
    }
    
    const result = await ReviewService.bulkReview(
      type, ids.map(id => parseInt(id)), status, remark, req.user?.username || 'system'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Bulk review error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/list/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const filters = {
      reviewStatus: req.query.reviewStatus
    };
    
    const result = await ReviewService.getReviewedList(type, filters);
    
    const isAdmin = req.user?.role === 'admin';
    const maskedResult = isAdmin ? result : maskData(result);
    
    res.json({ success: true, data: maskedResult });
  } catch (error) {
    logger.error('Get reviewed list error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/add-blacklist', async (req, res) => {
  try {
    const { type, targetId, reason, level } = req.body;
    
    if (!type || !targetId || !reason) {
      return res.status(400).json({ error: '请提供类型、目标ID和原因' });
    }
    
    const result = await ReviewService.addToBlacklist(
      type, parseInt(targetId), reason, level || 'normal', req.user?.username || 'system'
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Add to blacklist error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
