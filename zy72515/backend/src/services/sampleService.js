const store = require('../store')
const { OPERATION_TYPE, SAMPLE_STATUS, ROLES } = require('../constants')

const updateSampleStatus = (sampleId, newStatus, operator, operatorRole, reason) => {
  const sample = store.getSamples().find(s => s.id === sampleId)
  if (!sample) return null

  const beforeState = { status: sample.status, manualChanges: sample.manualChanges }
  
  const updatedSample = store.updateSample(sampleId, {
    status: newStatus
  })

  store.addOperationLog({
    batchId: sample.batchId,
    sampleId: sample.id,
    type: OPERATION_TYPE.UPDATE_STATUS,
    operator,
    operatorRole,
    detail: `状态更新：${sample.status} → ${newStatus}${reason ? `，原因：${reason}` : ''}`,
    beforeState,
    afterState: { status: newStatus }
  })

  return updatedSample
}

const addAnnotatorComment = (sampleId, comment, operator) => {
  const sample = store.getSamples().find(s => s.id === sampleId)
  if (!sample) return null

  const beforeState = { annotatorComment: sample.annotatorComment }

  const updatedSample = store.updateSample(sampleId, {
    annotatorComment: comment
  })

  store.addOperationLog({
    batchId: sample.batchId,
    sampleId: sample.id,
    type: OPERATION_TYPE.ADD_COMMENT,
    operator,
    operatorRole: ROLES.ANNOTATION_LEAD,
    detail: `标注负责人补充留言：${comment}`,
    beforeState,
    afterState: { annotatorComment: comment }
  })

  return updatedSample
}

const updateManualChanges = (sampleId, changes, operator) => {
  const sample = store.getSamples().find(s => s.id === sampleId)
  if (!sample) return null

  const beforeState = { manualChanges: sample.manualChanges }
  const newManualChanges = { ...sample.manualChanges, ...changes }

  const updatedSample = store.updateSample(sampleId, {
    manualChanges: newManualChanges
  })

  store.addOperationLog({
    batchId: sample.batchId,
    sampleId: sample.id,
    type: OPERATION_TYPE.EDIT_MANUAL,
    operator,
    operatorRole: ROLES.ANNOTATION_LEAD,
    detail: `人工修改字段：${Object.keys(changes).join(', ')}`,
    beforeState,
    afterState: { manualChanges: newManualChanges }
  })

  return updatedSample
}

const reviewConfirm = (sampleId, operator, comment) => {
  return updateSampleStatus(
    sampleId, 
    SAMPLE_STATUS.REVIEW_CONFIRMED, 
    operator, 
    ROLES.OPERATION_REVIEWER,
    comment || '复核通过'
  )
}

const reviewReject = (sampleId, operator, reason) => {
  return updateSampleStatus(
    sampleId, 
    SAMPLE_STATUS.REVIEW_REJECTED, 
    operator, 
    ROLES.OPERATION_REVIEWER,
    reason || '复核驳回'
  )
}

const rollbackSample = (sampleId, operator, reason) => {
  const sample = store.getSamples().find(s => s.id === sampleId)
  if (!sample) return null

  const beforeState = { status: sample.status }

  const updatedSample = store.updateSample(sampleId, {
    status: SAMPLE_STATUS.ROLLED_BACK
  })

  store.addOperationLog({
    batchId: sample.batchId,
    sampleId: sample.id,
    type: OPERATION_TYPE.ROLLBACK,
    operator,
    operatorRole: ROLES.OPERATION_REVIEWER,
    detail: `回滚操作，原因：${reason || '未说明'}`,
    beforeState,
    afterState: { status: SAMPLE_STATUS.ROLLED_BACK }
  })

  return updatedSample
}

const getSampleOperationLogs = (sampleId) => {
  return store.getOperationLogs()
    .filter(l => l.sampleId === sampleId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

const getSamplesForReview = (batchId = null) => {
  let samples = store.getSamples()
  if (batchId) {
    samples = samples.filter(s => s.batchId === batchId)
  }
  return samples.filter(s => 
    s.status === SAMPLE_STATUS.MODEL_VERSION_CHANGED ||
    s.status === SAMPLE_STATUS.ABNORMAL ||
    s.status === SAMPLE_STATUS.PENDING_REVIEW
  )
}

const getReviewDashboardData = () => {
  const batches = store.getBatches()
  const samples = store.getSamples()
  const logs = store.getOperationLogs()

  const modelVersionChangedSamples = samples.filter(s => 
    s.status === SAMPLE_STATUS.MODEL_VERSION_CHANGED
  ).map(s => {
    const batch = batches.find(b => b.id === s.batchId)
    const sampleLogs = logs.filter(l => l.sampleId === s.id)
    const previousSample = samples.find(
      ps => ps.sampleId === s.sampleId && 
           ps.modelVersion !== s.modelVersion &&
           ps.batchId !== s.batchId
    )
    const previousBatch = previousSample ? batches.find(b => b.id === previousSample.batchId) : null

    return {
      ...s,
      batchName: batch?.name || '',
      previousModelVersion: previousSample?.modelVersion || '',
      previousBatchName: previousBatch?.name || '',
      previousBatchDate: previousSample?.createdAt || '',
      commentCount: sampleLogs.filter(l => l.type === OPERATION_TYPE.ADD_COMMENT).length,
      nextAction: '等待运营复核人复核，确认是否为正常模型迭代'
    }
  })

  const stats = {
    totalBatches: batches.length,
    totalSamples: samples.length,
    pendingReview: samples.filter(s => 
      s.status === SAMPLE_STATUS.MODEL_VERSION_CHANGED ||
      s.status === SAMPLE_STATUS.ABNORMAL ||
      s.status === SAMPLE_STATUS.PENDING_REVIEW
    ).length,
    modelVersionChangedCount: modelVersionChangedSamples.length,
    reviewedCount: samples.filter(s => 
      s.status === SAMPLE_STATUS.REVIEW_CONFIRMED ||
      s.status === SAMPLE_STATUS.REVIEW_REJECTED
    ).length
  }

  return {
    stats,
    modelVersionChangedSamples,
    recentOperations: logs.slice(-20).reverse().map(log => {
      const batch = batches.find(b => b.id === log.batchId)
      return {
        ...log,
        batchName: batch?.name || ''
      }
    })
  }
}

module.exports = {
  updateSampleStatus,
  addAnnotatorComment,
  updateManualChanges,
  reviewConfirm,
  reviewReject,
  rollbackSample,
  getSampleOperationLogs,
  getSamplesForReview,
  getReviewDashboardData
}
