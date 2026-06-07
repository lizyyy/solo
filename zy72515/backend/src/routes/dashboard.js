const express = require('express')
const router = express.Router()
const sampleService = require('../services/sampleService')
const { BOUNDARY_RULES, SAMPLE_STATUS, SAMPLE_STATUS_LABEL } = require('../constants')

router.get('/review', (req, res) => {
  try {
    const data = sampleService.getReviewDashboardData()
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/boundary-rules', (req, res) => {
  try {
    const rules = Object.values(BOUNDARY_RULES).map(rule => ({
      code: rule.code,
      name: rule.name,
      description: rule.description,
      autoStatus: rule.autoStatus,
      autoStatusLabel: SAMPLE_STATUS_LABEL[rule.autoStatus],
      requireReview: rule.requireReview,
      explanation: rule.explanation
    }))
    res.json({ success: true, data: rules })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/sample-statuses', (req, res) => {
  try {
    const statuses = Object.entries(SAMPLE_STATUS).map(([key, value]) => ({
      key,
      value,
      label: SAMPLE_STATUS_LABEL[value]
    }))
    res.json({ success: true, data: statuses })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

module.exports = router
