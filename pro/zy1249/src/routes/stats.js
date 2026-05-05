const express = require('express')
const { Review, Issue, OpenApiSpec } = require('../models')
const { sequelize } = require('../config/database')
const { Op } = require('sequelize')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const totalReviews = await Review.count()
    const completedReviews = await Review.count({ where: { status: 'completed' } })
    const failedReviews = await Review.count({ where: { status: 'failed' } })
    const runningReviews = await Review.count({ where: { status: 'running' } })
    const totalIssues = await Issue.count()
    const totalSpecs = await OpenApiSpec.count()

    const avgScore = await Review.findOne({
      where: { status: 'completed' },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('score')), 'averageScore']
      ]
    })

    const issuesBySeverity = await Issue.findAll({
      attributes: [
        'severity',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['severity']
    })

    const issuesByCategory = await Issue.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category']
    })

    const recentReviews = await Review.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10
    })

    res.json({
      overview: {
        totalReviews,
        completedReviews,
        failedReviews,
        runningReviews,
        totalIssues,
        totalSpecs,
        averageScore: avgScore?.dataValues?.averageScore ? 
          Math.round(avgScore.dataValues.averageScore) : null
      },
      issues: {
        bySeverity: issuesBySeverity.map(item => ({
          severity: item.severity,
          count: parseInt(item.dataValues.count)
        })),
        byCategory: issuesByCategory.map(item => ({
          category: item.category,
          count: parseInt(item.dataValues.count)
        }))
      },
      recentReviews: recentReviews
    })
  } catch (error) {
    next(error)
  }
})

router.get('/health', async (req, res, next) => {
  try {
    await sequelize.authenticate()
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        database: 'healthy'
      }
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      components: {
        database: 'unhealthy',
        error: error.message
      }
    })
  }
})

router.get('/trends', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7
    
    const reviewsByDay = await Review.findAll({
      attributes: [
        [sequelize.fn('date', sequelize.col('created_at')), 'date'],
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: sequelize.literal(`DATE_SUB(CURRENT_DATE, INTERVAL ${days} DAY)`)
        }
      },
      group: [sequelize.fn('date', sequelize.col('created_at')), 'status'],
      order: [[sequelize.fn('date', sequelize.col('created_at')), 'DESC']]
    })

    const scoresByDay = await Review.findAll({
      attributes: [
        [sequelize.fn('date', sequelize.col('created_at')), 'date'],
        [sequelize.fn('AVG', sequelize.col('score')), 'averageScore']
      ],
      where: {
        status: 'completed',
        createdAt: {
          [Op.gte]: sequelize.literal(`DATE_SUB(CURRENT_DATE, INTERVAL ${days} DAY)`)
        }
      },
      group: [sequelize.fn('date', sequelize.col('created_at'))],
      order: [[sequelize.fn('date', sequelize.col('created_at')), 'DESC']]
    })

    res.json({
      period: `${days} days`,
      reviewsByDay: reviewsByDay.map(item => ({
        date: item.dataValues.date,
        status: item.status,
        count: parseInt(item.dataValues.count)
      })),
      scoresByDay: scoresByDay.map(item => ({
        date: item.dataValues.date,
        averageScore: item.dataValues.averageScore ? 
          Math.round(item.dataValues.averageScore) : null
      }))
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router