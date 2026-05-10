const prisma = require('../lib/prisma')

const ExceptionType = {
  DATA_CONFLICT: 'DATA_CONFLICT',
  MISSING_INFO: 'MISSING_INFO',
  CALCULATION_ERROR: 'CALCULATION_ERROR',
  INVALID_STATUS: 'INVALID_STATUS',
  QUANTITY_MISMATCH: 'QUANTITY_MISMATCH',
  PRICE_MISMATCH: 'PRICE_MISMATCH'
}

const ExceptionStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  IGNORED: 'IGNORED'
}

async function recordException(options) {
  const {
    type,
    source,
    sourceId,
    supplierId,
    deliveryId,
    claimId,
    message,
    data
  } = options

  if (!type || !source || !message) {
    throw new Error('Exception type, source and message are required')
  }

  const exception = await prisma.exceptionRecord.create({
    data: {
      type,
      source,
      sourceId,
      supplierId,
      deliveryId,
      claimId,
      message,
      data: data ? JSON.stringify(data) : null,
      status: ExceptionStatus.OPEN
    }
  })

  return exception
}

async function createPendingTask(options) {
  const {
    type,
    source,
    sourceId,
    title,
    description,
    assignee,
    dueDate,
    priority = 0
  } = options

  if (!type || !source || !sourceId || !title) {
    throw new Error('Task type, source, sourceId and title are required')
  }

  const task = await prisma.pendingTask.create({
    data: {
      type,
      source,
      sourceId,
      title,
      description,
      assignee,
      dueDate,
      priority
    }
  })

  return task
}

async function getExceptions(filters = {}) {
  const where = {}
  
  if (filters.type) where.type = filters.type
  if (filters.status) where.status = filters.status
  if (filters.supplierId) where.supplierId = filters.supplierId
  if (filters.deliveryId) where.deliveryId = filters.deliveryId
  if (filters.claimId) where.claimId = filters.claimId

  return prisma.exceptionRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: true,
      delivery: true,
      claim: true
    }
  })
}

async function getPendingTasks(filters = {}) {
  const where = {}
  
  if (filters.type) where.type = filters.type
  if (filters.assignee) where.assignee = filters.assignee
  if (filters.completed === false) where.completedAt = null
  if (filters.source) where.source = filters.source

  return prisma.pendingTask.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
  })
}

async function resolveException(id, resolvedBy, resolutionNote) {
  return prisma.exceptionRecord.update({
    where: { id },
    data: {
      status: ExceptionStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedBy,
      resolutionNote
    }
  })
}

async function completeTask(id, completedBy) {
  return prisma.pendingTask.update({
    where: { id },
    data: {
      completedAt: new Date(),
      completedBy
    }
  })
}

module.exports = {
  ExceptionType,
  ExceptionStatus,
  recordException,
  createPendingTask,
  getExceptions,
  getPendingTasks,
  resolveException,
  completeTask
}
