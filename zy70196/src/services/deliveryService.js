const prisma = require('../lib/prisma')
const { ExceptionType, recordException, createPendingTask } = require('./exceptionService')

const DeliveryStatus = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  PARTIAL: 'PARTIAL',
  EXCEPTION: 'EXCEPTION'
}

function validateDeliveryItem(item) {
  const errors = []
  
  if (!item.productId) {
    errors.push('Product ID is required')
  }
  
  if (item.expectedQty === undefined || item.expectedQty === null) {
    errors.push('Expected quantity is required')
  } else if (item.expectedQty < 0) {
    errors.push('Expected quantity cannot be negative')
  }
  
  if (item.receivedQty === undefined || item.receivedQty === null) {
    errors.push('Received quantity is required')
  } else if (item.receivedQty < 0) {
    errors.push('Received quantity cannot be negative')
  }
  
  if (item.unitPrice === undefined || item.unitPrice === null) {
    errors.push('Unit price is required')
  } else if (parseFloat(item.unitPrice) < 0) {
    errors.push('Unit price cannot be negative')
  }
  
  return errors
}

function calculateDeliveryItem(item) {
  const expectedQty = parseInt(item.expectedQty) || 0
  const receivedQty = parseInt(item.receivedQty) || 0
  const unitPrice = parseFloat(item.unitPrice) || 0
  
  const differenceQty = expectedQty - receivedQty
  const amount = receivedQty * unitPrice
  
  return {
    differenceQty,
    amount
  }
}

function determineDeliveryStatus(items) {
  const totalExpected = items.reduce((sum, item) => sum + (parseInt(item.expectedQty) || 0), 0)
  const totalReceived = items.reduce((sum, item) => sum + (parseInt(item.receivedQty) || 0), 0)
  const hasDifference = items.some(item => {
    const diff = calculateDeliveryItem(item).differenceQty
    return diff !== 0
  })
  
  if (totalExpected === totalReceived && !hasDifference) {
    return DeliveryStatus.RECEIVED
  } else if (totalReceived > 0 && hasDifference) {
    return DeliveryStatus.PARTIAL
  } else {
    return DeliveryStatus.EXCEPTION
  }
}

async function createDelivery(data) {
  const { deliveryNo, supplierId, poNo, deliveryDate, items } = data
  
  if (!deliveryNo || !supplierId || !deliveryDate || !items || items.length === 0) {
    throw new Error('Delivery number, supplier ID, delivery date and items are required')
  }
  
  const existingDelivery = await prisma.delivery.findUnique({
    where: { deliveryNo }
  })
  
  if (existingDelivery) {
    await recordException({
      type: ExceptionType.DATA_CONFLICT,
      source: 'DeliveryService',
      sourceId: deliveryNo,
      supplierId,
      message: `Delivery number ${deliveryNo} already exists`,
      data: { inputData: data }
    })
    throw new Error(`Delivery ${deliveryNo} already exists`)
  }
  
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId }
  })
  
  if (!supplier) {
    await recordException({
      type: ExceptionType.MISSING_INFO,
      source: 'DeliveryService',
      supplierId,
      message: `Supplier ${supplierId} not found when creating delivery ${deliveryNo}`,
      data: { inputData: data }
    })
    throw new Error(`Supplier ${supplierId} not found`)
  }
  
  for (const item of items) {
    const errors = validateDeliveryItem(item)
    if (errors.length > 0) {
      await recordException({
        type: ExceptionType.MISSING_INFO,
        source: 'DeliveryService',
        supplierId,
        message: `Invalid delivery item: ${errors.join(', ')}`,
        data: { item }
      })
      throw new Error(`Invalid delivery item: ${errors.join(', ')}`)
    }
  }
  
  const calculatedItems = items.map(item => {
    const calculated = calculateDeliveryItem(item)
    return {
      ...item,
      ...calculated
    }
  })
  
  const status = determineDeliveryStatus(calculatedItems)
  
  const delivery = await prisma.delivery.create({
    data: {
      deliveryNo,
      supplierId,
      poNo,
      deliveryDate: new Date(deliveryDate),
      status,
      items: {
        create: calculatedItems.map(item => ({
          productId: item.productId,
          expectedQty: item.expectedQty,
          receivedQty: item.receivedQty,
          differenceQty: item.differenceQty,
          unitPrice: item.unitPrice,
          amount: item.amount,
          remark: item.remark
        }))
      }
    },
    include: {
      items: {
        include: {
          product: true
        }
      },
      supplier: true
    }
  })
  
  const hasShortage = calculatedItems.some(item => item.differenceQty > 0)
  if (hasShortage) {
    await createPendingTask({
      type: 'INSPECTION_REQUIRED',
      source: 'Delivery',
      sourceId: delivery.id,
      title: `Delivery ${deliveryNo} has shortage, requires inspection`,
      description: `Delivery ${deliveryNo} has ${calculatedItems.filter(i => i.differenceQty > 0).length} items with shortage`,
      priority: 1
    })
  }
  
  const hasOverage = calculatedItems.some(item => item.differenceQty < 0)
  if (hasOverage) {
    await recordException({
      type: ExceptionType.QUANTITY_MISMATCH,
      source: 'DeliveryService',
      sourceId: delivery.id,
      supplierId,
      deliveryId: delivery.id,
      message: `Delivery ${deliveryNo} has overage items`,
      data: {
        items: calculatedItems.filter(i => i.differenceQty < 0).map(i => ({
          productId: i.productId,
          differenceQty: i.differenceQty
        }))
      }
    })
  }
  
  return delivery
}

async function getDeliveryById(id) {
  return prisma.delivery.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
          inspectionItem: true,
          claimItem: true
        }
      },
      supplier: true,
      inspection: true,
      claim: true,
      exceptions: true
    }
  })
}

async function getDeliveryByNo(deliveryNo) {
  return prisma.delivery.findUnique({
    where: { deliveryNo },
    include: {
      items: {
        include: {
          product: true,
          inspectionItem: true,
          claimItem: true
        }
      },
      supplier: true,
      inspection: true,
      claim: true,
      exceptions: true
    }
  })
}

async function listDeliveries(filters = {}) {
  const where = {}
  
  if (filters.status) where.status = filters.status
  if (filters.supplierId) where.supplierId = filters.supplierId
  if (filters.startDate || filters.endDate) {
    where.deliveryDate = {}
    if (filters.startDate) where.deliveryDate.gte = new Date(filters.startDate)
    if (filters.endDate) where.deliveryDate.lte = new Date(filters.endDate)
  }
  
  return prisma.delivery.findMany({
    where,
    orderBy: { deliveryDate: 'desc' },
    include: {
      supplier: true,
      items: true
    }
  })
}

module.exports = {
  DeliveryStatus,
  validateDeliveryItem,
  calculateDeliveryItem,
  determineDeliveryStatus,
  createDelivery,
  getDeliveryById,
  getDeliveryByNo,
  listDeliveries
}
