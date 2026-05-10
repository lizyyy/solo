const prisma = require('../lib/prisma')
const { ExceptionType, recordException, createPendingTask } = require('./exceptionService')
const { getDeliveryById } = require('./deliveryService')

const InspectionResult = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PARTIAL_PASS: 'PARTIAL_PASS',
  PENDING: 'PENDING'
}

function validateInspectionItem(item) {
  const errors = []
  
  if (!item.deliveryItemId) {
    errors.push('Delivery item ID is required')
  }
  
  if (item.inspectedQty === undefined || item.inspectedQty === null) {
    errors.push('Inspected quantity is required')
  } else if (item.inspectedQty < 0) {
    errors.push('Inspected quantity cannot be negative')
  }
  
  if (item.qualifiedQty === undefined || item.qualifiedQty === null) {
    errors.push('Qualified quantity is required')
  } else if (item.qualifiedQty < 0) {
    errors.push('Qualified quantity cannot be negative')
  }
  
  if (item.defectQty === undefined || item.defectQty === null) {
    errors.push('Defect quantity is required')
  } else if (item.defectQty < 0) {
    errors.push('Defect quantity cannot be negative')
  }
  
  return errors
}

function determineInspectionItemResult(item) {
  const inspectedQty = parseInt(item.inspectedQty) || 0
  const qualifiedQty = parseInt(item.qualifiedQty) || 0
  const defectQty = parseInt(item.defectQty) || 0
  
  if (inspectedQty === 0) {
    return InspectionResult.PENDING
  }
  
  if (defectQty > qualifiedQty) {
    return InspectionResult.FAIL
  } else if (defectQty > 0) {
    return InspectionResult.PARTIAL_PASS
  } else {
    return InspectionResult.PASS
  }
}

function determineOverallInspectionResult(items) {
  const results = items.map(item => determineInspectionItemResult(item))
  
  if (results.every(r => r === InspectionResult.PENDING)) {
    return InspectionResult.PENDING
  }
  
  if (results.some(r => r === InspectionResult.FAIL)) {
    return InspectionResult.FAIL
  }
  
  if (results.some(r => r === InspectionResult.PARTIAL_PASS)) {
    return InspectionResult.PARTIAL_PASS
  }
  
  return InspectionResult.PASS
}

function validateInspectionQuantity(deliveryItem, inspectionItem) {
  const receivedQty = deliveryItem.receivedQty
  const inspectedQty = parseInt(inspectionItem.inspectedQty) || 0
  const qualifiedQty = parseInt(inspectionItem.qualifiedQty) || 0
  const defectQty = parseInt(inspectionItem.defectQty) || 0
  
  const errors = []
  
  if (inspectedQty > receivedQty) {
    errors.push(`Inspected quantity (${inspectedQty}) cannot exceed received quantity (${receivedQty})`)
  }
  
  if (qualifiedQty + defectQty > inspectedQty) {
    errors.push(`Sum of qualified (${qualifiedQty}) and defect (${defectQty}) cannot exceed inspected quantity (${inspectedQty})`)
  }
  
  return errors
}

