const { BOUNDARY_RULES, SAMPLE_STATUS } = require('../constants')
const store = require('../store')

const checkSampleAgainstRules = (sample, allSamples, currentBatchSamples) => {
  const matchedRules = []

  const duplicateInBatch = currentBatchSamples.find(
    s => s.sampleId === sample.sampleId && s.originalRowNumber !== sample.originalRowNumber
  )
  if (duplicateInBatch) {
    matchedRules.push({
      ...BOUNDARY_RULES.DUPLICATE_SAMPLE_IN_BATCH,
      matchedWith: duplicateInBatch.id
    })
  }

  const sameIdDifferentModel = allSamples.find(
    s => s.sampleId === sample.sampleId && 
         s.modelVersion !== sample.modelVersion && 
         s.batchId !== sample.batchId
  )
  if (sameIdDifferentModel) {
    matchedRules.push({
      ...BOUNDARY_RULES.MODEL_VERSION_CHANGED_SAME_ID,
      matchedWith: sameIdDifferentModel.id,
      previousModelVersion: sameIdDifferentModel.modelVersion,
      previousBatchId: sameIdDifferentModel.batchId
    })
  }

  if (matchedRules.length === 0) {
    matchedRules.push(BOUNDARY_RULES.NORMAL_SAMPLE)
  }

  return matchedRules
}

const determineSampleStatus = (matchedRules) => {
  const requireReviewRules = matchedRules.filter(r => r.requireReview)
  if (requireReviewRules.length > 0) {
    const highestPriority = requireReviewRules.sort((a, b) => {
      const priority = {
        'DUPLICATE_SAMPLE_IN_BATCH': 2,
        'MODEL_VERSION_CHANGED_SAME_ID': 1
      }
      return (priority[b.code] || 0) - (priority[a.code] || 0)
    })
    return highestPriority[0].autoStatus
  }
  return SAMPLE_STATUS.NORMAL
}

const generateExplanation = (sample, matchedRules) => {
  const explanations = matchedRules.map(rule => {
    let text = rule.explanation
    if (rule.code === 'MODEL_VERSION_CHANGED_SAME_ID') {
      text += ` 前次模型版本：${rule.previousModelVersion}，本次模型版本：${sample.modelVersion}`
    }
    if (rule.code === 'DUPLICATE_SAMPLE_IN_BATCH') {
      text += ` 重复行号：第 ${sample.originalRowNumber} 行`
    }
    return text
  })
  return explanations.join('；')
}

module.exports = {
  checkSampleAgainstRules,
  determineSampleStatus,
  generateExplanation
}
