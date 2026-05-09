import { getBatches, saveBatches, getPromotions, savePromotions, getIssues, saveIssues, generateId } from './storage'
import { validateMedicineBatch, validatePromotion, calculateExpiryDays, getExpiryLayer, isNearExpiry, canTransitionStatus } from './rules'
import { ISSUE_TYPES, PROMOTION_STATUS } from '../data/constants'
import { SAMPLE_BATCHES, SAMPLE_PROMOTIONS } from '../data/sampleData'

export function initializeData() {
  let batches = getBatches()
  let promotions = getPromotions()
  
  if (batches.length === 0) {
    batches = SAMPLE_BATCHES
    saveBatches(batches)
  }
  
  if (promotions.length === 0) {
    promotions = SAMPLE_PROMOTIONS
    savePromotions(promotions)
  }
  
  return { batches, promotions }
}

export function getBatchList(filters = {}) {
  let batches = getBatches()
  
  batches = batches.map(batch => {
    const expiryDays = calculateExpiryDays(batch.expiryDate)
    return {
      ...batch,
      expiryDays,
      expiryLayer: getExpiryLayer(expiryDays),
      isNearExpiry: isNearExpiry(expiryDays)
    }
  })
  
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase()
    batches = batches.filter(b => 
      b.medicineName.toLowerCase().includes(keyword) ||
      b.batchNumber.toLowerCase().includes(keyword) ||
      b.medicineId.toLowerCase().includes(keyword)
    )
  }
  
  if (filters.expiryLayer) {
    batches = batches.filter(b => b.expiryLayer === filters.expiryLayer)
  }
  
  if (filters.isPrescription !== undefined && filters.isPrescription !== null) {
    batches = batches.filter(b => b.isPrescription === filters.isPrescription)
  }
  
  if (filters.isNearExpiryOnly) {
    batches = batches.filter(b => b.isNearExpiry)
  }
  
  if (filters.isLocked !== undefined && filters.isLocked !== null) {
    batches = batches.filter(b => b.isLocked === filters.isLocked)
  }
  
  return batches.sort((a, b) => a.expiryDays - b.expiryDays)
}

export function createBatch(batchData) {
  const validation = validateMedicineBatch(batchData)
  
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      data: batchData
    }
  }
  
  const batches = getBatches()
  const existingBatch = batches.find(b => b.batchNumber === batchData.batchNumber)
  
  if (existingBatch) {
    return {
      success: false,
      errors: [`批号 ${batchData.batchNumber} 已存在`],
      data: batchData
    }
  }
  
  const newBatch = {
    ...batchData,
    id: generateId(),
    isLocked: false,
    createdAt: new Date().toISOString()
  }
  
  batches.push(newBatch)
  saveBatches(batches)
  
  return {
    success: true,
    data: newBatch
  }
}

export function updateBatch(id, batchData) {
  const batches = getBatches()
  const index = batches.findIndex(b => b.id === id)
  
  if (index === -1) {
    return {
      success: false,
      errors: ['未找到该药品批次'],
      data: batchData
    }
  }
  
  const existingBatch = batches[index]
  
  if (existingBatch.isLocked && batchData.quantity !== undefined) {
    return {
      success: false,
      errors: ['该药品批次已被促销活动锁定，无法修改库存'],
      data: batchData
    }
  }
  
  const updateData = {
    ...existingBatch,
    ...batchData,
    id: existingBatch.id,
    batchNumber: existingBatch.batchNumber,
    updatedAt: new Date().toISOString()
  }
  
  const validation = validateMedicineBatch(updateData)
  
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      data: updateData
    }
  }
  
  batches[index] = updateData
  saveBatches(batches)
  
  return {
    success: true,
    data: updateData
  }
}

export function deleteBatch(id) {
  const batches = getBatches()
  const batch = batches.find(b => b.id === id)
  
  if (!batch) {
    return {
      success: false,
      errors: ['未找到该药品批次']
    }
  }
  
  if (batch.isLocked) {
    return {
      success: false,
      errors: ['该药品批次已被促销活动锁定，无法删除']
    }
  }
  
  const newBatches = batches.filter(b => b.id !== id)
  saveBatches(newBatches)
  
  return {
    success: true
  }
}

