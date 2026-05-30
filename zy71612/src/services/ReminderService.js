import db from '../database/index.js'
import { ReminderType, BillStatus, ProcessStatus } from '../models/types.js'
import billService from './BillService.js'
import idemService from './IdemService.js'
import discountService from './DiscountService.js'
import collectionService from './CollectionService.js'
import dayjs from 'dayjs'

class ReminderService {
  generateId() {
    return `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getReminderType(daysToMature) {
    if (daysToMature < 0) return ReminderType.OVERDUE
    if (daysToMature === 0) return ReminderType.MATURE_TODAY
    if (daysToMature === 1) return ReminderType.MATURE_1D
    if (daysToMature === 3) return ReminderType.MATURE_3D
    if (daysToMature === 7) return ReminderType.MATURE_7D
    return null
  }

  async shouldGenerateReminder(bill, reminderType, referenceDate) {
    if (bill.status === BillStatus.DISCOUNTED) {
      return { should: false, reason: '票据已贴现，无需提醒' }
    }

    if (bill.status === BillStatus.COLLECTED) {
      return { should: false, reason: '票据已托收完成，无需提醒' }
    }

    if (bill.status === BillStatus.ENDORSED) {
      return { should: false, reason: '票据已背书转让，无需提醒' }
    }

    if (bill.status === BillStatus.VOID) {
      return { should: false, reason: '票据已作废，无需提醒' }
    }

    if (bill.status === BillStatus.DISCOUNTED) {
      return { should: false, reason: '票据已贴现' }
    }

    if (bill.processStatus === ProcessStatus.CONFIRMED) {
      return { should: false, reason: '该票据提醒已确认处理' }
    }

    const idemKey = idemService.generateReminderIdemKey(bill.billNo, reminderType, referenceDate)
    const existing = await idemService.checkExists('reminders', idemKey)
    if (existing.exists) {
      return { should: false, reason: '该类型提醒已生成', existing: existing.data }
    }

    return { should: true }
  }

  async generateReminders(referenceDate = null) {
    const date = referenceDate || dayjs().format('YYYY-MM-DD')
    const refDayjs = dayjs(date)
    const bills = await billService.getAllBills()
    const results = []
    const skipped = []

    for (const bill of bills) {
      if (!bill.matureDate) continue

      const matureDayjs = dayjs(bill.matureDate)
      const daysToMature = matureDayjs.diff(refDayjs, 'day')
      const reminderType = this.getReminderType(daysToMature)

      if (!reminderType) continue

      const checkResult = await this.shouldGenerateReminder(bill, reminderType, date)
      
      if (!checkResult.should) {
        skipped.push({
          billNo: bill.billNo,
          reminderType,
          reason: checkResult.reason,
          existing: checkResult.existing
        })
        continue
      }

      const reminder = await this._createReminder(bill, reminderType, date, daysToMature)
      results.push(reminder)
    }

    return {
      generated: results,
      skipped,
      totalGenerated: results.length,
      totalSkipped: skipped.length,
      reportDate: date
    }
  }

  async _createReminder(bill, reminderType, reminderDate, daysToMature) {
    const idemKey = idemService.generateReminderIdemKey(bill.billNo, reminderType, reminderDate)
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')

    const hasActiveCollection = await this._hasActiveCollection(bill.id)
    const hasActiveDiscount = await this._hasActiveDiscount(bill.id)

    const reminder = {
      id: this.generateId(),
      billId: bill.id,
      billNo: bill.billNo,
      acceptor: bill.acceptor,
      amount: bill.amount,
      matureDate: bill.matureDate,
      reminderDate,
      reminderType,
      daysToMature,
      processStatus: ProcessStatus.PENDING,
      billStatus: bill.status,
      hasActiveCollection,
      hasActiveDiscount,
      remark: '',
      idemKey,
      createdAt: now,
      updatedAt: now
    }

    await db.add('reminders', reminder)
    return reminder
  }

  async _hasActiveCollection(billId) {
    const collections = await collectionService.getCollectionsByBill(billId)
    return collections.some(c => ['applied', 'accepted'].includes(c.status))
  }

  async _hasActiveDiscount(billId) {
    const discounts = await discountService.getDiscountsByBill(billId)
    return discounts.some(d => ['applied', 'approved'].includes(d.status))
  }

  async getReminderById(id) {
    return await db.get('reminders', id)
  }

  async getAllReminders(filters = {}) {
    let reminders = await db.getAll('reminders')

    if (filters.reminderType) {
      reminders = reminders.filter(r => r.reminderType === filters.reminderType)
    }
    if (filters.processStatus) {
      reminders = reminders.filter(r => r.processStatus === filters.processStatus)
    }
    if (filters.reminderDate) {
      reminders = reminders.filter(r => r.reminderDate === filters.reminderDate)
    }
    if (filters.billNo) {
      reminders = reminders.filter(r => r.billNo.includes(filters.billNo))
    }

    return reminders.sort((a, b) => {
      if (a.reminderDate !== b.reminderDate) {
        return b.reminderDate.localeCompare(a.reminderDate)
      }
      return b.createdAt.localeCompare(a.createdAt)
    })
  }

  async getRemindersByDate(reminderDate) {
    return await db.getAllFromIndex('reminders', 'reminderDate', reminderDate)
  }

  async getRemindersByBill(billId) {
    const reminders = await db.getAllFromIndex('reminders', 'billId', billId)
    return reminders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async updateProcessStatus(id, newProcessStatus, remark = '') {
    const reminder = await db.get('reminders', id)
    if (!reminder) {
      throw new Error('提醒记录不存在')
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    reminder.processStatus = newProcessStatus
    reminder.updatedAt = now
    if (remark) {
      reminder.processRemark = remark
    }

    await db.put('reminders', reminder)

    if (newProcessStatus === ProcessStatus.CONFIRMED) {
      await billService.updateProcessStatus(reminder.billId, ProcessStatus.CONFIRMED, remark)
    }

    return reminder
  }

  async batchConfirmReminders(reminderIds, remark = '') {
    const results = []
    for (const id of reminderIds) {
      try {
        const updated = await this.updateProcessStatus(id, ProcessStatus.CONFIRMED, remark)
        results.push({ id, success: true, data: updated })
      } catch (error) {
        results.push({ id, success: false, error: error.message })
      }
    }
    return results
  }

  async getPendingReminders() {
    return await db.getAllFromIndex('reminders', 'processStatus', ProcessStatus.PENDING)
  }

  async getReminderStatistics(reminderDate = null) {
    const date = reminderDate || dayjs().format('YYYY-MM-DD')
    const reminders = await this.getAllReminders({ reminderDate: date })
    
    const stats = {
      reminderDate: date,
      total: reminders.length,
      byType: {},
      byProcessStatus: {},
      totalAmount: 0,
      pendingCount: 0,
      confirmedCount: 0,
      pendingAmount: 0
    }

    reminders.forEach(r => {
      stats.byType[r.reminderType] = (stats.byType[r.reminderType] || 0) + 1
      stats.byProcessStatus[r.processStatus] = (stats.byProcessStatus[r.processStatus] || 0) + 1
      stats.totalAmount += r.amount

      if (r.processStatus === ProcessStatus.PENDING) {
        stats.pendingCount++
        stats.pendingAmount += r.amount
      } else if (r.processStatus === ProcessStatus.CONFIRMED) {
        stats.confirmedCount++
      }
    })

    return stats
  }

  async cleanUpOldReminders(daysToKeep = 90) {
    const cutoffDate = dayjs().subtract(daysToKeep, 'day').format('YYYY-MM-DD')
    const reminders = await db.getAll('reminders')
    const toDelete = reminders.filter(r => r.reminderDate < cutoffDate)
    
    for (const r of toDelete) {
      await db.delete('reminders', r.id)
    }

    return { deleted: toDelete.length, cutoffDate }
  }
}

export const reminderService = new ReminderService()
export default reminderService
