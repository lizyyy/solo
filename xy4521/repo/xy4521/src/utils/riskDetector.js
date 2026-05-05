export const RISK_TYPES = {
  NUMBER_LEAK: 'number_leak',
  DUPLICATE_BATCH: 'duplicate_batch',
  INCONSISTENT_BREWING: 'inconsistent_brewing',
  MISSING_PHOTO: 'missing_photo',
  MISSING_SCORE: 'missing_score',
  MISSING_PARAMS: 'missing_params',
  DUPLICATE_BLIND_NUMBER: 'duplicate_blind_number'
}

export const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
}

export function detectRisks(samples, photos) {
  const risks = []

  risks.push(...detectDuplicateBlindNumbers(samples))
  risks.push(...detectNumberLeaks(samples))
  risks.push(...detectDuplicateBatches(samples))
  risks.push(...detectInconsistentBrewing(samples))
  risks.push(...detectMissingPhotos(samples, photos))
  risks.push(...detectMissingScores(samples))
  risks.push(...detectMissingParams(samples))

  return risks
}

function detectDuplicateBlindNumbers(samples) {
  const risks = []
  const blindNumberMap = new Map()

  samples.forEach((sample, index) => {
    const blindNumber = sample.blindNumber?.toString().trim()
    
    if (!blindNumber) return

    if (blindNumberMap.has(blindNumber)) {
      const existingIndex = blindNumberMap.get(blindNumber)
      
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.DUPLICATE_BLIND_NUMBER,
        level: RISK_LEVELS.HIGH,
        title: '盲样编号重复',
        description: `盲样编号 "${blindNumber}" 重复出现`,
        evidence: [
          `第 ${existingIndex + 1} 条记录: ${samples[existingIndex].teaName || '未知茶样'}`,
          `第 ${index + 1} 条记录: ${sample.teaName || '未知茶样'}`
        ],
        sampleIds: [samples[existingIndex].id, sample.id],
        affectedFields: ['blindNumber']
      })
    } else {
      blindNumberMap.set(blindNumber, index)
    }
  })

  return risks
}

function detectNumberLeaks(samples) {
  const risks = []
  
  const batchPatterns = [
    /批次[：:]\s*[\d\-]+/gi,
    /batch[：:]\s*[\d\-]+/gi,
    /批号[：:]\s*[\d\-]+/gi,
    /[批编]号[：:]\s*[A-Za-z]?[\d\-]+/gi
  ]

  samples.forEach((sample) => {
    const blindNumber = sample.blindNumber?.toString().trim() || ''
    const batchNumber = sample.batchNumber?.toString().trim() || ''
    
    if (!blindNumber || !batchNumber) return

    if (blindNumber === batchNumber) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.NUMBER_LEAK,
        level: RISK_LEVELS.HIGH,
        title: '编号泄露风险',
        description: `盲样编号 "${blindNumber}" 与批次号完全相同`,
        evidence: [
          `盲样编号: ${blindNumber}`,
          `批次号: ${batchNumber}`,
          `可能导致评委识别真实批次`
        ],
        sampleIds: [sample.id],
        affectedFields: ['blindNumber', 'batchNumber']
      })
    }

    if (blindNumber.length >= 3 && batchNumber.includes(blindNumber)) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.NUMBER_LEAK,
        level: RISK_LEVELS.HIGH,
        title: '编号泄露风险',
        description: `盲样编号 "${blindNumber}" 包含在批次号中`,
        evidence: [
          `盲样编号: ${blindNumber}`,
          `批次号: ${batchNumber}`,
          `可能泄露真实茶样信息`
        ],
        sampleIds: [sample.id],
        affectedFields: ['blindNumber', 'batchNumber']
      })
    }

    if (batchNumber.length >= 3 && blindNumber.includes(batchNumber)) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.NUMBER_LEAK,
        level: RISK_LEVELS.HIGH,
        title: '编号泄露风险',
        description: `批次号 "${batchNumber}" 包含在盲样编号中`,
        evidence: [
          `盲样编号: ${blindNumber}`,
          `批次号: ${batchNumber}`,
          `可能泄露真实茶样信息`
        ],
        sampleIds: [sample.id],
        affectedFields: ['blindNumber', 'batchNumber']
      })
    }
  })

  return risks
}

