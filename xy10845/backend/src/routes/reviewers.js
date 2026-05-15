const express = require('express');
const router = express.Router();
const ReviewerModel = require('../models/ReviewerModel');

router.post('/', async (req, res) => {
  try {
    const result = await ReviewerModel.createReviewer(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const reviewers = await ReviewerModel.getAllActiveReviewers();
    res.json({ success: true, data: reviewers });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
