const prisma = require('../lib/prisma')
const { ExceptionType, recordException, createPendingTask } = require('./exceptionService')
const { getDeliveryById } = require('./deliveryService')
const { getInspectionByDeliveryId, InspectionResult } = require('./inspectionService')

const ClaimStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  SUPPLIER_CONFIRMED: 'SUPPLIER_CONFIRMED',
  SUPPLIER_REJECTED: 'SUPPLIER_REJECTED',
  SETTLED: 'SETTLED',
  REJECTED: 'REJECTED',
  EXCEPTION: 'EXCEPTION'
}

const ResponsibilityType = {
  SUPPLIER: 'SUPPLIER',
  LOGISTICS: 'LOGISTICS',
  INTERNAL: 'INTERNAL',
  UNDEFINED: 'UNDEFINED'
}

function validateClaimItem(item) {
  const errors = []
  
  if (!item.deliveryItemId) {
    errors.push('Delivery item ID is required')
  }
  
  if (item.shortageQty === undefined || item.shortageQty === null) {
    errors.push('Shortage quantity is required')
  } else if (item.shortageQty < 0) {
    errors.push('Shortage quantity cannot be negative')
  }
  
  if (item.defectQty === undefined || item.defectQty === null) {
    errors.push('Defect quantity is required')
  } else if (item.defectQty < 0) {
    errors.push('Defect quantity cannot be negative')
  }
  
  if (!item.responsibility) {
    errors.push('Responsibility type is required')
  }
  
  if (!Object.values(ResponsibilityType).includes(item.responsibility)) {
    errors.push(`Invalid responsibility type: ${item.responsibility}`)
  }
  
  if (item.unitPrice === undefined || item.unitPrice === null) {
    errors.push('Unit price is required')
  } else if (parseFloat(item.unitPrice) < 0) {
    errors.push('Unit price cannot be negative')
  }
  
  return errors
}

function calculateClaimAmount(item) {
  const shortageQty = parseInt(item.shortageQty) || 0
  const defectQty = parseInt(item.defectQty) || 0
  const unitPrice = parseFloat(item.unitPrice) || 0
  
  const totalClaimQty = shortageQty + defectQty
  const claimAmount = totalClaimQty * unitPrice
  
  return {
    totalClaimQty,
    claimAmount
  }
}

function determineResponsibility(shortageQty, defectQty, inspectionResult, deliveryDifference) {
  if (shortageQty > 0 && defectQty === 0) {
    return ResponsibilityType.SUPPLIER
  }
  
  if (shortageQty === 0 && defectQty > 0) {
    if (inspectionResult === InspectionResult.FAIL) {
      return ResponsibilityType.SUPPLIER
    }
    return ResponsibilityType.SUPPLIER
  }
  
  if (shortageQty > 0 && defectQty > 0) {
    return ResponsibilityType.SUPPLIER
  }
  
  if (deliveryDifference > 0) {
    return ResponsibilityType.SUPPLIER
  }
  
  return ResponsibilityType.UNDEFINED
}

function validateClaimQuantities(claimItem, deliveryItem, inspectionItem) {
  const errors = []
  
  const shortageQty = parseInt(claimItem.shortageQty) || 0
  const defectQty = parseInt(claimItem.defectQty) || 0
  
  const deliveryDifference = deliveryItem ? deliveryItem.differenceQty : 0
  if (shortageQty > deliveryDifference) {
    errors.push(`Shortage quantity (${shortageQty}) cannot exceed delivery difference (${deliveryDifference})`)
  }
  
  const defectQtyFromInspection = inspectionItem ? inspectionItem.defectQty : 0
  if (defectQty > defectQtyFromInspection) {
    errors.push(`Defect quantity (${defectQty}) cannot exceed inspection defect quantity (${defectQtyFromInspection})`)
  }
  
  return errors
}