async function createInspection(data) {
  const { deliveryId, inspectionNo, inspector, inspectionDate, items, conclusion } = data
  
  if (!deliveryId || !inspectionNo || !inspector || !items || items.length === 0) {
    throw new Error('Delivery ID, inspection number, inspector and items are required')
  }
  
  const delivery = await getDeliveryById(deliveryId)
  
  if (!delivery) {
    await recordException({
      type: ExceptionType.MISSING_INFO,
      source: 'InspectionService',
      sourceId: deliveryId,
      message: `Delivery ${deliveryId} not found when creating inspection ${inspectionNo}`,
      data: { inputData: data }
    })
    throw new Error(`Delivery ${deliveryId} not found`)
  }
  
  const existingInspection = await prisma.inspection.findFirst({
    where: { 
      OR: [
        { inspectionNo },
        { deliveryId }
      ]
    }
  })
  
  if (existingInspection) {
    if (existingInspection.inspectionNo === inspectionNo) {
      await recordException({
        type: ExceptionType.DATA_CONFLICT,
        source: 'InspectionService',
        sourceId: inspectionNo,
        supplierId: delivery.supplierId,
        deliveryId,
        message: `Inspection number ${inspectionNo} already exists`,
        data: { inputData: data }
      })
      throw new Error(`Inspection ${inspectionNo} already exists`)
    }
    await recordException({
      type: ExceptionType.DATA_CONFLICT,
      source: 'InspectionService',
      sourceId: deliveryId,
      supplierId: delivery.supplierId,
      deliveryId,
      message: `Inspection for delivery ${delivery.deliveryNo} already exists`,
      data: { inputData: data }
    })
    throw new Error(`Inspection for delivery ${delivery.deliveryNo} already exists`)
  }
  
  const deliveryItemMap = new Map()
  delivery.items.forEach(item => {
    deliveryItemMap.set(item.id, item)
  })
  
  for (const item of items) {
    const errors = validateInspectionItem(item)
    if (errors.length > 0) {
      await recordException({
        type: ExceptionType.MISSING_INFO,
        source: 'InspectionService',
        supplierId: delivery.supplierId,
        deliveryId,
        message: `Invalid inspection item: ${errors.join(', ')}`,
        data: { item }
      })
      throw new Error(`Invalid inspection item: ${errors.join(', ')}`)
    }
    
    const deliveryItem = deliveryItemMap.get(item.deliveryItemId)
    if (!deliveryItem) {
      await recordException({
        type: ExceptionType.MISSING_INFO,
        source: 'InspectionService',
        supplierId: delivery.supplierId,
        deliveryId,
        message: `Delivery item ${item.deliveryItemId} not found`,
        data: { item }
      })
      throw new Error(`Delivery item ${item.deliveryItemId} not found`)
    }
    
    const quantityErrors = validateInspectionQuantity(deliveryItem, item)
    if (quantityErrors.length > 0) {
      await recordException({
        type: ExceptionType.QUANTITY_MISMATCH,
        source: 'InspectionService',
        supplierId: delivery.supplierId,
        deliveryId,
        message: quantityErrors.join(', '),
        data: { item, deliveryItem: { receivedQty: deliveryItem.receivedQty } }
      })
      throw new Error(quantityErrors.join(', '))
    }
  }
  
  const calculatedItems = items.map(item => ({
    ...item,
    result: determineInspectionItemResult(item)
  }))
  
  const overallResult = determineOverallInspectionResult(calculatedItems)
  
  const inspection = await prisma.inspection.create({
    data: {
      inspectionNo,
      deliveryId,
      inspector,
      inspectionDate: inspectionDate ? new Date(inspectionDate) : new Date(),
      result: overallResult,
      conclusion,
      items: {
        create: calculatedItems.map(item => {
          const deliveryItem = deliveryItemMap.get(item.deliveryItemId)
          return {
            deliveryItemId: item.deliveryItemId,
            productId: deliveryItem.productId,
            inspectedQty: item.inspectedQty,
            qualifiedQty: item.qualifiedQty,
            defectQty: item.defectQty,
            result: item.result,
            conclusion: item.conclusion
          }
        })
      }
    },
    include: {
      delivery: {
        include: {
          supplier: true
        }
      },
      items: {
        include: {
          product: true,
          deliveryItem: true
        }
      }
    }
  })
  
  const hasDefects = calculatedItems.some(item => parseInt(item.defectQty) > 0)
  const hasShortage = delivery.items.some(item => item.differenceQty > 0)
  
  if (hasDefects || hasShortage) {
    await createPendingTask({
      type: 'CLAIM_REQUIRED',
      source: 'Inspection',
      sourceId: inspection.id,
      title: `Inspection ${inspectionNo} has issues, requires claim processing`,
      description: `Delivery ${delivery.deliveryNo} has ${hasShortage ? 'shortage' : ''}${hasShortage && hasDefects ? ' and ' : ''}${hasDefects ? 'defects' : ''}`,
      priority: 2
    })
  }
  
  return inspection
}

async function getInspectionByDeliveryId(deliveryId) {
  return prisma.inspection.findFirst({
    where: { deliveryId },
    include: {
      delivery: {
        include: {
          supplier: true,
          items: true
        }
      },
      items: {
        include: {
          product: true,
          deliveryItem: true
        }
      }
    }
  })
}

async function getInspectionById(id) {
  return prisma.inspection.findUnique({
    where: { id },
    include: {
      delivery: {
        include: {
          supplier: true,
          items: true
        }
      },
      items: {
        include: {
          product: true,
          deliveryItem: true
        }
      }
    }
  })
}

module.exports = {
  InspectionResult,
  validateInspectionItem,
  determineInspectionItemResult,
  determineOverallInspectionResult,
  validateInspectionQuantity,
  createInspection,
  getInspectionByDeliveryId,
  getInspectionById
}
