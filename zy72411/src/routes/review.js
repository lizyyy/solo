const express = require('express');
const router = express.Router();
const ReviewService = require('../services/reviewService');

router.get('/pending/:user', (req, res) => {
  try {
    const records = ReviewService.getPendingReviews(req.params.user);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/evidence/:recordId', (req, res) => {
  try {
    const evidence = ReviewService.getConflictEvidence(req.params.recordId);
    res.json(evidence);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conflict/resolve', (req, res) => {
  try {
    const { recordId, conflictIndex, resolution, operator, reason } = req.body;
    const result = ReviewService.resolveConflict(
      recordId,
      conflictIndex,
      resolution,
      operator,
      reason
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/song-name/review', (req, res) => {
  try {
    const { recordId, decision, operator, reason } = req.body;
    const result = ReviewService.reviewSongName(recordId, decision, operator, reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history/:recordId', (req, res) => {
  try {
    const history = ReviewService.getReviewHistory(req.params.recordId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/changes', (req, res) => {
  try {
    const changes = ReviewService.getAllRecordsWithChanges();
    res.json(changes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
