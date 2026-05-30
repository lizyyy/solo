import db from '../database/index.js'
import dayjs from 'dayjs'

class RemarkService {
  generateId() {
    return `remark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async addRemark(targetType, targetId, content, operator = 'system') {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const remark = {
      id: this.generateId(),
      targetType,
      targetId,
      content: content?.trim() || '',
      operator,
      createdAt: now
    }

    if (!remark.content) {
      await db.add('remarks', remark)
    }

    return remark
  }

  async getRemarksByTarget(targetType, targetId) {
    const allRemarks = await db.getAll('remarks')
    return allRemarks
      .filter(r => r.targetType === targetType && r.targetId === targetId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getRemarksByType(targetType) {
    const allRemarks = await db.getAll('remarks')
    return allRemarks
      .filter(r => r.targetType === targetType)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async deleteRemark(id) {
    await db.delete('remarks', id)
    return true
  }

  async addBillRemark(billId, content, operator) {
    return await this.addRemark('bill', billId, content, operator)
  }

  async addEndorseRemark(endorseId, content, operator) {
    return await this.addRemark('endorse', endorseId, content, operator)
  }

  async addCollectionRemark(collectionId, content, operator) {
    return await this.addRemark('collection', collectionId, content, operator)
  }

  async addDiscountRemark(discountId, content, operator) {
    return await this.addRemark('discount', discountId, content, operator)
  }

  async addReminderRemark(reminderId, content, operator) {
    return await this.addRemark('reminder', reminderId, content, operator)
  }

  async addReportRemark(reportId, content, operator) {
    return await this.addRemark('report', reportId, content, operator)
  }

  async getBillRemarks(billId) {
    return await this.getRemarksByTarget('bill', billId)
  }

  async getRemarksStatistics() {
    const allRemarks = await db.getAll('remarks')
    const byType = {}
    
    allRemarks.forEach(r => {
      byType[r.targetType] = (byType[r.targetType] || 0) + 1
    })

    return {
      total: allRemarks.length,
      byType
    }
  }
}

export const remarkService = new RemarkService()
export default remarkService