function calculateClaimSummary(items) {
  let totalShortageQty = 0
  let totalDefectQty = 0
  let totalClaimAmount = 0
  
  for (const item of items) {
    totalShortageQty += parseInt(item.shortageQty) || 0
    totalDefectQty += parseInt(item.defectQty) || 0
    totalClaimAmount += parseFloat(item.claimAmount) || 0
  }
  
  return {
    totalShortageQty,
    totalDefectQty,
    totalClaimAmount
  }
}

function hasClaimableItems(delivery, inspection) {
  const hasShortage = delivery.items.some(item => item.differenceQty > 0)
  const hasDefect = inspection ? inspection.items.some(item => item.defectQty > 0) : false
  
  return hasShortage || hasDefect
}

function checkForMissingResponsibilities(items) {
  const missingItems = items.filter(item => item.responsibility === ResponsibilityType.UNDEFINED)
  return missingItems.length > 0 ? missingItems : null
}

async function generateClaimDraft(deliveryId) {
  const delivery = await getDeliveryById(deliveryId)
  
  if (!delivery) {
    throw new Error(`Delivery ${deliveryId} not found`)
  }
  
  const inspection = await getInspectionByDeliveryId(deliveryId)
  
  if (!hasClaimableItems(delivery, inspection)) {
    await recordException({
      type: ExceptionType.MISSING_INFO,
      source: 'ClaimService',
      sourceId: deliveryId,
      supplierId: delivery.supplierId,
      deliveryId,
      message: `Delivery ${delivery.deliveryNo} has no claimable items`,
      data: { 
        hasShortage: delivery.items.some(i => i.differenceQty > 0),
        hasDefect: inspection ? inspection.items.some(i => i.defectQty > 0) : false
      }
    })
    throw new Error(`Delivery ${delivery.deliveryNo} has no claimable items`)
  }
  
  const claimItems = []
  
  for (const deliveryItem of delivery.items) {
    const inspectionItem = inspection?.items.find(i => i.deliveryItemId === deliveryItem.id)
    
    const shortageQty = Math.max(0, deliveryItem.differenceQty)
    const defectQty = inspectionItem ? inspectionItem.defectQty : 0
    
    if (shortageQty > 0 || defectQty > 0) {
      const responsibility = determineResponsibility(
        shortageQty,
        defectQty,
        inspectionItem?.result,
        deliveryItem.differenceQty
      )
      
      const unitPrice = deliveryItem.unitPrice
      const { claimAmount } = calculateClaimAmount({
        shortageQty,
        defectQty,
        unitPrice
      })
      
      claimItems.push({
        deliveryItemId: deliveryItem.id,
        inspectionItemId: inspectionItem?.id,
        productId: deliveryItem.productId,
        responsibility,
        shortageQty,
        defectQty,
        unitPrice,
        claimAmount
      })
    }
  }
  
  const missingResponsibilities = checkForMissingResponsibilities(claimItems)
  if (missingResponsibilities) {
    await recordException({
      type: ExceptionType.CALCULATION_ERROR,
      source: 'ClaimService',
      supplierId: delivery.supplierId,
      deliveryId,
      message: `Some items have undefined responsibility`,
      data: { items: missingResponsibilities }
    })
  }
  
  return {
    supplierId: delivery.supplierId,
    deliveryId: delivery.id,
    items: claimItems,
    summary: calculateClaimSummary(claimItems)
  }
}

