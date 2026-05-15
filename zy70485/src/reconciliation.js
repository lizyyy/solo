import { v4 as uuidv4 } from 'uuid'
import { getDB, saveDB } from './db.js'
import { RECON_STATUS, ITEM_STATUS } from './constants.js'

export async function createReconciliation(source, batchNo, configType, items) {
  const db = await getDB()
  const reconId = uuidv4()

  const reconciliation = {
    id: reconId,
    batchNo,
    configType,
    source,
    status: RECON_STATUS.PENDING,
    items: items.map(item => ({
      id: uuidv4(),
      ...item,
      status: ITEM_STATUS.PENDING,
      receipt: null,
      receiptTime: null
    })),
    summary: {
      total: items.length,
      matched: 0,
      success: 0,
      failed: 0,
      waiting: 0,
      overdue: 0
    },
    materialSummary: generateMaterialSummary(source, items),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  db.data.reconciliations.push(reconciliation)
  await recordStatusChange(reconId, null, RECON_STATUS.PENDING, '系统创建对账任务')
  await saveDB()
  return reconciliation
}

export async function performMatching(reconId, receiptData) {
  const db = await getDB()
  const recon = db.data.reconciliations.find(r => r.id === reconId)
  if (!recon) throw new Error('对账记录不存在')

  const previousStatus = recon.status
  let matchedCount = 0

  for (const item of recon.items) {
    const receipt = receiptData.find(r => r.itemRef === item.itemRef)
    if (receipt) {
      item.receipt = receipt
      item.receiptTime = new Date().toISOString()
      item.status = ITEM_STATUS.MATCHED
      matchedCount++

      if (isReceiptLate(item.deadline, item.receiptTime)) {
        item.status = ITEM_STATUS.OVERDUE
        await addReminder(reconId, item.id, '回执晚到', `项目${item.itemRef}回执时间晚于截止时间${item.deadline}`)
      }
    } else {
      if (isOverdue(item.deadline)) {
        item.status = ITEM_STATUS.OVERDUE
        await addReminder(reconId, item.id, '回执逾期', `项目${item.itemRef}已超过截止时间${item.deadline}，尚未收到回执`)
      } else {
        item.status = ITEM_STATUS.WAITING_RECEIPT
      }
    }
  }

  recon.summary.matched = matchedCount
  recon.summary.waiting = recon.items.filter(i => i.status === ITEM_STATUS.WAITING_RECEIPT).length
  recon.summary.overdue = recon.items.filter(i => i.status === ITEM_STATUS.OVERDUE).length

  const allMatched = recon.items.every(i => i.status === ITEM_STATUS.MATCHED || i.status === ITEM_STATUS.OVERDUE)
  const hasOverdue = recon.items.some(i => i.status === ITEM_STATUS.OVERDUE)

  if (allMatched && !hasOverdue) {
    recon.status = RECON_STATUS.MATCHED
  } else if (hasOverdue) {
    recon.status = RECON_STATUS.RECEIPT_LATE
  } else if (matchedCount > 0) {
    recon.status = RECON_STATUS.PARTIAL_SUCCESS
  }

  recon.updatedAt = new Date().toISOString()
  await recordStatusChange(reconId, previousStatus, recon.status, `完成匹配，匹配成功${matchedCount}项`)
  await saveDB()
  return recon
}

export async function performValidation(reconId, validationResults) {
  const db = await getDB()
  const recon = db.data.reconciliations.find(r => r.id === reconId)
  if (!recon) throw new Error('对账记录不存在')

  const previousStatus = recon.status

  for (const result of validationResults) {
    const item = recon.items.find(i => i.itemRef === result.itemRef)
    if (item) {
      item.validationResult = result
      item.validatedAt = new Date().toISOString()

      if (result.success) {
        item.status = ITEM_STATUS.SUCCESS
      } else {
        item.status = ITEM_STATUS.FAILED
        await addReminder(reconId, item.id, '校验失败', `项目${item.itemRef}校验失败：${result.reason}`)
      }
    }
  }

  recon.summary.success = recon.items.filter(i => i.status === ITEM_STATUS.SUCCESS).length
  recon.summary.failed = recon.items.filter(i => i.status === ITEM_STATUS.FAILED).length

  const allSuccess = recon.items.every(i => i.status === ITEM_STATUS.SUCCESS)
  const hasSuccess = recon.items.some(i => i.status === ITEM_STATUS.SUCCESS)
  const hasFailed = recon.items.some(i => i.status === ITEM_STATUS.FAILED)

  if (allSuccess) {
    recon.status = RECON_STATUS.SUCCESS
  } else if (hasSuccess && hasFailed) {
    recon.status = RECON_STATUS.PARTIAL_SUCCESS
  } else if (hasFailed) {
    recon.status = RECON_STATUS.FAILED
  }

  recon.updatedAt = new Date().toISOString()
  await recordStatusChange(reconId, previousStatus, recon.status, `完成校验，成功${recon.summary.success}项，失败${recon.summary.failed}项`)
  await saveDB()
  return recon
}

export async function manualCorrect(reconId, itemId, newStatus, operator, remark) {
  const db = await getDB()
  const recon = db.data.reconciliations.find(r => r.id === reconId)
  if (!recon) throw new Error('对账记录不存在')

  const item = recon.items.find(i => i.id === itemId)
  if (!item) throw new Error('明细不存在')

  const previousItemStatus = item.status
  item.status = newStatus
  item.manualCorrected = true
  item.manualOperator = operator
  item.manualRemark = remark
  item.manualTime = new Date().toISOString()

  db.data.manualNotes.push({
    id: uuidv4(),
    reconId,
    itemId,
    previousStatus: previousItemStatus,
    newStatus,
    operator,
    remark,
    createdAt: new Date().toISOString()
  })

  const previousStatus = recon.status
  recon.status = RECON_STATUS.MANUAL_CORRECTED
  recon.updatedAt = new Date().toISOString()

  recon.summary.success = recon.items.filter(i => i.status === ITEM_STATUS.SUCCESS || i.status === ITEM_STATUS.MANUAL_CORRECTED).length

  await recordStatusChange(reconId, previousStatus, RECON_STATUS.MANUAL_CORRECTED, `人工修正：${operator} - ${remark}`)
  await saveDB()
  return recon
}

async function recordStatusChange(reconId, fromStatus, toStatus, reason) {
  const db = await getDB()
  db.data.statusChanges.push({
    id: uuidv4(),
    reconId,
    fromStatus,
    toStatus,
    reason,
    changedAt: new Date().toISOString()
  })
}

async function addReminder(reconId, itemId, type, content) {
  const db = await getDB()
  db.data.reminders.push({
    id: uuidv4(),
    reconId,
    itemId,
    type,
    content,
    isResolved: false,
    createdAt: new Date().toISOString()
  })
}

function generateMaterialSummary(source, items) {
  return {
    source,
    itemCount: items.length,
    departments: [...new Set(items.map(i => i.department))],
    earliestDeadline: items.reduce((min, i) => i.deadline < min ? i.deadline : min, items[0]?.deadline),
    latestDeadline: items.reduce((max, i) => i.deadline > max ? i.deadline : max, items[0]?.deadline),
    totalAmount: items.reduce((sum, i) => sum + (i.amount || 0), 0)
  }
}

function isReceiptLate(deadline, receiptTime) {
  return new Date(receiptTime) > new Date(deadline)
}

function isOverdue(deadline) {
  return new Date() > new Date(deadline)
}

export async function getReconciliation(id) {
  const db = await getDB()
  return db.data.reconciliations.find(r => r.id === id)
}

export async function listReconciliations(filters = {}) {
  const db = await getDB()
  let list = db.data.reconciliations
  if (filters.status) {
    list = list.filter(r => r.status === filters.status)
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function getStatusChanges(reconId) {
  const db = await getDB()
  return db.data.statusChanges.filter(s => s.reconId === reconId)
}

export async function getReminders(reconId) {
  const db = await getDB()
  return db.data.reminders.filter(r => r.reconId === reconId)
}

export async function getManualNotes(reconId) {
  const db = await getDB()
  return db.data.manualNotes.filter(n => n.reconId === reconId)
}
