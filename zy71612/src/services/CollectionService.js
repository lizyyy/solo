import db from '../database/index.js'
import { CollectionStatus, BillStatus } from '../models/types.js'
import billService from './BillService.js'
import idemService from './IdemService.js'
import dayjs from 'dayjs'

class CollectionService {
  generateId() {
    return `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async createCollection(collectionData) {
    const bill = await billService.getBillById(collectionData.billId)
    if (!bill) {
      throw new Error('票据不存在')
    }

    if (bill.status === BillStatus.COLLECTED) {
      throw new Error('该票据已完成托收')
    }

    const applyDate = collectionData.applyDate || dayjs().format('YYYY-MM-DD')
    const idemKey = idemService.generateCollectionIdemKey(bill.billNo, applyDate)
    const checkResult = await idemService.checkExists('collections', idemKey)
    
    if (checkResult.exists) {
      return {
        success: false,
        duplicate: true,
        message: `票据 ${bill.billNo} 在 ${applyDate} 已有托收申请`,
        data: checkResult.data
      }
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const collection = {
      id: this.generateId(),
      billId: collectionData.billId,
      billNo: bill.billNo,
      applyDate,
      bank: collectionData.bank?.trim() || '',
      account: collectionData.account?.trim() || '',
      amount: Number(collectionData.amount) || bill.amount,
      status: collectionData.status || CollectionStatus.APPLIED,
      expectedDate: collectionData.expectedDate || '',
      actualDate: collectionData.actualDate || '',
      actualAmount: Number(collectionData.actualAmount) || 0,
      fee: Number(collectionData.fee) || 0,
      remark: collectionData.remark || '',
      idemKey,
      createdAt: now,
      updatedAt: now
    }

    await db.add('collections', collection)

    if (bill.status !== BillStatus.COLLECTING) {
      await billService.updateBillStatus(bill.id, BillStatus.COLLECTING, '提交托收申请')
    }

    return {
      success: true,
      duplicate: false,
      data: collection
    }
  }

  async getCollectionById(id) {
    return await db.get('collections', id)
  }

  async getCollectionsByBill(billId) {
    const collections = await db.getAllFromIndex('collections', 'billId', billId)
    return collections.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getAllCollections(filters = {}) {
    let collections = await db.getAll('collections')

    if (filters.status) {
      collections = collections.filter(c => c.status === filters.status)
    }
    if (filters.billNo) {
      collections = collections.filter(c => c.billNo.includes(filters.billNo))
    }
    if (filters.applyDateFrom) {
      collections = collections.filter(c => c.applyDate >= filters.applyDateFrom)
    }
    if (filters.applyDateTo) {
      collections = collections.filter(c => c.applyDate <= filters.applyDateTo)
    }

    return collections.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async updateCollectionStatus(id, newStatus, updateData = {}) {
    const collection = await db.get('collections', id)
    if (!collection) {
      throw new Error('托收记录不存在')
    }

    const validTransitions = this.getValidStatusTransitions(collection.status)
    if (!validTransitions.includes(newStatus)) {
      throw new Error(`不允许从 ${collection.status} 转换到 ${newStatus}`)
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const updated = {
      ...collection,
      ...updateData,
      status: newStatus,
      updatedAt: now
    }

    await db.put('collections', updated)

    if (newStatus === CollectionStatus.PAID) {
      await billService.updateBillStatus(collection.billId, BillStatus.COLLECTED, '托收完成，已兑付')
    } else if (newStatus === CollectionStatus.REJECTED) {
      await billService.updateBillStatus(collection.billId, BillStatus.NORMAL, '托收被驳回')
    }

    return updated
  }

  getValidStatusTransitions(currentStatus) {
    const transitions = {
      [CollectionStatus.APPLIED]: [CollectionStatus.ACCEPTED, CollectionStatus.REJECTED],
      [CollectionStatus.ACCEPTED]: [CollectionStatus.PAID, CollectionStatus.REJECTED],
      [CollectionStatus.REJECTED]: [CollectionStatus.APPLIED],
      [CollectionStatus.PAID]: []
    }
    return transitions[currentStatus] || []
  }

  async getPendingCollections() {
    return await db.getAllFromIndex('collections', 'status', CollectionStatus.APPLIED)
  }

  async getCollectionStatistics() {
    const collections = await this.getAllCollections()
    
    const stats = {
      total: collections.length,
      byStatus: {},
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0
    }

    collections.forEach(c => {
      stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1
      stats.totalAmount += c.amount

      if (c.status === CollectionStatus.PAID) {
        stats.paidAmount += c.actualAmount || c.amount
      } else if ([CollectionStatus.APPLIED, CollectionStatus.ACCEPTED].includes(c.status)) {
        stats.pendingAmount += c.amount
      }
    })

    return stats
  }
}

export const collectionService = new CollectionService()
export default collectionService
