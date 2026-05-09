import { EXPIRY_LAYERS, PROMOTION_STATUS } from '../data/constants'

export function calculateExpiryDays(expiryDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const diffTime = expiry - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function getExpiryLayer(expiryDays) {
  if (expiryDays <= EXPIRY_LAYERS.URGENCY.maxDays) {
    return 'URGENCY'
  } else if (expiryDays <= EXPIRY_LAYERS.ATTENTION.maxDays) {
    return 'ATTENTION'
  } else if (expiryDays <= EXPIRY_LAYERS.EARLY_WARNING.maxDays) {
    return 'EARLY_WARNING'
  } else {
    return 'NORMAL'
  }
}

export function isNearExpiry(expiryDays) {
  return expiryDays <= EXPIRY_LAYERS.EARLY_WARNING.maxDays
}

export function validateMedicineBatch(batch) {
  const errors = []
  
  if (!batch.medicineId || batch.medicineId.trim() === '') {
    errors.push('药品ID不能为空')
  }
  
  if (!batch.medicineName || batch.medicineName.trim() === '') {
    errors.push('药品名称不能为空')
  }
  
  if (!batch.batchNumber || batch.batchNumber.trim() === '') {
    errors.push('批号不能为空')
  }
  
  if (!batch.expiryDate) {
    errors.push('有效期不能为空')
  } else {
    const expiryDays = calculateExpiryDays(batch.expiryDate)
    if (expiryDays < 0) {
      errors.push('药品已过期')
    }
  }
  
  if (batch.quantity === undefined || batch.quantity === null || batch.quantity < 0) {
    errors.push('库存数量必须大于等于0')
  }
  
  if (batch.price === undefined || batch.price === null || batch.price < 0) {
    errors.push('单价必须大于等于0')
  }
  
  if (batch.isPrescription === undefined || batch.isPrescription === null) {
    errors.push('处方类型不能为空')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

export function validatePromotion(promotion, batches) {
  const errors = []
  const warnings = []
  
  if (!promotion.name || promotion.name.trim() === '') {
    errors.push('促销活动名称不能为空')
  }
  
  if (!promotion.items || promotion.items.length === 0) {
    errors.push('促销组合必须至少包含一个药品批次')
  }
  
  if (!promotion.validFrom || !promotion.validTo) {
    errors.push('促销活动有效期不能为空')
  } else if (new Date(promotion.validFrom) > new Date(promotion.validTo)) {
    errors.push('促销开始日期不能晚于结束日期')
  }
  
  const hasPrescriptionItems = promotion.items?.some(item => {
    const batch = batches.find(b => b.id === item.batchId)
    return batch?.isPrescription
  })
  
  if (hasPrescriptionItems && promotion.items?.length > 1) {
    warnings.push('促销组合包含处方药，根据合规要求，处方药与非处方药组合促销需要额外审核')
  }
  
  const lockedBatchIds = batches
    .filter(b => b.isLocked && b.lockedByPromotionId)
    .map(b => b.id)
  
  const conflictingItems = promotion.items?.filter(item => 
    lockedBatchIds.includes(item.batchId) && 
    item.batchId !== promotion.id
  )
  
  if (conflictingItems?.length > 0) {
    errors.push('以下药品批次已被其他促销活动锁定，请先解除锁定：' + 
      conflictingItems.map(i => i.batchNumber).join(', '))
  }
  
  promotion.items?.forEach(item => {
    const batch = batches.find(b => b.id === item.batchId)
    if (!batch) {
      errors.push(`未找到批号为 ${item.batchNumber} 的药品批次`)
      return
    }
    
    if (item.minQuantity > batch.quantity) {
      errors.push(`药品 ${batch.medicineName} (批号: ${batch.batchNumber}) 库存不足，当前库存 ${batch.quantity}，需求 ${item.minQuantity}`)
    }
    
    const expiryDays = calculateExpiryDays(batch.expiryDate)
    if (expiryDays < 0) {
      errors.push(`药品 ${batch.medicineName} (批号: ${batch.batchNumber}) 已过期`)
    }
    
    if (!isNearExpiry(expiryDays) && promotion.status !== PROMOTION_STATUS.DRAFT) {
      warnings.push(`药品 ${batch.medicineName} (批号: ${batch.batchNumber}) 效期 ${expiryDays} 天，不满足近效期条件`)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function canTransitionStatus(currentStatus, targetStatus) {
  const transitions = {
    [PROMOTION_STATUS.DRAFT]: [PROMOTION_STATUS.REVIEW],
    [PROMOTION_STATUS.REVIEW]: [PROMOTION_STATUS.ACTIVE, PROMOTION_STATUS.DRAFT],
    [PROMOTION_STATUS.ACTIVE]: [PROMOTION_STATUS.ENDED],
    [PROMOTION_STATUS.ENDED]: []
  }
  return transitions[currentStatus]?.includes(targetStatus) || false
}

export function calculateDiscount(batch, promotion) {
  if (!promotion || !batch) return 0
  
  switch (promotion.discountType) {
    case 'percentage':
      return batch.price * (promotion.discountValue / 100)
    case 'fixed_amount':
      return Math.min(promotion.discountValue, batch.price)
    case 'bundle':
      return 0
    default:
      return 0
  }
}

export function calculateFinalPrice(batch, promotion) {
  const discount = calculateDiscount(batch, promotion)
  return Math.max(0, batch.price - discount)
}
