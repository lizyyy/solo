import db from '../database/index.js'

class IdemService {
  generateIdemKey(prefix, ...args) {
    const cleanArgs = args.map(arg => {
      if (arg instanceof Date) {
        return arg.toISOString().split('T')[0]
      }
      if (typeof arg === 'string') {
        return arg.trim().toUpperCase()
      }
      return String(arg)
    })
    return `${prefix}:${cleanArgs.join(':')}`
  }

  async checkExists(storeName, idemKey) {
    try {
      const existing = await db.getByIndex(storeName, 'idemKey', idemKey)
      return { exists: !!existing, data: existing }
    } catch (error) {
      console.error(`Check idemKey failed: ${idemKey}`, error)
      return { exists: false, data: null }
    }
  }

  generateReminderIdemKey(billNo, reminderType, reminderDate) {
    return this.generateIdemKey('reminder', billNo, reminderType, reminderDate)
  }

  generateCollectionIdemKey(billNo, applyDate) {
    return this.generateIdemKey('collection', billNo, applyDate)
  }

  generateDiscountIdemKey(billNo, applyDate) {
    return this.generateIdemKey('discount', billNo, applyDate)
  }

  generateReportIdemKey(reportType, reportDate) {
    return this.generateIdemKey('report', reportType, reportDate)
  }

  async checkReminderExists(billNo, reminderType, reminderDate) {
    const idemKey = this.generateReminderIdemKey(billNo, reminderType, reminderDate)
    return await this.checkExists('reminders', idemKey)
  }

  async checkCollectionExists(billNo, applyDate) {
    const idemKey = this.generateCollectionIdemKey(billNo, applyDate)
    return await this.checkExists('collections', idemKey)
  }

  async checkDiscountExists(billNo, applyDate) {
    const idemKey = this.generateDiscountIdemKey(billNo, applyDate)
    return await this.checkExists('discounts', idemKey)
  }

  async checkReportExists(reportType, reportDate) {
    const idemKey = this.generateReportIdemKey(reportType, reportDate)
    return await this.checkExists('reports', idemKey)
  }

  async safeAddWithIdem(storeName, data, idemKey) {
    const checkResult = await this.checkExists(storeName, idemKey)
    if (checkResult.exists) {
      return {
        success: false,
        duplicate: true,
        message: '重复请求已被拦截',
        data: checkResult.data
      }
    }

    const dataWithIdem = { ...data, idemKey }
    const id = await db.add(storeName, dataWithIdem)
    return {
      success: true,
      duplicate: false,
      id,
      data: { ...dataWithIdem, id }
    }
  }

  async safeUpdateWithIdem(storeName, data, idemKey) {
    const checkResult = await this.checkExists(storeName, idemKey)
    if (!checkResult.exists) {
      return {
        success: false,
        found: false,
        message: '记录不存在'
      }
    }

    const dataWithIdem = { ...data, idemKey, id: checkResult.data.id }
    await db.put(storeName, dataWithIdem)
    return {
      success: true,
      found: true,
      data: dataWithIdem
    }
  }
}

export const idemService = new IdemService()
export default idemService
