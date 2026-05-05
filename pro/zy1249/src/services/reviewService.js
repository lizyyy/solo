const { Review, Issue, OpenApiSpec, RulesConfig } = require('../models')
const { ruleEngine } = require('./ruleEngine')
const { openapiParser } = require('./openapiParser')
const crypto = require('crypto')
const yaml = require('yaml')

class ReviewService {
  async createReview(options) {
    const { 
      openapiContent, 
      rulesContent,
      apiName,
      apiVersion,
      originalFilename,
      rulesFilename,
      enabledRules = null,
      context = {}
    } = options

    let spec
    try {
      spec = openapiParser.parse(openapiContent)
    } catch (error) {
      throw new Error(`Invalid OpenAPI specification: ${error.message}`)
    }

    const validation = openapiParser.validate(spec)
    if (!validation.valid) {
      throw new Error(`OpenAPI validation failed: ${validation.errors.join(', ')}`)
    }

    const fileHash = crypto
      .createHash('sha256')
      .update(openapiContent)
      .digest('hex')

    const specInfo = openapiParser.extractInfo(spec)
    const stats = openapiParser.getStatistics(spec)

    const [openapiSpec] = await OpenApiSpec.findOrCreate({
      where: { fileHash },
      defaults: {
        name: apiName || specInfo.title || 'Untitled API',
        version: apiVersion || specInfo.version,
        openapiVersion: stats.version,
        content: openapiContent,
        fileHash,
        originalFilename,
        title: specInfo.title,
        description: specInfo.description,
        baseUrl: stats.servers?.[0]?.url,
        metadata: {
          statistics: stats
        }
      }
    })

    let rulesConfigId = null
    if (rulesContent) {
      const rulesHash = crypto
        .createHash('sha256')
        .update(rulesContent)
        .digest('hex')

      let ruleOverrides = {}
      try {
        const rulesData = yaml.parse(rulesContent)
        if (rulesData.rules || rulesData.overrides) {
          ruleOverrides = rulesData.rules || rulesData.overrides
        }
      } catch (error) {
        console.warn('Failed to parse rules config:', error.message)
      }

      const [rulesConfig] = await RulesConfig.findOrCreate({
        where: { fileHash: rulesHash },
        defaults: {
          name: rulesFilename || 'Custom Rules',
          content: rulesContent,
          fileHash: rulesHash,
          originalFilename: rulesFilename,
          ruleOverrides
        }
      })

      rulesConfigId = rulesConfig.id
    }

    const review = await Review.create({
      apiName: apiName || specInfo.title || 'Untitled API',
      apiVersion: apiVersion || specInfo.version,
      openapiSpecId: openapiSpec.id,
      rulesConfigId,
      status: 'pending',
      metadata: {
        statistics: stats,
        enabledRules
      }
    })

    process.nextTick(() => {
      this.runReview(review.id, spec, rulesContent, enabledRules, context)
        .catch(error => {
          console.error('Background review failed:', error)
        })
    })

    return {
      review: await Review.findByPk(review.id),
      spec: openapiSpec,
      statistics: stats
    }
  }

