const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

const subtitleDao = require('../dao/subtitleDao');
const vocabularyDao = require('../dao/vocabularyDao');
const segmentDao = require('../dao/segmentDao');
const feedbackDao = require('../dao/feedbackDao');
const issueDao = require('../dao/issueDao');
const reviewDao = require('../dao/reviewDao');
const checkers = require('../checkers');

router.use(bodyParser.json());

router.get('/stats', async (req, res) => {
  try {
    const [
      subtitleCount,
      vocabCount,
      segmentCount,
      feedbackCount,
      issueStats,
      reviewStats
    ] = await Promise.all([
      subtitleDao.getSubtitleCount(),
      vocabularyDao.getVocabularyCount(),
      segmentDao.getSegmentCount(),
      feedbackDao.getFeedbackCount(),
      issueDao.getIssueStats(),
      reviewDao.getReviewStats()
    ]);
    
    res.json({
      success: true,
      data: {
        subtitles: subtitleCount,
        vocabulary: vocabCount,
        segments: segmentCount,
        feedback: feedbackCount,
        issues: issueStats,
        reviews: reviewStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/subtitles', async (req, res) => {
  try {
    const subtitles = await subtitleDao.getAllSubtitles();
    res.json({ success: true, data: subtitles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/subtitles/:id', async (req, res) => {
  try {
    const subtitle = await subtitleDao.getSubtitleById(parseInt(req.params.id));
    if (!subtitle) {
      return res.status(404).json({ success: false, error: 'Subtitle not found' });
    }
    res.json({ success: true, data: subtitle });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/vocabulary', async (req, res) => {
  try {
    const vocabulary = await vocabularyDao.getAllVocabulary();
    res.json({ success: true, data: vocabulary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/segments', async (req, res) => {
  try {
    const segments = await segmentDao.getAllSegments();
    res.json({ success: true, data: segments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/feedback', async (req, res) => {
  try {
    const feedback = await feedbackDao.getAllFeedback();
    res.json({ success: true, data: feedback });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/feedback/:id', async (req, res) => {
  try {
    const { status, response, closedAt } = req.body;
    await feedbackDao.updateFeedbackStatus(
      parseInt(req.params.id),
      status,
      response,
      closedAt || new Date().toISOString()
    );
    res.json({ success: true, message: 'Feedback updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/issues', async (req, res) => {
  try {
    const { type, status } = req.query;
    let issues;
    
    if (type) {
      issues = await issueDao.getIssuesByType(type);
    } else if (status) {
      issues = await issueDao.getIssuesByStatus(status);
    } else {
      issues = await issueDao.getAllIssues();
    }
    
    res.json({ success: true, data: issues });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/issues/:id', async (req, res) => {
  try {
    const issue = await issueDao.getIssueById(parseInt(req.params.id));
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    res.json({ success: true, data: issue });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/issues/:id', async (req, res) => {
  try {
    const { status, comment } = req.body;
    await issueDao.updateIssueStatus(
      parseInt(req.params.id),
      status,
      comment
    );
    res.json({ success: true, message: 'Issue updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const { itemType, itemId, reviewer, comment, status } = req.body;
    const id = await reviewDao.saveReview({
      itemType,
      itemId: parseInt(itemId),
      reviewer,
      comment,
      status
    });
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const { itemType } = req.query;
    let reviews;
    
    if (itemType) {
      reviews = await reviewDao.getReviewsByType(itemType);
    } else {
      reviews = await reviewDao.getAllReviews();
    }
    
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/check', async (req, res) => {
  try {
    const result = await checkers.runAllChecks();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
