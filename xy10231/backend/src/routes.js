import express from 'express';
import {
  getStatistics,
  runFullPipeline,
  getPendingReviews,
  getMatchDetails,
  submitFeedback,
  getPipelineHistory,
  getChangeLogs,
  getFeedbackForMatch,
  getCurrentPipeline
} from './services/pipelineService.js';

const router = express.Router();

router.get('/stats', (req, res) => {
  try {
    const stats = getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pipeline/status', (req, res) => {
  try {
    const current = getCurrentPipeline();
    const history = getPipelineHistory(10);
    res.json({
      current,
      history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pipeline/run', (req, res) => {
  try {
    const { lost_items, found_items } = req.body;
    
    if (!lost_items && !found_items) {
      return res.status(400).json({ error: '请提供失物数据或招领数据' });
    }
    
    const result = runFullPipeline(
      lost_items || [],
      found_items || []
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/matches/pending', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const matches = getPendingReviews(limit);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/matches/:id', (req, res) => {
  try {
    const match = getMatchDetails(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    const feedback = getFeedbackForMatch(req.params.id);
    const changes = getChangeLogs('matches', req.params.id, 20);
    
    res.json({
      match,
      feedback,
      changes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/matches/:id/feedback', (req, res) => {
  try {
    const { feedback_type, feedback_note, operator } = req.body;
    
    if (!['confirm', 'reject', 'note'].includes(feedback_type)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }
    
    const result = submitFeedback(
      req.params.id,
      feedback_type,
      feedback_note || '',
      operator || 'anonymous'
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/changelog', (req, res) => {
  try {
    const { entity_type, entity_id, limit } = req.query;
    const logs = getChangeLogs(
      entity_type || null,
      entity_id || null,
      parseInt(limit) || 50
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