function detectDuplicateBatches(samples) {
  const risks = []
  const batchMap = new Map()

  samples.forEach((sample, index) => {
    const batchNumber = sample.batchNumber?.toString().trim()
    
    if (!batchNumber) return

    if (batchMap.has(batchNumber)) {
      const existingIndex = batchMap.get(batchNumber)
      
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.DUPLICATE_BATCH,
        level: RISK_LEVELS.HIGH,
        title: '同批样重复出现',
        description: `批次号 "${batchNumber}" 在盲评中重复出现`,
        evidence: [
          `第 ${existingIndex + 1} 条记录: 盲样 ${samples[existingIndex].blindNumber || '未知'}`,
          `第 ${index + 1} 条记录: 盲样 ${sample.blindNumber || '未知'}`,
          `同一批次可能被评委识别，影响公正性`
        ],
        sampleIds: [samples[existingIndex].id, sample.id],
        affectedFields: ['batchNumber', 'blindNumber']
      })
    } else {
      batchMap.set(batchNumber, index)
    }
  })

  return risks
}

function detectInconsistentBrewing(samples) {
  const risks = []
  
  if (samples.length < 2) return risks

  const waterTemps = samples
    .map(s => s.brewingWaterTemp)
    .filter(t => t !== null && t !== undefined && t !== '')
  
  const brewingTimes = samples
    .map(s => s.brewingTime)
    .filter(t => t !== null && t !== undefined && t !== '')
  
  const leafAmounts = samples
    .map(s => s.teaLeafAmount)
    .filter(a => a !== null && a !== undefined && a !== '')

  if (waterTemps.length >= 2) {
    const uniqueTemps = [...new Set(waterTemps.map(t => parseFloat(t)))]
    if (uniqueTemps.length > 1) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.INCONSISTENT_BREWING,
        level: RISK_LEVELS.MEDIUM,
        title: '冲泡水温不一致',
        description: `发现 ${uniqueTemps.length} 种不同的冲泡水温`,
        evidence: [
          `检测到的水温: ${uniqueTemps.join('°C, ')}°C`,
          `涉及 ${waterTemps.length} 条记录`,
          `建议统一水温以保证审评公正性`
        ],
        sampleIds: samples.filter(s => s.brewingWaterTemp).map(s => s.id),
        affectedFields: ['brewingWaterTemp']
      })
    }
  }

  if (brewingTimes.length >= 2) {
    const uniqueTimes = [...new Set(brewingTimes.map(t => parseFloat(t)))]
    if (uniqueTimes.length > 1) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.INCONSISTENT_BREWING,
        level: RISK_LEVELS.MEDIUM,
        title: '冲泡时间不一致',
        description: `发现 ${uniqueTimes.length} 种不同的冲泡时间`,
        evidence: [
          `检测到的时间: ${uniqueTimes.join('s, ')}s`,
          `涉及 ${brewingTimes.length} 条记录`,
          `建议统一冲泡时间以保证审评公正性`
        ],
        sampleIds: samples.filter(s => s.brewingTime).map(s => s.id),
        affectedFields: ['brewingTime']
      })
    }
  }

  if (leafAmounts.length >= 2) {
    const uniqueAmounts = [...new Set(leafAmounts.map(a => parseFloat(a)))]
    if (uniqueAmounts.length > 1) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.INCONSISTENT_BREWING,
        level: RISK_LEVELS.MEDIUM,
        title: '投茶量不一致',
        description: `发现 ${uniqueAmounts.length} 种不同的投茶量`,
        evidence: [
          `检测到的投茶量: ${uniqueAmounts.join('g, ')}g`,
          `涉及 ${leafAmounts.length} 条记录`,
          `建议统一投茶量以保证审评公正性`
        ],
        sampleIds: samples.filter(s => s.teaLeafAmount).map(s => s.id),
        affectedFields: ['teaLeafAmount']
      })
    }
  }

  return risks
}

