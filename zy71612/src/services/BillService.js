import db from '../database/index.js'
import { BillStatus, ProcessStatus } from '../models/types.js'
import dayjs from 'dayjs'

class BillService {
  generateId() {
    return `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async createBill(billData) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const bill = {
      id: this.generateId(),
      billNo: billData.billNo?.trim() || '',
      billType: billData.billType || 'bank',
      acceptor: billData.acceptor?.trim() || '',
      drawer: billData.drawer?.trim() || '',
      payee: billData.payee?.trim() || '',
      holder: billData.holder?.trim() || '',
      amount: Number(billData.amount) || 0,
      acceptDate: billData.acceptDate || '',
      matureDate: billData.matureDate || '',
      status: billData.status || BillStatus.NORMAL,
      processStatus: billData.processStatus || ProcessStatus.PENDING,
      isElectronic: billData.isElectronic !== false,
      remark: billData.remark || '',
      createdAt: now,
      updatedAt: now
    }

    if (!bill.billNo) {
      throw new Error('票据号不能为空')
    }
    if (!bill.matureDate) {
      throw new Error('到期日不能为空')
    }

    const existing = await db.getByIndex('bills', 'billNo', bill.billNo)
    if (existing) {
      throw new Error(`票据号 ${bill.billNo} 已存在`)
    }

    await db.add('bills', bill)
    return bill
  }

  async updateBill(id, billData) {
    const existing = await db.get('bills', id)
    if (!existing) {
      throw new Error('票据不存在')
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const updated = {
      ...existing,
      ...billData,
      id: existing.id,
      billNo: existing.billNo,
      updatedAt: now
    }

    await db.put('bills', updated)
    return updated
  }

  async updateBillStatus(id, newStatus, reason = '') {
    const bill = await db.get('bills', id)
    if (!bill) {
      throw new Error('票据不存在')
    }

    const validTransitions = this.getValidStatusTransitions(bill.status)
    if (!validTransitions.includes(newStatus)) {
      throw new Error(`不允许从 ${bill.status} 转换到 ${newStatus}`)
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    bill.status = newStatus
    bill.updatedAt = now
    if (reason) {
      bill.statusChangeReason = reason
    }

    await db.put('bills', bill)
    return bill
  }

  getValidStatusTransitions(currentStatus) {
    const transitions = {
      [BillStatus.DRAFT]: [BillStatus.NORMAL, BillStatus.VOID],
      [BillStatus.NORMAL]: [BillStatus.ENDORSED, BillStatus.COLLECTING, BillStatus.DISCOUNTED, BillStatus.EXPIRED, BillStatus.VOID],
      [BillStatus.ENDORSED]: [BillStatus.NORMAL, BillStatus.VOID],
      [BillStatus.COLLECTING]: [BillStatus.COLLECTED, BillStatus.NORMAL, BillStatus.VOID],
      [BillStatus.COLLECTED]: [BillStatus.VOID],
      [BillStatus.DISCOUNTED]: [BillStatus.VOID],
      [BillStatus.EXPIRED]: [BillStatus.COLLECTING, BillStatus.VOID],
      [BillStatus.VOID]: []
    }
    return transitions[currentStatus] || []
  }

  async updateProcessStatus(id, newProcessStatus, remark = '') {
    const bill = await db.get('bills', id)
    if (!bill) {
      throw new Error('票据不存在')
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    bill.processStatus = newProcessStatus
    bill.updatedAt = now
    if (remark) {
      bill.processRemark = remark
    }

    await db.put('bills', bill)
    return bill
  }

  async getBillById(id) {
    return await db.get('bills', id)
  }

  async getBillByNo(billNo) {
    return await db.getByIndex('bills', 'billNo', billNo)
  }

  async getAllBills(filters = {}) {
    let bills = await db.getAll('bills')

    if (filters.status) {
      bills = bills.filter(b => b.status === filters.status)
    }
    if (filters.processStatus) {
      bills = bills.filter(b => b.processStatus === filters.processStatus)
    }
    if (filters.matureDateFrom) {
      bills = bills.filter(b => b.matureDate >= filters.matureDateFrom)
    }
    if (filters.matureDateTo) {
      bills = bills.filter(b => b.matureDate <= filters.matureDateTo)
    }

    return bills.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getBillsNeedingReminder(referenceDate = null) {
    const date = referenceDate || dayjs().format('YYYY-MM-DD')
    const bills = await this.getAllBills()

    return bills.filter(bill => {
      if (![BillStatus.NORMAL, BillStatus.COLLECTING, BillStatus.EXPIRED].includes(bill.status)) {
        return false
      }
      if (bill.processStatus === ProcessStatus.CONFIRMED) {
        return false
      }
      return bill.matureDate >= date
    })
  }

  async getBillsByDateRange(startDate, endDate) {
    const bills = await this.getAllBills()
    return bills.filter(bill => 
      bill.matureDate >= startDate && bill.matureDate <= endDate
    ).sort((a, b) => a.matureDate.localeCompare(b.matureDate))
  }

  async deleteBill(id) {
    const bill = await db.get('bills', id)
    if (!bill) {
      throw new Error('票据不存在')
    }
    await db.delete('bills', id)
    return true
  }

  async getBillStatistics() {
    const bills = await this.getAllBills()
    
    const stats = {
      total: bills.length,
      byStatus: {},
      byProcessStatus: {},
      totalAmount: 0,
      matureIn7Days: 0,
      matureIn30Days: 0,
      overdue: 0
    }

    const now = dayjs()
    bills.forEach(bill => {
      stats.byStatus[bill.status] = (stats.byStatus[bill.status] || 0) + 1
      stats.byProcessStatus[bill.processStatus] = (stats.byProcessStatus[bill.processStatus] || 0) + 1
      stats.totalAmount += bill.amount

      const matureDate = dayjs(bill.matureDate)
      const daysToMature = matureDate.diff(now, 'day')
      
      if (daysToMature < 0) {
        stats.overdue++
      } else if (daysToMature <= 7) {
        stats.matureIn7Days++
      } else if (daysToMature <= 30) {
        stats.matureIn30Days++
      }
    })

    return stats
  }
}

export const billService = new BillService()
export default billService
