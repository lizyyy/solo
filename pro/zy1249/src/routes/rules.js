const express = require('express')
const { Rule } = require('../models')
const { getDefaultRules, getAllValidators, defaultRules } = require('../validators')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0,
      category: req.query.category,
      isEnabled: req.query.isEnabled !== undefined ? req.query.isEnabled === 'true' : undefined
    }

    const where = {}
    if (options.category) where.category = options.category
    if (options.isEnabled !== undefined) where.isEnabled = options.isEnabled

    const { count, rows } = await Rule.findAndCountAll({
      where,
      order: [['category', 'ASC'], ['ruleId', 'ASC']],
      limit: options.limit,
      offset: options.offset
    })

    if (rows.length === 0) {
      return res.json({
        total: defaultRules.length,
        limit: options.limit,
        offset: options.offset,
        rules: defaultRules
      })
    }

    res.json({
      total: count,
      limit: options.limit,
      offset: options.offset,
      rules: rows
    })
  } catch (error) {
    next(error)
  }
})

router.get('/categories', async (req, res, next) => {
  try {
    const categories = [
      { id: 'naming', name: '命名规范', description: '资源和路径命名相关规则' },
      { id: 'http', name: 'HTTP 规范', description: 'HTTP 方法和状态码相关规则' },
      { id: 'pattern', name: '设计模式', description: '分页、过滤等设计模式' },
      { id: 'reliability', name: '可靠性', description: '幂等性、可靠性相关规则' },
      { id: 'error-handling', name: '错误处理', description: '错误码和错误响应相关规则' },
      { id: 'compatibility', name: '兼容性', description: '版本控制和废弃策略相关规则' }
    ]

    res.json({
      total: categories.length,
      categories
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:ruleId', async (req, res, next) => {
  try {
    const rule = await Rule.findOne({
      where: { ruleId: req.params.ruleId }
    })

    if (!rule) {
      const defaultRule = defaultRules.find(r => r.ruleId === req.params.ruleId)
      if (defaultRule) {
        return res.json(defaultRule)
      }
      return res.status(404).json({
        error: 'Rule not found',
        message: `Rule with id ${req.params.ruleId} not found`
      })
    }

    res.json(rule)
  } catch (error) {
    next(error)
  }
})

router.put('/:ruleId', async (req, res, next) => {
  try {
    const [rule, created] = await Rule.findOrCreate({
      where: { ruleId: req.params.ruleId },
      defaults: {
        ruleId: req.params.ruleId,
        name: req.body.name,
        category: req.body.category || 'general',
        description: req.body.description,
        severity: req.body.severity || 'warning',
        isEnabled: req.body.isEnabled !== false,
        config: req.body.config || {},
        reference: req.body.reference
      }
    })

    if (!created) {
      await rule.update({
        name: req.body.name ?? rule.name,
        category: req.body.category ?? rule.category,
        description: req.body.description ?? rule.description,
        severity: req.body.severity ?? rule.severity,
        isEnabled: req.body.isEnabled ?? rule.isEnabled,
        config: req.body.config ? { ...rule.config, ...req.body.config } : rule.config,
        reference: req.body.reference ?? rule.reference
      })
    }

    res.json({
      message: created ? 'Rule created successfully' : 'Rule updated successfully',
      rule
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/:ruleId', async (req, res, next) => {
  try {
    const deleted = await Rule.destroy({
      where: { ruleId: req.params.ruleId }
    })

    if (!deleted) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `Rule with id ${req.params.ruleId} not found`
      })
    }

    res.json({
      message: 'Rule deleted successfully',
      ruleId: req.params.ruleId
    })
  } catch (error) {
    next(error)
  }
})

router.post('/:ruleId/enable', async (req, res, next) => {
  try {
    const rule = await Rule.findOne({
      where: { ruleId: req.params.ruleId }
    })

    if (!rule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `Rule with id ${req.params.ruleId} not found`
      })
    }

    await rule.update({ isEnabled: true })

    res.json({
      message: 'Rule enabled successfully',
      rule
    })
  } catch (error) {
    next(error)
  }
})

router.post('/:ruleId/disable', async (req, res, next) => {
  try {
    const rule = await Rule.findOne({
      where: { ruleId: req.params.ruleId }
    })

    if (!rule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `Rule with id ${req.params.ruleId} not found`
      })
    }

    await rule.update({ isEnabled: false })

    res.json({
      message: 'Rule disabled successfully',
      rule
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router