function detectMissingPhotos(samples, photos) {
  const risks = []

  samples.forEach((sample) => {
    const hasLinkedPhotos = sample.photoIds && sample.photoIds.length > 0
    const hasMatchingPhotos = photos.some(photo => 
      photo.linkedSampleId === sample.id
    )

    if (!hasLinkedPhotos && !hasMatchingPhotos) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.MISSING_PHOTO,
        level: RISK_LEVELS.HIGH,
        title: '封样照片缺失',
        description: `盲样 "${sample.blindNumber || sample.id}" 缺少封样照片`,
        evidence: [
          `盲样编号: ${sample.blindNumber || '未设置'}`,
          `茶样名称: ${sample.teaName || '未设置'}`,
          `批次号: ${sample.batchNumber || '未设置'}`,
          `未找到关联的封样照片`
        ],
        sampleIds: [sample.id],
        affectedFields: ['photoIds']
      })
    }
  })

  return risks
}

function detectMissingScores(samples) {
  const risks = []

  samples.forEach((sample) => {
    const hasScore = sample.judgeScore !== null && 
                     sample.judgeScore !== undefined && 
                     sample.judgeScore !== '' &&
                     !isNaN(parseFloat(sample.judgeScore))

    if (!hasScore) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.MISSING_SCORE,
        level: RISK_LEVELS.LOW,
        title: '评委打分缺失',
        description: `盲样 "${sample.blindNumber || sample.id}" 缺少评委打分`,
        evidence: [
          `盲样编号: ${sample.blindNumber || '未设置'}`,
          `茶样名称: ${sample.teaName || '未设置'}`,
          `评委: ${sample.judgeName || '未设置'}`,
          `分数: 未填写`
        ],
        sampleIds: [sample.id],
        affectedFields: ['judgeScore']
      })
    }
  })

  return risks
}

function detectMissingParams(samples) {
  const risks = []

  samples.forEach((sample) => {
    const missingParams = []
    
    if (!sample.brewingWaterTemp || sample.brewingWaterTemp === '') {
      missingParams.push('冲泡水温')
    }
    if (!sample.brewingTime || sample.brewingTime === '') {
      missingParams.push('冲泡时间')
    }
    if (!sample.teaLeafAmount || sample.teaLeafAmount === '') {
      missingParams.push('投茶量')
    }

    if (missingParams.length > 0) {
      risks.push({
        id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: RISK_TYPES.MISSING_PARAMS,
        level: RISK_LEVELS.MEDIUM,
        title: '冲泡参数缺失',
        description: `盲样 "${sample.blindNumber || sample.id}" 缺少 ${missingParams.length} 项冲泡参数`,
        evidence: [
          `盲样编号: ${sample.blindNumber || '未设置'}`,
          `缺失参数: ${missingParams.join('、')}`,
          `建议补全参数以保证审评标准统一`
        ],
        sampleIds: [sample.id],
        affectedFields: missingParams.map(p => {
          switch(p) {
            case '冲泡水温': return 'brewingWaterTemp'
            case '冲泡时间': return 'brewingTime'
            case '投茶量': return 'teaLeafAmount'
            default: return ''
          }
        })
      })
    }
  })

  return risks
}

export function getRiskLevelColor(level) {
  switch (level) {
    case RISK_LEVELS.HIGH:
      return '#f56c6c'
    case RISK_LEVELS.MEDIUM:
      return '#e6a23c'
    case RISK_LEVELS.LOW:
      return '#67c23a'
    default:
      return '#909399'
  }
}

export function getRiskLevelText(level) {
  switch (level) {
    case RISK_LEVELS.HIGH:
      return '高风险'
    case RISK_LEVELS.MEDIUM:
      return '中风险'
    case RISK_LEVELS.LOW:
      return '低风险'
    default:
      return '未知'
  }
}

export function getRiskTypeText(type) {
  switch (type) {
    case RISK_TYPES.NUMBER_LEAK:
      return '编号泄露'
    case RISK_TYPES.DUPLICATE_BATCH:
      return '重复批次'
    case RISK_TYPES.INCONSISTENT_BREWING:
      return '冲泡参数不一致'
    case RISK_TYPES.MISSING_PHOTO:
      return '照片缺失'
    case RISK_TYPES.MISSING_SCORE:
      return '打分缺失'
    case RISK_TYPES.MISSING_PARAMS:
      return '参数缺失'
    case RISK_TYPES.DUPLICATE_BLIND_NUMBER:
      return '盲样编号重复'
    default:
      return '未知风险'
  }
}
