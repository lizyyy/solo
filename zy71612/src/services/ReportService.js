import db from '../database/index.js'
import idemService from './IdemService.js'
import billService from './BillService.js'
import reminderService from './ReminderService.js'
import collectionService from './CollectionService.js'
import discountService from './DiscountService.js'
import endorseService from './EndorseService.js'
import dayjs from 'dayjs'

class ReportService {
  generateId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async generateMatureReport(reportDate = null) {
    const date = reportDate || dayjs().format('YYYY-MM-DD')
    const reportType = 'mature_daily'
    const idemKey = idemService.generateReportIdemKey(reportType, date)

    const existing = await idemService.checkExists('reports', idemKey)
    if (existing.exists) {
      return {
        success: true,
        cached: true,
        data: existing.data
      }
    }

    const bills = await billService.getBillsNeedingReminder(date)
    const reminderResult = await reminderService.generateReminders(date)
    
    const matureIn7Days = bills.filter(b => {
      const diff = dayjs(b.matureDate).diff(dayjs(date), 'day')
      return diff >= 0 && diff <= 7
    })

    const matureIn30Days = bills.filter(b => {
      const diff = dayjs(b.matureDate).diff(dayjs(date), 'day')
      return diff >= 0 && diff <= 30
    })

    const overdue = bills.filter(b => {
      return dayjs(b.matureDate).isBefore(dayjs(date), 'day')
    })

    const byStatus = {}
    let totalAmount = 0

    bills.forEach(b => {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1
      totalAmount += b.amount
    })

    const report = {
      id: this.generateId(),
      reportType,
      reportDate: date,
      idemKey,
      summary: {
        totalBills: bills.length,
        totalAmount,
        matureIn7Days: matureIn7Days.length,
        matureIn7DaysAmount: matureIn7Days.reduce((s, b) => s + b.amount, 0),
        matureIn30Days: matureIn30Days.length,
        matureIn30DaysAmount: matureIn30Days.reduce((s, b) => s + b.amount, 0),
        overdue: overdue.length,
        overdueAmount: overdue.reduce((s, b) => s + b.amount, 0),
        byStatus
      },
      reminders: reminderResult,
      bills: bills.map(b => ({
        id: b.id,
        billNo: b.billNo,
        acceptor: b.acceptor,
        amount: b.amount,
        matureDate: b.matureDate,
        status: b.status,
        daysToMature: dayjs(b.matureDate).diff(dayjs(date), 'day')
      })),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    await db.add('reports', report)
    return {
      success: true,
      cached: false,
      data: report
    }
  }

  async generateCollectionReport(startDate, endDate) {
    const reportType = 'collection'
    const dateRange = `${startDate}_${endDate}`
    const idemKey = idemService.generateReportIdemKey(reportType, dateRange)

    const existing = await idemService.checkExists('reports', idemKey)
    if (existing.exists) {
      return {
        success: true,
        cached: true,
        data: existing.data
      }
    }

    const allCollections = await collectionService.getAllCollections()
    const collections = allCollections.filter(c => 
      c.applyDate >= startDate && c.applyDate <= endDate
    )

    const byStatus = {}
    let totalAmount = 0
    let paidAmount = 0

    collections.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1
      totalAmount += c.amount
      if (c.status === 'paid') {
        paidAmount += c.actualAmount || c.amount
      }
    })

    const report = {
      id: this.generateId(),
      reportType,
      startDate,
      endDate,
      idemKey,
      summary: {
        total: collections.length,
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
        byStatus
      },
      collections,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    await db.add('reports', report)
    return {
      success: true,
      cached: false,
      data: report
    }
  }

  async generateDiscountReport(startDate, endDate) {
    const reportType = 'discount'
    const dateRange = `${startDate}_${endDate}`
    const idemKey = idemService.generateReportIdemKey(reportType, dateRange)

    const existing = await idemService.checkExists('reports', idemKey)
    if (existing.exists) {
      return {
        success: true,
        cached: true,
        data: existing.data
      }
    }

    const allDiscounts = await discountService.getAllDiscounts()
    const discounts = allDiscounts.filter(d => 
      d.applyDate >= startDate && d.applyDate <= endDate
    )

    const byStatus = {}
    let totalAmount = 0
    let totalDiscountAmount = 0
    let actualAmount = 0

    discounts.forEach(d => {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1
      totalAmount += d.amount
      totalDiscountAmount += d.discountAmount
      if (d.status === 'paid') {
        actualAmount += d.actualAmount || d.amount
      }
    })

    const report = {
      id: this.generateId(),
      reportType,
      startDate,
      endDate,
      idemKey,
      summary: {
        total: discounts.length,
        totalAmount,
        totalDiscountAmount,
        actualAmount,
        byStatus
      },
      discounts,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    await db.add('reports', report)
    return {
      success: true,
      cached: false,
      data: report
    }
  }

  async generateEndorseReport() {
    const reportType = 'endorse_chain'
    const today = dayjs().format('YYYY-MM-DD')
    const idemKey = idemService.generateReportIdemKey(reportType, today)

    const existing = await idemService.checkExists('reports', idemKey)
    if (existing.exists) {
      return {
        success: true,
        cached: true,
        data: existing.data
      }
    }

    const chainStats = await endorseService.getChainStatistics()
    const allEndorses = await db.getAll('endorses')
    
    const billGroups = new Map()
    allEndorses.forEach(e => {
      if (!billGroups.has(e.billId)) {
        billGroups.set(e.billId, [])
      }
      billGroups.get(e.billId).push(e)
    })

    const chainIssues = []
    for (const [billId, endorses] of billGroups) {
      const checkResult = await endorseService.checkEndorseChain(billId)
      if (!checkResult.isComplete) {
        chainIssues.push({
          billId,
          billNo: endorses[0].billNo,
          issues: checkResult.issues
        })
      }
    }

    const report = {
      id: this.generateId(),
      reportType,
      reportDate: today,
      idemKey,
      summary: chainStats,
      chainIssues,
      totalEndorses: allEndorses.length,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    await db.add('reports', report)
    return {
      success: true,
      cached: false,
      data: report
    }
  }

  async getReportById(id) {
    return await db.get('reports', id)
  }

  async getAllReports(reportType = null) {
    let reports = await db.getAll('reports')
    if (reportType) {
      reports = reports.filter(r => r.reportType === reportType)
    }
    return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async deleteReport(id) {
    await db.delete('reports', id)
    return true
  }

  async getDashboardData() {
    const billStats = await billService.getBillStatistics()
    const collectionStats = await collectionService.getCollectionStatistics()
    const discountStats = await discountService.getDiscountStatistics()
    const chainStats = await endorseService.getChainStatistics()
    const reminderStats = await reminderService.getReminderStatistics()

    return {
      bills: billStats,
      collections: collectionStats,
      discounts: discountStats,
      endorses: chainStats,
      reminders: reminderStats,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
  }
}

export const reportService = new ReportService()
export default reportService
