const express = require('express');
const router = express.Router();
const ArticleService = require('../models/articleService');
const { asyncHandler, validateArticleData } = require('../middleware/errorHandler');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

router.post('/', asyncHandler(async (req, res) => {
  const validationErrors = validateArticleData(req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: '数据验证失败',
      errors: validationErrors,
      original_input: req.body
    });
  }

  const existing = await ArticleService.getArticle(req.body.article_no);
  if (existing) {
    return res.status(409).json({
      error: '文章编号已存在',
      article_no: req.body.article_no,
      original_input: req.body
    });
  }

  const article = await ArticleService.createArticle(req.body);
  res.status(201).json(article);
}));

router.get('/:articleNo', asyncHandler(async (req, res) => {
  const article = await ArticleService.getArticle(req.params.articleNo);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }
  res.json(article);
}));

router.get('/', asyncHandler(async (req, res) => {
  const filters = {
    team: req.query.team,
    status: req.query.status,
    is_expired: req.query.is_expired === 'true',
    soon_expire_days: req.query.soon_expire_days ? parseInt(req.query.soon_expire_days) : null
  };
  const articles = await ArticleService.listArticles(filters);
  res.json(articles);
}));

router.get('/:articleNo/validity', asyncHandler(async (req, res) => {
  const validity = await ArticleService.checkValidity(req.params.articleNo);
  if (!validity) {
    return res.status(404).json({ error: '文章不存在' });
  }
  res.json(validity);
}));

router.post('/:articleNo/cite', asyncHandler(async (req, res) => {
  const article = await ArticleService.getArticle(req.params.articleNo);
  if (!article) {
    return res.status(404).json({ error: '文章不存在' });
  }
  const result = await ArticleService.incrementCitation(
    req.params.articleNo,
    req.body.cited_by
  );
  res.json(result);
}));

router.post('/:articleNo/review/start', asyncHandler(async (req, res) => {
  try {
    const result = await ArticleService.startReview(
      req.params.articleNo,
      req.body.reviewer
    );
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}));

router.post('/review/:reviewId/submit', asyncHandler(async (req, res) => {
  const { review_opinion, suggested_valid_until } = req.body;
  if (!review_opinion) {
    return res.status(400).json({ error: 'review_opinion 是必填字段' });
  }
  const result = await ArticleService.submitReview(
    req.params.reviewId,
    review_opinion,
    suggested_valid_until
  );
  res.json(result);
}));

router.get('/:articleNo/reviews', asyncHandler(async (req, res) => {
  const reviews = await ArticleService.getReviewRecords(req.params.articleNo);
  res.json(reviews);
}));

router.post('/:articleNo/takedown', asyncHandler(async (req, res) => {
  const result = await ArticleService.takeDown(req.params.articleNo);
  res.json(result);
}));

router.patch('/:articleNo/correct', asyncHandler(async (req, res) => {
  try {
    const result = await ArticleService.manualCorrection(
      req.params.articleNo,
      req.body
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: '文章不存在' });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

router.post('/report/generate', asyncHandler(async (req, res) => {
  const report = await ArticleService.generateExpiryReport(req.body.report_type || 'daily');
  res.json(report);
}));

router.get('/export/csv', asyncHandler(async (req, res) => {
  const articles = await ArticleService.listArticles(req.query);
  const exportPath = path.join(__dirname, '../../data/export.csv');
  
  const csvWriter = createCsvWriter({
    path: exportPath,
    header: [
      { id: 'article_no', title: '文章编号' },
      { id: 'title', title: '标题' },
      { id: 'team', title: '所属团队' },
      { id: 'author', title: '作者' },
      { id: 'valid_until', title: '有效期' },
      { id: 'status', title: '状态' },
      { id: 'citation_count', title: '引用次数' },
      { id: 'created_at', title: '创建时间' }
    ]
  });

  await csvWriter.writeRecords(articles);
  
  res.download(exportPath, 'knowledge_base_articles.csv');
}));

module.exports = router;
