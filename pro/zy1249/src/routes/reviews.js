const express = require('express')
const multer = require('multer')
const { reviewService } = require('../services/reviewService')
const { reportGenerator } = require('../services/reportGenerator')
const { getDefaultRules, getAllValidators } = require('../validators')

const router = express.Router()
const upload = multer({ 
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multer.memoryStorage()
})

router.post('/', upload.fields([
  { name: 'openapi', maxCount: 1 },
  { name: 'rules', maxCount: 1 }
]), async (req, res, next) => {
  try {
    let openapiContent
    let originalFilename

    if (req.files && req.files.openapi && req.files.openapi[0]) {
      openapiContent = req.files.openapi[0].buffer.toString('utf-8')
      originalFilename = req.files.openapi[0].originalname
    } else if (req.body.openapi) {
      openapiContent = typeof req.body.openapi === 'string' 
        ? req.body.openapi 
        : JSON.stringify(req.body.openapi)
    }

    if (!openapiContent) {
      return res.status(400).json({
        error: 'Missing OpenAPI specification',
        message: 'Please provide openapi file or openapi content in request body'
      })
    }

    let rulesContent
    let rulesFilename
    if (req.files && req.files.rules && req.files.rules[0]) {
      rulesContent = req.files.rules[0].buffer.toString('utf-8')
      rulesFilename = req.files.rules[0].originalname
    } else if (req.body.rules) {
      rulesContent = typeof req.body.rules === 'string'
        ? req.body.rules
        : JSON.stringify(req.body.rules)
    }

    const result = await reviewService.createReview({
      openapiContent,
      rulesContent,
      apiName: req.body.apiName,
      apiVersion: req.body.apiVersion,
      originalFilename,
      rulesFilename,
      enabledRules: req.body.enabledRules,
      context: {
        userId: req.user?.id,
        requestId: req.id
      }
    })

    res.status(201).json({
      message: 'Review created successfully',
      review: result.review,
      spec: {
        id: result.spec.id,
        name: result.spec.name,
        version: result.spec.version
      },
      statistics: result.statistics
    })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      status: req.query.status,
      apiName: req.query.apiName,
      orderBy: req.query.orderBy || 'createdAt',
      orderDir: req.query.orderDir || 'DESC'
    }

    const result = await reviewService.getReviews(options)

    res.json({
      total: result.total,
      limit: options.limit,
      offset: options.offset,
      reviews: result.reviews
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:reviewId', async (req, res, next) => {
  try {
    const options = {
      includeIssues: req.query.includeIssues !== 'false',
      limit: parseInt(req.query.issueLimit) || 100,
      offset: parseInt(req.query.issueOffset) || 0,
      severity: req.query.severity
    }

    const review = await reviewService.getReview(req.params.reviewId, options)

    res.json(review)
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Review not found',
        message: `Review with id ${req.params.reviewId} not found`
      })
    }
    next(error)
  }
})

router.get('/:reviewId/issues', async (req, res, next) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0,
      severity: req.query.severity,
      category: req.query.category,
      ruleId: req.query.ruleId,
      path: req.query.path
    }

    const result = await reviewService.getReviewIssues(req.params.reviewId, options)

    res.json({
      total: result.total,
      limit: options.limit,
      offset: options.offset,
      issues: result.issues
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:reviewId/report', async (req, res, next) => {
  try {
    const format = req.query.format || 'json'
    const options = {
      format,
      includeCodeExamples: req.query.includeCodeExamples !== 'false',
      includeSuggestions: req.query.includeSuggestions !== 'false'
    }

    const report = await reportGenerator.generateReport(req.params.reviewId, options)

    if (format === 'markdown' || format === 'md') {
      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader('Content-Disposition', `attachment; filename="review-${req.params.reviewId}.md"`)
      return res.send(report)
    }

    res.json(report)
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Review not found',
        message: `Review with id ${req.params.reviewId} not found`
      })
    }
    next(error)
  }
})

router.post('/:reviewId/rerun', async (req, res, next) => {
  try {
    const result = await reviewService.rerunReview(req.params.reviewId, {
      enabledRules: req.body.enabledRules,
      context: req.body.context
    })

    res.json({
      message: 'Review rerun successfully',
      review: result.review,
      score: result.score,
      stats: result.stats
    })
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Review not found',
        message: `Review with id ${req.params.reviewId} not found`
      })
    }
    next(error)
  }
})

router.delete('/:reviewId', async (req, res, next) => {
  try {
    await reviewService.deleteReview(req.params.reviewId)

    res.json({
      message: 'Review deleted successfully',
      reviewId: req.params.reviewId
    })
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Review not found',
        message: `Review with id ${req.params.reviewId} not found`
      })
    }
    next(error)
  }
})

module.exports = router