export function importBatchesFromCSV(csvContent) {
  const lines = csvContent.trim().split('\n')
  const header = lines[0].split(',').map(h => h.trim())
  
  const results = {
    success: [],
    failed: [],
    total: lines.length - 1
  }
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    
    const rawData = {
      medicineId: values[header.indexOf('药品ID')],
      medicineName: values[header.indexOf('药品名称')],
      batchNumber: values[header.indexOf('批号')],
      expiryDate: values[header.indexOf('有效期')],
      quantity: parseInt(values[header.indexOf('库存数量')]) || 0,
      price: parseFloat(values[header.indexOf('单价')]) || 0,
      isPrescription: values[header.indexOf('是否处方药')] === '是',
      manufacturer: values[header.indexOf('生产厂家')]
    }
    
    const result = createBatch(rawData)
    
    if (result.success) {
      results.success.push(result.data)
    } else {
      const issue = {
        id: generateId(),
        type: ISSUE_TYPES.DATA_IMPORT,
        source: 'CSV导入',
        rowNumber: i + 1,
        data: rawData,
        errors: result.errors,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
      
      const issues = getIssues()
      issues.push(issue)
      saveIssues(issues)
      
      results.failed.push({
        row: i + 1,
        data: rawData,
        errors: result.errors
      })
    }
  }
  
  return results
}

export function getPromotionList(filters = {}) {
  let promotions = getPromotions()
  
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase()
    promotions = promotions.filter(p => 
      p.name.toLowerCase().includes(keyword)
    )
  }
  
  if (filters.status) {
    promotions = promotions.filter(p => p.status === filters.status)
  }
  
  return promotions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getPromotionById(id) {
  const promotions = getPromotions()
  const batches = getBatches()
  
  const promotion = promotions.find(p => p.id === id)
  
  if (!promotion) return null
  
  const itemsWithDetails = promotion.items.map(item => {
    const batch = batches.find(b => b.id === item.batchId)
    const expiryDays = batch ? calculateExpiryDays(batch.expiryDate) : null
    return {
      ...item,
      batch,
      expiryDays,
      expiryLayer: expiryDays !== null ? getExpiryLayer(expiryDays) : null
    }
  })
  
  return {
    ...promotion,
    items: itemsWithDetails
  }
}

export function createPromotion(promotionData) {
  const batches = getBatches()
  const validation = validatePromotion(promotionData, batches)
  
  if (!validation.valid) {
    const issue = {
      id: generateId(),
      type: ISSUE_TYPES.PROMOTION_CREATE,
      source: '促销创建',
      data: promotionData,
      errors: validation.errors,
      warnings: validation.warnings,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    
    const issues = getIssues()
    issues.push(issue)
    saveIssues(issues)
    
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
      data: promotionData
    }
  }
  
  const promotions = getPromotions()
  const newPromotion = {
    ...promotionData,
    id: generateId(),
    status: PROMOTION_STATUS.DRAFT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  promotions.push(newPromotion)
  savePromotions(promotions)
  
  return {
    success: true,
    data: newPromotion,
    warnings: validation.warnings
  }
}

export function updatePromotion(id, promotionData) {
  const promotions = getPromotions()
  const batches = getBatches()
  const index = promotions.findIndex(p => p.id === id)
  
  if (index === -1) {
    return {
      success: false,
      errors: ['未找到该促销活动']
    }
  }
  
  const existingPromotion = promotions[index]
  
  if (existingPromotion.status === PROMOTION_STATUS.ACTIVE) {
    return {
      success: false,
      errors: ['生效中的促销活动无法修改']
    }
  }
  
  const updateData = {
    ...existingPromotion,
    ...promotionData,
    id: existingPromotion.id,
    status: existingPromotion.status,
    updatedAt: new Date().toISOString()
  }
  
  const validation = validatePromotion(updateData, batches)
  
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
      data: updateData
    }
  }
  
  promotions[index] = updateData
  savePromotions(promotions)
  
  return {
    success: true,
    data: updateData,
    warnings: validation.warnings
  }
}