  async runReview(reviewId, spec, rulesContent = null, enabledRules = null, context = {}) {
    const review = await Review.findByPk(reviewId)
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`)
    }

    await review.update({
      status: 'running',
      startedAt: new Date()
    })

    let rulesConfig = null
    if (review.rulesConfigId) {
      rulesConfig = await RulesConfig.findByPk(review.rulesConfigId)
    }

    const startTime = Date.now()

    try {
      const result = await ruleEngine.validate(spec, {
        rulesConfig,
        enabledRules,
        context
      })

      const sortedIssues = ruleEngine.sortIssues(result.issues, 'severity')

      const issueRecords = sortedIssues.map(issue => ({
        reviewId: review.id,
        ruleId: issue.ruleId,
        ruleName: issue.ruleName,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        suggestion: issue.suggestion,
        location: issue.location,
        path: issue.path,
        method: issue.method,
        codeExample: issue.codeExample,
        reference: issue.reference
      }))

      await Issue.bulkCreate(issueRecords, { validate: true })

      const criticalCount = sortedIssues.filter(i => i.severity === 'critical').length
      const errorCount = sortedIssues.filter(i => i.severity === 'error').length
      const warningCount = sortedIssues.filter(i => i.severity === 'warning').length
      const infoCount = sortedIssues.filter(i => i.severity === 'info').length

      const duration = Date.now() - startTime

      await review.update({
        status: 'completed',
        score: result.score,
        totalIssues: result.totalIssues,
        criticalIssues: criticalCount,
        errorIssues: errorCount,
        warningIssues: warningCount,
        infoIssues: infoCount,
        completedAt: new Date(),
        duration,
        metadata: {
          ...review.metadata,
          validationResults: result.validationResults,
          statistics: result.stats
        }
      })

      return {
        review: await Review.findByPk(review.id, {
          include: ['issues']
        }),
        issues: sortedIssues,
        stats: result.stats,
        score: result.score
      }

    } catch (error) {
      await review.update({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date()
      })

      throw error
    }
  }

  async getReview(reviewId, options = {}) {
    const { includeIssues = true, limit = 100, offset = 0, severity = null } = options

    const review = await Review.findByPk(reviewId, {
      include: includeIssues ? [{
        model: Issue,
        as: 'issues',
        where: severity ? { severity } : undefined,
        order: [['severity', 'ASC']],
        limit,
        offset
      }] : undefined
    })

    if (!review) {
      throw new Error(`Review not found: ${reviewId}`)
    }

    return review
  }

  async getReviews(options = {}) {
    const { 
      limit = 20, 
      offset = 0, 
      status = null,
      apiName = null,
      orderBy = 'createdAt',
      orderDir = 'DESC'
    } = options

    const where = {}
    if (status) {
      where.status = status
    }
    if (apiName) {
      where.apiName = { [require('sequelize').Op.like]: `%${apiName}%` }
    }

    const { count, rows } = await Review.findAndCountAll({
      where,
      order: [[orderBy, orderDir]],
      limit,
      offset
    })

    return {
      total: count,
      limit,
      offset,
      reviews: rows
    }
  }

  async getReviewIssues(reviewId, options = {}) {
    const { 
      limit = 100, 
      offset = 0, 
      severity = null,
      category = null,
      ruleId = null,
      path = null
    } = options

    const where = { reviewId }
    if (severity) where.severity = severity
    if (category) where.category = category
    if (ruleId) where.ruleId = ruleId
    if (path) where.path = { [require('sequelize').Op.like]: `%${path}%` }

    const { count, rows } = await Issue.findAndCountAll({
      where,
      order: [
        ['severity', 'ASC'],
        ['createdAt', 'DESC']
      ],
      limit,
      offset
    })

    return {
      total: count,
      limit,
      offset,
      issues: rows
    }
  }

  async deleteReview(reviewId) {
    const review = await Review.findByPk(reviewId)
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`)
    }

    await Issue.destroy({ where: { reviewId } })
    await review.destroy()

    return true
  }

  async rerunReview(reviewId, options = {}) {
    const review = await Review.findByPk(reviewId)
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`)
    }

    const openapiSpec = await OpenApiSpec.findByPk(review.openapiSpecId)
    if (!openapiSpec) {
      throw new Error('OpenAPI specification not found')
    }

    await Issue.destroy({ where: { reviewId } })

    const spec = openapiParser.parse(openapiSpec.content)

    let rulesConfig = null
    if (review.rulesConfigId) {
      rulesConfig = await RulesConfig.findByPk(review.rulesConfigId)
    }

    return this.runReview(
      reviewId, 
      spec, 
      rulesConfig?.content,
      options.enabledRules,
      options.context
    )
  }

  async getStatistics(reviewId = null) {
    if (reviewId) {
      const review = await Review.findByPk(reviewId)
      if (!review) {
        throw new Error(`Review not found: ${reviewId}`)
      }

      return {
        review: {
          id: review.id,
          apiName: review.apiName,
          score: review.score,
          status: review.status,
          totalIssues: review.totalIssues,
          criticalIssues: review.criticalIssues,
          errorIssues: review.errorIssues,
          warningIssues: review.warningIssues,
          infoIssues: review.infoIssues
        }
      }
    }

    const totalReviews = await Review.count()
    const completedReviews = await Review.count({ where: { status: 'completed' } })
    const failedReviews = await Review.count({ where: { status: 'failed' } })
    const runningReviews = await Review.count({ where: { status: 'running' } })

    const avgScore = await Review.findOne({
      where: { status: 'completed' },
      attributes: [
        [require('sequelize').fn('AVG', require('sequelize').col('score')), 'averageScore']
      ]
    })

    return {
      reviews: {
        total: totalReviews,
        completed: completedReviews,
        failed: failedReviews,
        running: runningReviews,
        averageScore: avgScore?.dataValues?.averageScore ? 
          Math.round(avgScore.dataValues.averageScore) : null
      }
    }
  }
}

const reviewService = new ReviewService()

module.exports = {
  ReviewService,
  reviewService
}