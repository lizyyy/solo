const express = require('express')
const router = express.Router()
const XLSX = require('xlsx')
const batchService = require('../services/batchService')
const sampleService = require('../services/sampleService')
const store = require('../store')
const { SAMPLE_STATUS_LABEL } = require('../constants')

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
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }
    const result = batchService.importBatch(batchName, modelVersion, rows, operator)
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/:id/export', (req, res) => {
  try {
    const { id } = req.params
    const detail = batchService.getBatchDetail(id)
    if (!detail) {
      return res.status(404).json({ success: false, error: '批次不存在' })
    }
    const allSamples = store.getSamples()
    const allBatches = store.getBatches()
    const exportRows = detail.samples.map(function(s) {
      const previousSample = allSamples.find(function(ps) {
        return ps.sampleId === s.sampleId && ps.modelVersion !== s.modelVersion && ps.batchId !== s.batchId
      })
      const previousBatch = previousSample ? allBatches.find(function(b) { return b.id === previousSample.batchId }) : null
      const modelChangedRule = s.matchedRules.find(function(r) { return r.code === 'MODEL_VERSION_CHANGED_SAME_ID' })
      var conclusion = ''
      if (s.status === 'review_confirmed') { conclusion = '运营复核人确认：正常模型迭代' }
      else if (s.status === 'review_rejected') { conclusion = '运营复核人驳回：需重新处理' }
      else if (s.status === 'rolled_back') { conclusion = '已回滚' }
      else if (s.status === 'model_version_changed') { conclusion = '待运营复核人复核' }
      else if (s.status === 'normal') { conclusion = '正常' }
      else if (s.status === 'abnormal') { conclusion = '异常，需处理' }
      else { conclusion = '待复核' }
      var manualChangesStr = ''
      if (s.manualChanges && Object.keys(s.manualChanges).length > 0) {
        manualChangesStr = Object.entries(s.manualChanges).map(function(e) { return e[0] + ': ' + e[1] }).join('；')
      }
      return {
        '原始行号': s.originalRowNumber,
        '样本编号': s.sampleId,
        '模型版本': s.modelVersion,
        '来源批次': detail.batch.name,
        '前次模型版本': previousSample ? previousSample.modelVersion : '',
        '前次批次': previousBatch ? previousBatch.name : '',
        '内容': s.content,
        '排班建议': s.schedulingSuggestion,
        '当前处理状态': SAMPLE_STATUS_LABEL[s.status] || s.status,
        '状态说明': s.explanation,
        '结论': conclusion,
        '命中规则': s.matchedRules.map(function(r) { return r.name || r }).join('；'),
        '人工改动': manualChangesStr,
        '标注员留言': s.annotatorComment || '',
        '是否模型版本变更': modelChangedRule ? '是' : '否'
      }
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '样本明细')
    const logs = store.getOperationLogs().filter(function(l) { return l.batchId === id })
    const logRows = logs.map(function(l) {
      return {
        '时间': l.createdAt,
        '操作类型': l.type,
        '操作人': l.operator,
        '角色': l.operatorRole,
        '详情': l.detail,
        '操作前状态': l.beforeState ? JSON.stringify(l.beforeState) : '',
        '操作后状态': l.afterState ? JSON.stringify(l.afterState) : ''
      }
    })
    const logWs = XLSX.utils.json_to_sheet(logRows)
    XLSX.utils.book_append_sheet(wb, logWs, '操作日志')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="export_detail.xlsx"')
    res.send(buffer)
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

module.exports = router
