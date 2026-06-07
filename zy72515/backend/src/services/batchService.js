const store = require('../store')
const { checkSampleAgainstRules, determineSampleStatus, generateExplanation } = require('./boundaryRuleService')
const { OPERATION_TYPE, SAMPLE_STATUS, ROLES } = require('../constants')

const importBatch = async (batchName, modelVersion, rows, operator) => {
  const batch = store.createBatch({
    name: batchName,
    modelVersion,
    totalCount: rows.length,
    status: 'imported',
    importedBy: operator
  })

  const allSamples = store.getSamples()
  const createdSamples = []
  const currentBatchSamples = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const sampleData = {
      batchId: batch.id,
      sampleId: row.sampleId || row['样本编号'] || row.id,
      modelVersion: modelVersion,
      originalRowNumber: i + 1,
      originalData: row,
      content: row.content || row['内容'] || '',
      schedulingSuggestion: row.schedulingSuggestion || row['排班建议'] || '',
      annotatorComment: row.annotatorComment || row['标注员留言'] || '',
      manualChanges: {},
      matchedRules: [],
      status: SAMPLE_STATUS.PENDING_REVIEW,
      explanation: '',
      createdBy: operator
    }

    const matchedRules = checkSampleAgainstRules(sampleData, allSamples, currentBatchSamples)
    const status = determineSampleStatus(matchedRules)
    const explanation = generateExplanation(sampleData, matchedRules)

    sampleData.matchedRules = matchedRules
    sampleData.status = status
    sampleData.explanation = explanation

    const sample = store.createSample(sampleData)
    createdSamples.push(sample)
    currentBatchSamples.push(sample)

    store.addOperationLog({
      batchId: batch.id,
      sampleId: sample.id,
      type: OPERATION_TYPE.BATCH_IMPORT,
      operator,
      operatorRole: ROLES.ANNOTATION_LEAD,
      detail: `导入第 ${i + 1} 行样本，初始状态：${status}`,
      beforeState: null,
      afterState: { status, matchedRules: matchedRules.map(r => r.code) }
    })
  }

  const stats = calculateBatchStats(createdSamples)
  
  return {
    batch,
    samples: createdSamples,
    stats
  }
}

const calculateBatchStats = (samples) => {
  const stats = {
    total: samples.length,
    normal: 0,
    abnormal: 0,
    modelVersionChanged: 0,
    pendingReview: 0,
    reviewConfirmed: 0,
    reviewRejected: 0
  }

  samples.forEach(s => {
    switch (s.status) {
      case SAMPLE_STATUS.NORMAL:
        stats.normal++
        break
      case SAMPLE_STATUS.ABNORMAL:
        stats.abnormal++
        break
      case SAMPLE_STATUS.MODEL_VERSION_CHANGED:
        stats.modelVersionChanged++
        break
      case SAMPLE_STATUS.PENDING_REVIEW:
        stats.pendingReview++
        break
      case SAMPLE_STATUS.REVIEW_CONFIRMED:
        stats.reviewConfirmed++
        break
      case SAMPLE_STATUS.REVIEW_REJECTED:
        stats.reviewRejected++
        break
    }
  })

  return stats
}

const getBatchList = () => {
  const batches = store.getBatches()
  const samples = store.getSamples()
  
  return batches.map(batch => {
    const batchSamples = samples.filter(s => s.batchId === batch.id)
    const stats = calculateBatchStats(batchSamples)
    return {
      ...batch,
      stats,
      sampleCount: batchSamples.length
    }
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

const getBatchDetail = (batchId) => {
  const batches = store.getBatches()
  const batch = batches.find(b => b.id === batchId)
  if (!batch) return null

  const allSamples = store.getSamples()
  const batchSamples = allSamples.filter(s => s.batchId === batchId)
  const logs = store.getOperationLogs().filter(l => l.batchId === batchId)

  const stats = calculateBatchStats(batchSamples)

  return {
    batch,
    samples: batchSamples.sort((a, b) => a.originalRowNumber - b.originalRowNumber),
    stats,
    operationLogs: logs
  }
}

module.exports = {
  importBatch,
  calculateBatchStats,
  getBatchList,
  getBatchDetail
}
