import db from '../database/index.js'
import dayjs from 'dayjs'

class LogService {
  generateId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async log(targetType, targetId, operation, detail = {}, operator = 'system') {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const log = {
      id: this.generateId(),
      targetType,
      targetId,
      operation,
      detail: typeof detail === 'object' ? JSON.stringify(detail) : String(detail),
      operator,
      createdAt: now
    }

    await db.add('operationLogs', log)
    return log
  }

  async getLogsByTarget(targetType, targetId) {
    const allLogs = await db.getAll('operationLogs')
    return allLogs
      .filter(l => l.targetType === targetType && l.targetId === targetId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getLogsByOperation(operation) {
    const allLogs = await db.getAll('operationLogs')
    return allLogs
      .filter(l => l.operation === operation)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getLogsByDateRange(startDate, endDate) {
    const allLogs = await db.getAll('operationLogs')
    return allLogs
      .filter(l => l.createdAt >= startDate && l.createdAt <= endDate + ' 23:59:59')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getAllLogs(limit = 1000) {
    const allLogs = await db.getAll('operationLogs')
    return allLogs
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  async logBillCreate(billId, billData, operator) {
    return await this.log('bill', billId, 'create', billData, operator)
  }

  async logBillUpdate(billId, changes, operator) {
    return await this.log('bill', billId, 'update', changes, operator)
  }

  async logBillStatusChange(billId, oldStatus, newStatus, reason, operator) {
    return await this.log('bill', billId, 'status_change', { oldStatus, newStatus, reason }, operator)
  }

  async logEndorseAdd(billId, endorseId, endorseData, operator) {
    return await this.log('endorse', endorseId, 'add', { billId, ...endorseData }, operator)
  }

  async logCollectionCreate(billId, collectionId, data, operator) {
    return await this.log('collection', collectionId, 'create', { billId, ...data }, operator)
  }

  async logCollectionStatusChange(collectionId, oldStatus, newStatus, operator) {
    return await this.log('collection', collectionId, 'status_change', { oldStatus, newStatus }, operator)
  }

  async logDiscountCreate(billId, discountId, data, operator) {
    return await this.log('discount', discountId, 'create', { billId, ...data }, operator)
  }

  async logDiscountStatusChange(discountId, oldStatus, newStatus, operator) {
    return await this.log('discount', discountId, 'status_change', { oldStatus, newStatus }, operator)
  }

  async logReminderGenerate(reminderId, data, operator) {
    return await this.log('reminder', reminderId, 'generate', data, operator)
  }

  async logReminderConfirm(reminderId, remark, operator) {
    return await this.log('reminder', reminderId, 'confirm', { remark }, operator)
  }

  async logReportGenerate(reportId, reportType, reportDate, operator) {
    return await this.log('report', reportId, 'generate', { reportType, reportDate }, operator)
  }

  async logExport(exportType, filters, count, operator) {
    return await this.log('system', 'export', 'export', { exportType, filters, count }, operator)
  }

  async getOperationStatistics() {
    const allLogs = await this.getAllLogs(10000)
    const byOperation = {}
    const byTargetType = {}

    allLogs.forEach(l => {
      byOperation[l.operation] = (byOperation[l.operation] || 0) + 1
      byTargetType[l.targetType] = (byTargetType[l.targetType] || 0) + 1
    })

    return {
      total: allLogs.length,
      byOperation,
      byTargetType
    }
  }
}

export const logService = new LogService()
export default logService