async function createClaim(data) {
  const { claimNo, deliveryId, supplierId, items } = data
  
  if (!claimNo || !deliveryId || !supplierId || !items || items.length === 0) {
    throw new Error('Claim number, delivery ID, supplier ID and items are required')
  }
  
  const delivery = await getDeliveryById(deliveryId)
  
  if (!delivery) {
    await recordException({
      type: ExceptionType.MISSING_INFO,
      source: 'ClaimService',
      sourceId: deliveryId,
      supplierId,
      message: `Delivery ${deliveryId} not found when creating claim ${claimNo}`,
      data: { inputData: data }
    })
    throw new Error(`Delivery ${deliveryId} not found`)
  }
  
  const existingClaim = await prisma.claim.findFirst({
    where: {
      OR: [
        { claimNo },
        { deliveryId }
      ]
    }
  })
  
  if (existingClaim) {
    if (existingClaim.claimNo === claimNo) {
      await recordException({
        type: ExceptionType.DATA_CONFLICT,
        source: 'ClaimService',
        sourceId: claimNo,
        supplierId,
        deliveryId,
        claimId: existingClaim.id,
        message: `Claim number ${claimNo} already exists`,
        data: { inputData: data }
      })
      throw new Error(`Claim ${claimNo} already exists`)
    }
    await recordException({
      type: ExceptionType.DATA_CONFLICT,
      source: 'ClaimService',
      sourceId: deliveryId,
      supplierId,
      deliveryId,
      claimId: existingClaim.id,
      message: `Claim for delivery ${delivery.deliveryNo} already exists`,
      data: { inputData: data }
    })
    throw new Error(`Claim for delivery ${delivery.deliveryNo} already exists`)
  }
  
  const inspection = await getInspectionByDeliveryId(deliveryId)
  const deliveryItemMap = new Map()
  const inspectionItemMap = new Map()
  
  delivery.items.forEach(item => deliveryItemMap.set(item.id, item))
  inspection?.items.forEach(item => inspectionItemMap.set(item.id, item))
  
  const calculatedItems = []
  
  for (const item of items) {
    const errors = validateClaimItem(item)
    if (errors.length > 0) {
      await recordException({
        type: ExceptionType.MISSING_INFO,
        source: 'ClaimService',
        supplierId,
        deliveryId,
        message: `Invalid claim item: ${errors.join(', ')}`,
        data: { item }
      })
      throw new Error(`Invalid claim item: ${errors.join(', ')}`)
    }
    
    const deliveryItem = deliveryItemMap.get(item.deliveryItemId)
    const inspectionItem = item.inspectionItemId ? inspectionItemMap.get(item.inspectionItemId) : undefined
    
    const quantityErrors = validateClaimQuantities(item, deliveryItem, inspectionItem)
    if (quantityErrors.length > 0) {
      await recordException({
        type: ExceptionType.QUANTITY_MISMATCH,
        source: 'ClaimService',
        supplierId,
        deliveryId,
        message: quantityErrors.join(', '),
        data: { 
          item,
          deliveryItem: deliveryItem ? { differenceQty: deliveryItem.differenceQty } : null,
          inspectionItem: inspectionItem ? { defectQty: inspectionItem.defectQty } : null
        }
      })
      throw new Error(quantityErrors.join(', '))
    }
    
    const calculated = calculateClaimAmount(item)
    
    calculatedItems.push({
      ...item,
      ...calculated
    })
  }
  
  const summary = calculateClaimSummary(calculatedItems)
  
  if (summary.totalClaimAmount === 0) {
    await recordException({
      type: ExceptionType.CALCULATION_ERROR,
      source: 'ClaimService',
      supplierId,
      deliveryId,
      message: `Claim ${claimNo} has zero total amount`,
      data: { summary, items: calculatedItems }
    })
    throw new Error('Claim cannot have zero total amount')
  }
  
  const missingResponsibilities = checkForMissingResponsibilities(calculatedItems)
  if (missingResponsibilities) {
    await createPendingTask({
      type: 'RESPONSIBILITY_ASSIGNMENT',
      source: 'Claim',
      sourceId: claimNo,
      title: `Claim ${claimNo} has items with undefined responsibility`,
      description: `${missingResponsibilities.length} items need responsibility assignment`,
      priority: 3
    })
  }
  
  const claim = await prisma.claim.create({
    data: {
      claimNo,
      deliveryId,
      supplierId,
      status: ClaimStatus.DRAFT,
      totalShortageQty: summary.totalShortageQty,
      totalDefectQty: summary.totalDefectQty,
      totalClaimAmount: summary.totalClaimAmount,
      items: {
        create: calculatedItems.map(item => ({
          deliveryItemId: item.deliveryItemId,
          inspectionItemId: item.inspectionItemId,
          productId: item.productId,
          responsibility: item.responsibility,
          shortageQty: item.shortageQty,
          defectQty: item.defectQty,
          unitPrice: item.unitPrice,
          claimAmount: item.claimAmount,
          remark: item.remark
        }))
      }
    },
    include: {
      supplier: true,
      delivery: {
        include: {
          items: true
        }
      },
      items: {
        include: {
          product: true,
          deliveryItem: true,
          inspectionItem: true
        }
      }
    }
  })
  
  return claim
}

