const express = require('express')
const router = express.Router()
const sampleService = require('../services/sampleService')

router.put('/:id/status', (req, res) => {
  try {
    const { id } = req.params
    const { status, operator, operatorRole, reason } = req.body
    
    if (!status) {
      return res.status(400).json({ success: false, error: '缺少状态参数' })
    }

    const updated = sampleService.updateSampleStatus(
      id, 
      status, 
      operator || '系统', 
      operatorRole || 'annotation_lead',
      reason
    )
    
    if (!updated) {
      return res.status(404).json({ success: false, error: '样本不存在' })
    }
    
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/:id/comment', (req, res) => {
  try {
    const { id } = req.params
    const { comment, operator = '周姐' } = req.body
    
    if (!comment) {
      return res.status(400).json({ success: false, error: '缺少留言内容' })
    }

    const updated = sampleService.addAnnotatorComment(id, comment, operator)
    
    if (!updated) {
      return res.status(404).json({ success: false, error: '样本不存在' })
    }
    
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.put('/:id/manual', (req, res) => {
  try {
    const { id } = req.params
    const { changes, operator = '周姐' } = req.body
    
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ success: false, error: '缺少修改内容' })
    }

    const updated = sampleService.updateManualChanges(id, changes, operator)
    
    if (!updated) {
      return res.status(404).json({ success: false, error: '样本不存在' })
    }
    
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/:id/review/confirm', (req, res) => {
  try {
    const { id } = req.params
    const { operator = '运营复核人', comment } = req.body

    const updated = sampleService.reviewConfirm(id, operator, comment)
    
    if (!updated) {
      return res.status(404).json({ success: false, error: '样本不存在' })
    }
    
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/:id/review/reject', (req, res) => {
  try {
    const { id } = req.params
    const { operator = '运营复核人', reason } = req.body

    const updated = sampleService.reviewReject(id, operator, reason)
    
    if (!updated) {
      return res.status(404).json({ success: false, error: '样本不存在' })
    }
    
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/:id/rollback', (req, res) => {
  try {
    const { id } = req.params
    const { operator = '运营复核人', reason } = req.body

    const updated = sampleService.rollbackSample(id, operator, reason)
    
    if (!updated) {
      return res.status(404).json({ success: false, error: '样本不存在' })
    }
    
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/:id/logs', (req, res) => {
  try {
    const { id } = req.params
    const logs = sampleService.getSampleOperationLogs(id)
    res.json({ success: true, data: logs })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/review/list', (req, res) => {
  try {
    const { batchId } = req.query
    const samples = sampleService.getSamplesForReview(batchId)
    res.json({ success: true, data: samples })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

module.exports = router
