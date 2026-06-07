const express = require('express')
const router = express.Router()
const XLSX = require('xlsx')
const { parse } = require('csv-parse/sync')
const batchService = require('../services/batchService')
const sampleService = require('../services/sampleService')
const store = require('../store')

router.get('/', (req, res) => {
  try {
    const batches = batchService.getBatchList()
    res.json({ success: true, data: batches })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const detail = batchService.getBatchDetail(id)
    if (!detail) {
      return res.status(404).json({ success: false, error: '批次不存在' })
    }
    res.json({ success: true, data: detail })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/import', (req, res) => {
  try {
    const { batchName, modelVersion, rows, operator = '周姐' } = req.body
    
    if (!batchName || !modelVersion || !rows || !Array.isArray(rows)) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：batchName, modelVersion, rows' 
      })
    }

    const result = batchService.importBatch(batchName, modelVersion, rows, operator)
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/:id/export', (req, res) => {
  try {
    const { id } = req.params
    const detail = batchService.getBatchDetail(id)
    if (!detail) {
      return res.status(404).json({ success: false, error: '批次不存在' })
    }

    const exportRows = detail.samples.map(s => ({
      '原始行号': s.originalRowNumber,
      '样本编号': s.sampleId,
      '模型版本': s.modelVersion,
      '内容': s.content,
      '排班建议': s.schedulingSuggestion,
      '当前状态': s.status,
      '状态说明': s.explanation,
      '人工改动': JSON.stringify(s.manualChanges),
      '标注员留言': s.annotatorComment,
      '命中规则': s.matchedRules.map(r => r.name).join('；')
    }))

    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '样本明细')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${detail.batch.name}_明细.xlsx"`)
    res.send(buffer)
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

module.exports = router
