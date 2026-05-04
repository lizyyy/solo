const express = require('express');
const reviewService = require('../services/reviewService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { riskId, reviewerId, reviewerName, decision, comments } = req.body;

    if (!riskId) {
      return res.status(400).json({
        success: false,
        error: '请提供风险ID (riskId)'
      });
    }

    if (!reviewerId) {
      return res.status(400).json({
        success: false,
        error: '请提供复核人ID (reviewerId)'
      });
    }

    if (!reviewerName) {
      return res.status(400).json({
        success: false,
        error: '请提供复核人姓名 (reviewerName)'
      });
    }

    if (!decision) {
      return res.status(400).json({
        success: false,
        error: '请提供复核决定 (decision)，有效值: confirm, dismiss, escalate'
      });
    }

    if (!comments || comments.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供复核意见 (comments)'
      });
    }

    const result = await reviewService.reviewRisk(
      riskId, 
      reviewerId, 
      reviewerName, 
      decision, 
      comments
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { riskId, decision } = req.query;
    let reviews;

    if (riskId) {
      reviews = reviewService.getReviewsByRiskId(riskId);
    } else if (decision) {
      reviews = reviewService.getReviewsByDecision(decision);
    } else {
      reviews = reviewService.getAllReviews();
    }

    const sortedReviews = [...reviews].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json({
      success: true,
      count: sortedReviews.length,
      reviews: sortedReviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = reviewService.getRiskReviewSummary();
    res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = reviewService.getReviewById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        error: '复核记录不存在'
      });
    }

    res.json({
      success: true,
      review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
