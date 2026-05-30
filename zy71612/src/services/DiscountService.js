import db from '../database/index.js'
import { DiscountStatus, BillStatus } from '../models/types.js'
import billService from './BillService.js'
import idemService from './IdemService.js'
import dayjs from 'dayjs'

class DiscountService {
  generateId() {
    return `discount_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async createDiscount(discountData) {
    const bill = await billService.getBillById(discountData.billId)
    if (!bill) {
      throw new Error('票据不存在')
    }

    if (bill.status === BillStatus.DISCOUNTED) {
      throw new Error('该票据已贴现')
    }

    const applyDate = discountData.applyDate || dayjs().format('YYYY-MM-DD')
    const idemKey = idemService.generateDiscountIdemKey(bill.billNo, applyDate)
    const checkResult = await idemService.checkExists('discounts', idemKey)
    
    if (checkResult.exists) {
      return {
        success: false,
        duplicate: true,
        message: `票据 ${bill.billNo} 在 ${applyDate} 已有贴现申请`,
        data: checkResult.data
      }
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const discount = {
      id: this.generateId(),
      billId: discountData.billId,
      billNo: bill.billNo,
      applyDate,
      bank: discountData.bank?.trim() || '',
      discountRate: Number(discountData.discountRate) || 0,
      amount: Number(discountData.amount) || bill.amount,
      discountAmount: Number(discountData.discountAmount) || 0,
      actualAmount: Number(discountData.actualAmount) || 0,
      status: discountData.status || DiscountStatus.APPLIED,
      expectedDate: discountData.expectedDate || '',
      actualDate: discountData.actualDate || '',
      remark: discountData.remark || '',
      idemKey,
      createdAt: now,
      updatedAt: now
    }

    await db.add('discounts', discount)

    if (discount.status === DiscountStatus.PAID) {
      await billService.updateBillStatus(bill.id, BillStatus.DISCOUNTED, '票据贴现')
    }

    return {
      success: true,
      duplicate: false,
      data: discount
    }
  }

  async getDiscountById(id) {
    return await db.get('discounts', id)
  }

  async getDiscountsByBill(billId) {
    const discounts = await db.getAllFromIndex('discounts', 'billId', billId)
    return discounts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getAllDiscounts(filters = {}) {
    let discounts = await db.getAll('discounts')

    if (filters.status) {
      discounts = discounts.filter(d => d.status === filters.status)
    }
    if (filters.billNo) {
      discounts = discounts.filter(d => d.billNo.includes(filters.billNo))
    }
    if (filters.applyDateFrom) {
      discounts = discounts.filter(d => d.applyDate >= filters.applyDateFrom)
    }
    if (filters.applyDateTo) {
      discounts = discounts.filter(d => d.applyDate <= filters.applyDateTo)
    }

    return discounts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async updateDiscountStatus(id, newStatus, updateData = {}) {
    const discount = await db.get('discounts', id)
    if (!discount) {
      throw new Error('贴现记录不存在')
    }

    const validTransitions = this.getValidStatusTransitions(discount.status)
    if (!validTransitions.includes(newStatus)) {
      throw new Error(`不允许从 ${discount.status} 转换到 ${newStatus}`)
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const updated = {
      ...discount,
      ...updateData,
      status: newStatus,
      updatedAt: now
    }

    await db.put('discounts', updated)

    if (newStatus === DiscountStatus.PAID) {
      await billService.updateBillStatus(discount.billId, BillStatus.DISCOUNTED, '贴现完成，已放款')
    } else if (newStatus === DiscountStatus.REJECTED) {
      await billService.updateBillStatus(discount.billId, BillStatus.NORMAL, '贴现被驳回')
    }

    return updated
  }

  getValidStatusTransitions(currentStatus) {
    const transitions = {
      [DiscountStatus.APPLIED]: [DiscountStatus.APPROVED, DiscountStatus.REJECTED],
      [DiscountStatus.APPROVED]: [DiscountStatus.PAID, DiscountStatus.REJECTED],
      [DiscountStatus.REJECTED]: [DiscountStatus.APPLIED],
      [DiscountStatus.PAID]: []
    }
    return transitions[currentStatus] || []
  }

  async getPendingDiscounts() {
    return await db.getAllFromIndex('discounts', 'status', DiscountStatus.APPLIED)
  }

  async getDiscountStatistics() {
    const discounts = await this.getAllDiscounts()
    
    const stats = {
      total: discounts.length,
      byStatus: {},
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      totalDiscountAmount: 0
    }

    discounts.forEach(d => {
      stats.byStatus[d.status] = (stats.byStatus[d.status] || 0) + 1
      stats.totalAmount += d.amount
      stats.totalDiscountAmount += d.discountAmount

      if (d.status === DiscountStatus.PAID) {
        stats.paidAmount += d.actualAmount || d.amount
      } else if ([DiscountStatus.APPLIED, DiscountStatus.APPROVED].includes(d.status)) {
        stats.pendingAmount += d.amount
      }
    })

    return stats
  }
}

export const discountService = new DiscountService()
export default discountService
