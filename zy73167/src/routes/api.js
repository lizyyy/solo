const express = require('express');
const router = express.Router();
const service = require('../services/attributionService');

router.post('/questions', (req, res) => {
  try {
    const { name, description, subject } = req.body;
    if (!name) return res.status(400).json({ error: 'name 不能为空' });
    const result = service.findOrCreateQuestion(name, { description, subject });
    const q = { ...result.question, display_names: JSON.parse(result.question.display_names || '[]') };
    res.json({ question: q, created: result.created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/questions', (req, res) => {
  try {
    res.json({ questions: service.listQuestions() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/questions/:id', (req, res) => {
  try {
    const q = service.getQuestionById(req.params.id);
    if (!q) return res.status(404).json({ error: '题目不存在' });
    res.json({ question: q });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/questions/:id/answer-versions', (req, res) => {
  try {
    const { version_tag, answer_content, confidence, source } = req.body;
    if (!version_tag || !answer_content) {
      return res.status(400).json({ error: 'version_tag 和 answer_content 不能为空' });
    }
    const result = service.addAnswerVersion(req.params.id, version_tag, answer_content, {
      confidence, source,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/questions/:id/score-notes', (req, res) => {
  try {
    const { content, scorer, score, max_score, request_hash } = req.body;
    if (!content) return res.status(400).json({ error: 'content 不能为空' });
    const result = service.addScoreNote(req.params.id, content, {
      scorer, score, maxScore: max_score, requestHash: request_hash,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/questions/:id/supplements', (req, res) => {
  try {
    const { name, content, type, unit, threshold } = req.body;
    if (!name || !content) {
      return res.status(400).json({ error: 'name 和 content 不能为空' });
    }
    const result = service.addSupplement(req.params.id, name, content, {
      type, unit, threshold,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/questions/:id/confirmations', (req, res) => {
  try {
    const { decision, reason, operator, before_state, after_state } = req.body;
    if (!decision) return res.status(400).json({ error: 'decision 不能为空' });
    const confirmation = service.addConfirmation(req.params.id, decision, {
      reason, operator,
      beforeState: before_state ? JSON.stringify(before_state) : null,
      afterState: after_state ? JSON.stringify(after_state) : null,
    });
    res.json({ confirmation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/questions/:id/report', (req, res) => {
  try {
    const report = service.generateReport(req.params.id);
    if (!report) return res.status(404).json({ error: '题目不存在' });
    res.json({ report });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

module.exports = router;