export function transitionPromotionStatus(id, targetStatus) {
  const promotions = getPromotions()
  const batches = getBatches()
  const index = promotions.findIndex(p => p.id === id)
  
  if (index === -1) {
    return {
      success: false,
      errors: ['未找到该促销活动']
    }
  }
  
  const promotion = promotions[index]
  
  if (!canTransitionStatus(promotion.status, targetStatus)) {
    return {
      success: false,
      errors: [`无法从当前状态转换到目标状态`]
    }
  }
  
  const validation = validatePromotion(promotion, batches)
  
  if (targetStatus === PROMOTION_STATUS.ACTIVE && !validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings
    }
  }
  
  if (targetStatus === PROMOTION_STATUS.ACTIVE) {
    const batchIds = promotion.items.map(item => item.batchId)
    const updatedBatches = batches.map(batch => {
      if (batchIds.includes(batch.id)) {
        return {
          ...batch,
          isLocked: true,
          lockedByPromotionId: promotion.id
        }
      }
      return batch
    })
    saveBatches(updatedBatches)
  }
  
  if (promotion.status === PROMOTION_STATUS.ACTIVE && targetStatus === PROMOTION_STATUS.ENDED) {
    const batchIds = promotion.items.map(item => item.batchId)
    const updatedBatches = batches.map(batch => {
      if (batchIds.includes(batch.id) && batch.lockedByPromotionId === promotion.id) {
        return {
          ...batch,
          isLocked: false,
          lockedByPromotionId: null
        }
      }
      return batch
    })
    saveBatches(updatedBatches)
  }
  
  promotions[index] = {
    ...promotion,
    status: targetStatus,
    updatedAt: new Date().toISOString()
  }
  savePromotions(promotions)
  
  return {
    success: true,
    data: promotions[index],
    warnings: validation.warnings
  }
}

export function getIssuesList(filters = {}) {
  let issues = getIssues()
  
  if (filters.type) {
    issues = issues.filter(i => i.type === filters.type)
  }
  
  if (filters.status) {
    issues = issues.filter(i => i.status === filters.status)
  }
  
  return issues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function updateIssueStatus(id, status) {
  const issues = getIssues()
  const index = issues.findIndex(i => i.id === id)
  
  if (index === -1) {
    return {
      success: false,
      errors: ['未找到该问题记录']
    }
  }
  
  issues[index] = {
    ...issues[index],
    status,
    resolvedAt: status === 'resolved' ? new Date().toISOString() : null
  }
  saveIssues(issues)
  
  return {
    success: true,
    data: issues[index]
  }
}

export function getStatistics() {
  const batches = getBatches()
  const promotions = getPromotions()
  
  const batchStats = {
    total: batches.length,
    nearExpiry: 0,
    urgency: 0,
    attention: 0,
    earlyWarning: 0,
    prescription: 0,
    otc: 0,
    locked: 0
  }
  
  batches.forEach(batch => {
    const expiryDays = calculateExpiryDays(batch.expiryDate)
    const layer = getExpiryLayer(expiryDays)
    
    if (isNearExpiry(expiryDays)) {
      batchStats.nearExpiry++
    }
    
    if (layer === 'URGENCY') batchStats.urgency++
    if (layer === 'ATTENTION') batchStats.attention++
    if (layer === 'EARLY_WARNING') batchStats.earlyWarning++
    
    if (batch.isPrescription) batchStats.prescription++
    else batchStats.otc++
    
    if (batch.isLocked) batchStats.locked++
  })
  
  const promotionStats = {
    total: promotions.length,
    draft: 0,
    review: 0,
    active: 0,
    ended: 0
  }
  
  promotions.forEach(p => {
    promotionStats[p.status]++
  })
  
  return {
    batches: batchStats,
    promotions: promotionStats
  }
}