async function submitClaim(claimId) {
  const claim = await getClaimById(claimId)
  
  if (!claim) {
    throw new Error(`Claim ${claimId} not found`)
  }
  
  if (claim.status !== ClaimStatus.DRAFT) {
    await recordException({
      type: ExceptionType.INVALID_STATUS,
      source: 'ClaimService',
      sourceId: claimId,
      supplierId: claim.supplierId,
      deliveryId: claim.deliveryId,
      claimId: claim.id,
      message: `Cannot submit claim in ${claim.status} status`,
      data: { currentStatus: claim.status }
    })
    throw new Error(`Cannot submit claim in ${claim.status} status`)
  }
  
  const missingResponsibilities = checkForMissingResponsibilities(claim.items)
  if (missingResponsibilities) {
    await recordException({
      type: ExceptionType.MISSING_INFO,
      source: 'ClaimService',
      supplierId: claim.supplierId,
      deliveryId: claim.deliveryId,
      claimId: claim.id,
      message: `Cannot submit claim with undefined responsibilities`,
      data: { missingItems: missingResponsibilities }
    })
    throw new Error(`Cannot submit claim: ${missingResponsibilities.length} items have undefined responsibility`)
  }
  
  return prisma.claim.update({
    where: { id: claimId },
    data: { status: ClaimStatus.SUBMITTED },
    include: {
      supplier: true,
      delivery: true,
      items: {
        include: {
          product: true
        }
      }
    }
  })
}

async function confirmBySupplier(claimId, remark) {
  const claim = await getClaimById(claimId)
  
  if (!claim) {
    throw new Error(`Claim ${claimId} not found`)
  }
  
  if (claim.status !== ClaimStatus.SUBMITTED) {
    await recordException({
      type: ExceptionType.INVALID_STATUS,
      source: 'ClaimService',
      sourceId: claimId,
      supplierId: claim.supplierId,
      deliveryId: claim.deliveryId,
      claimId: claim.id,
      message: `Cannot confirm claim in ${claim.status} status`,
      data: { currentStatus: claim.status }
    })
    throw new Error(`Cannot confirm claim in ${claim.status} status`)
  }
  
  return prisma.claim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.SUPPLIER_CONFIRMED,
      supplierConfirmedAt: new Date(),
      supplierConfirmRemark: remark
    },
    include: {
      supplier: true,
      delivery: true,
      items: {
        include: {
          product: true
        }
      }
    }
  })
}

async function rejectBySupplier(claimId, remark) {
  const claim = await getClaimById(claimId)
  
  if (!claim) {
    throw new Error(`Claim ${claimId} not found`)
  }
  
  if (claim.status !== ClaimStatus.SUBMITTED) {
    await recordException({
      type: ExceptionType.INVALID_STATUS,
      source: 'ClaimService',
      sourceId: claimId,
      supplierId: claim.supplierId,
      deliveryId: claim.deliveryId,
      claimId: claim.id,
      message: `Cannot reject claim in ${claim.status} status`,
      data: { currentStatus: claim.status }
    })
    throw new Error(`Cannot reject claim in ${claim.status} status`)
  }
  
  return prisma.claim.update({
    where: { id: claimId },
    data: {
      status: ClaimStatus.SUPPLIER_REJECTED,
      supplierConfirmedAt: new Date(),
      supplierConfirmRemark: remark
    },
    include: {
      supplier: true,
      delivery: true,
      items: {
        include: {
          product: true
        }
      }
    }
  })
}

async function recordDeductionReceipt(claimId, receiptNo, receiptDate) {
  const claim = await getClaimById(claimId)
  
  if (!claim) {
    throw new Error(`Claim ${claimId} not found`)
  }
  
  if (claim.status !== ClaimStatus.SUPPLIER_CONFIRMED) {
    await recordException({
      type: ExceptionType.INVALID_STATUS,
      source: 'ClaimService',
      sourceId: claimId,
      supplierId: claim.supplierId,
      deliveryId: claim.deliveryId,
      claimId: claim.id,
      message: `Cannot record deduction receipt for claim in ${claim.status} status`,
      data: { currentStatus: claim.status }
    })
    throw new Error(`Cannot record deduction receipt for claim in ${claim.status} status`)
  }
  
  return prisma.claim.update({
    where: { id: claimId },
    data: {
      deductionReceiptNo: receiptNo,
      deductionReceiptDate: receiptDate ? new Date(receiptDate) : new Date(),
      status: ClaimStatus.SETTLED,
      settledAt: new Date()
    },
    include: {
      supplier: true,
      delivery: true,
      items: {
        include: {
          product: true
        }
      }
    }
  })
}

async function getClaimById(id) {
  return prisma.claim.findUnique({
    where: { id },
    include: {
      supplier: true,
      delivery: {
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          },
          inspection: {
            include: {
              items: true
            }
          }
        }
      },
      items: {
        include: {
          product: true,
          deliveryItem: true,
          inspectionItem: true
        }
      },
      exceptions: true
    }
  })
}

async function getClaimByNo(claimNo) {
  return prisma.claim.findUnique({
    where: { claimNo },
    include: {
      supplier: true,
      delivery: {
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          },
          inspection: {
            include: {
              items: true
            }
          }
        }
      },
      items: {
        include: {
          product: true,
          deliveryItem: true,
          inspectionItem: true
        }
      },
      exceptions: true
    }
  })
}

async function listClaims(filters = {}) {
  const where = {}
  
  if (filters.status) where.status = filters.status
  if (filters.supplierId) where.supplierId = filters.supplierId
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
  }
  
  return prisma.claim.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: true,
      delivery: true
    }
  })
}

async function generateClaimReport(claimId) {
  const claim = await getClaimById(claimId)
  
  if (!claim) {
    throw new Error(`Claim ${claimId} not found`)
  }
  
  return {
    claimNo: claim.claimNo,
    status: claim.status,
    supplier: {
      code: claim.supplier.code,
      name: claim.supplier.name
    },
    delivery: {
      deliveryNo: claim.delivery.deliveryNo,
      poNo: claim.delivery.poNo,
      deliveryDate: claim.delivery.deliveryDate
    },
    totals: {
      totalShortageQty: claim.totalShortageQty,
      totalDefectQty: claim.totalDefectQty,
      totalClaimAmount: parseFloat(claim.totalClaimAmount)
    },
    items: claim.items.map(item => ({
      product: {
        sku: item.product.sku,
        name: item.product.name
      },
      responsibility: item.responsibility,
      shortageQty: item.shortageQty,
      defectQty: item.defectQty,
      unitPrice: parseFloat(item.unitPrice),
      claimAmount: parseFloat(item.claimAmount)
    })),
    supplierConfirmation: claim.supplierConfirmedAt ? {
      confirmedAt: claim.supplierConfirmedAt,
      remark: claim.supplierConfirmRemark
    } : null,
    deductionReceipt: claim.deductionReceiptNo ? {
      receiptNo: claim.deductionReceiptNo,
      receiptDate: claim.deductionReceiptDate
    } : null,
    settledAt: claim.settledAt,
    createdAt: claim.createdAt
  }
}

module.exports = {
  ClaimStatus,
  ResponsibilityType,
  validateClaimItem,
  calculateClaimAmount,
  determineResponsibility,
  validateClaimQuantities,
  calculateClaimSummary,
  hasClaimableItems,
  checkForMissingResponsibilities,
  generateClaimDraft,
  createClaim,
  submitClaim,
  confirmBySupplier,
  rejectBySupplier,
  recordDeductionReceipt,
  getClaimById,
  getClaimByNo,
  listClaims,
  generateClaimReport
}
