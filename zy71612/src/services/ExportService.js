import * as XLSX from 'xlsx'
import {
  BillStatusText,
  ProcessStatusText,
  ReminderTypeText,
  CollectionStatusText,
  DiscountStatusText,
  EndorseTypeText
} from '../models/types.js'
import logService from './LogService.js'

class ExportService {
  formatAmount(amount) {
    return Number(amount).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  toCSV(data, columns, filename) {
    const BOM = '\uFEFF'
    const header = columns.map(c => c.title).join(',')
    const rows = data.map(item => 
      columns.map(c => {
        let value = item[c.key]
        if (c.formatter) {
          value = c.formatter(value, item)
        }
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = '"' + value.replace(/"/g, '""') + '"'
        }
        return value
      }).join(',')
    )
    
    const csvContent = BOM + [header, ...rows].join('\n')
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;')
    return { success: true, count: data.length }
  }

  toExcel(data, columns, sheetName, filename) {
    const wsData = [
      columns.map(c => c.title),
      ...data.map(item => 
        columns.map(c => {
          let value = item[c.key]
          if (c.formatter) {
            value = c.formatter(value, item)
          }
          return value
        })
      )
    ]

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    return { success: true, count: data.length }
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  getBillColumns() {
    return [
      { key: 'billNo', title: '票据号' },
      { key: 'billType', title: '票据类型', formatter: (v) => v === 'bank' ? '银行承兑' : '商业承兑' },
      { key: 'acceptor', title: '承兑人' },
      { key: 'drawer', title: '出票人' },
      { key: 'holder', title: '持票人' },
      { key: 'amount', title: '票面金额', formatter: (v) => this.formatAmount(v) },
      { key: 'acceptDate', title: '出票日期' },
      { key: 'matureDate', title: '到期日期' },
      { key: 'status', title: '票据状态', formatter: (v) => BillStatusText[v] || v },
      { key: 'processStatus', title: '处理状态', formatter: (v) => ProcessStatusText[v] || v },
      { key: 'remark', title: '备注' },
      { key: 'createdAt', title: '创建时间' }
    ]
  }

  getReminderColumns() {
    return [
      { key: 'billNo', title: '票据号' },
      { key: 'acceptor', title: '承兑人' },
      { key: 'amount', title: '票面金额', formatter: (v) => this.formatAmount(v) },
      { key: 'matureDate', title: '到期日期' },
      { key: 'reminderDate', title: '提醒日期' },
      { key: 'reminderType', title: '提醒类型', formatter: (v) => ReminderTypeText[v] || v },
      { key: 'daysToMature', title: '距到期天数' },
      { key: 'billStatus', title: '票据状态', formatter: (v) => BillStatusText[v] || v },
      { key: 'processStatus', title: '处理状态', formatter: (v) => ProcessStatusText[v] || v },
      { key: 'hasActiveCollection', title: '托收中', formatter: (v) => v ? '是' : '否' },
      { key: 'hasActiveDiscount', title: '贴现中', formatter: (v) => v ? '是' : '否' },
      { key: 'remark', title: '备注' }
    ]
  }

  getCollectionColumns() {
    return [
      { key: 'billNo', title: '票据号' },
      { key: 'applyDate', title: '申请日期' },
      { key: 'bank', title: '托收银行' },
      { key: 'account', title: '托收账户' },
      { key: 'amount', title: '托收金额', formatter: (v) => this.formatAmount(v) },
      { key: 'status', title: '状态', formatter: (v) => CollectionStatusText[v] || v },
      { key: 'expectedDate', title: '预计到账日' },
      { key: 'actualDate', title: '实际到账日' },
      { key: 'actualAmount', title: '实际到账金额', formatter: (v) => this.formatAmount(v) },
      { key: 'fee', title: '手续费', formatter: (v) => this.formatAmount(v) },
      { key: 'remark', title: '备注' }
    ]
  }

  getDiscountColumns() {
    return [
      { key: 'billNo', title: '票据号' },
      { key: 'applyDate', title: '申请日期' },
      { key: 'bank', title: '贴现银行' },
      { key: 'amount', title: '票面金额', formatter: (v) => this.formatAmount(v) },
      { key: 'discountRate', title: '贴现利率(%)', formatter: (v) => v + '%' },
      { key: 'discountAmount', title: '贴现利息', formatter: (v) => this.formatAmount(v) },
      { key: 'actualAmount', title: '实付金额', formatter: (v) => this.formatAmount(v) },
      { key: 'status', title: '状态', formatter: (v) => DiscountStatusText[v] || v },
      { key: 'actualDate', title: '放款日期' },
      { key: 'remark', title: '备注' }
    ]
  }

  getEndorseColumns() {
    return [
      { key: 'billNo', title: '票据号' },
      { key: 'sequence', title: '背书序号' },
      { key: 'endorseType', title: '背书类型', formatter: (v) => EndorseTypeText[v] || v },
      { key: 'endorser', title: '背书人' },
      { key: 'endorsee', title: '被背书人' },
      { key: 'endorseDate', title: '背书日期' },
      { key: 'amount', title: '背书金额', formatter: (v) => this.formatAmount(v) },
      { key: 'isBroken', title: '断链标记', formatter: (v) => v ? '是' : '否' },
      { key: 'breakReason', title: '断链原因' },
      { key: 'remark', title: '备注' }
    ]
  }

  async exportBills(bills, format = 'excel', filename = null) {
    const columns = this.getBillColumns()
    const ext = format === 'excel' ? '.xlsx' : '.csv'
    const finalFilename = filename || `票据清单_${new Date().toISOString().split('T')[0]}${ext}`

    let result
    if (format === 'excel') {
      result = this.toExcel(bills, columns, '票据清单', finalFilename)
    } else {
      result = this.toCSV(bills, columns, finalFilename)
    }

    await logService.logExport('bills', { format }, bills.length, 'user')
    return result
  }

  async exportReminders(reminders, format = 'excel', filename = null) {
    const columns = this.getReminderColumns()
    const ext = format === 'excel' ? '.xlsx' : '.csv'
    const finalFilename = filename || `到期提醒_${new Date().toISOString().split('T')[0]}${ext}`

    let result
    if (format === 'excel') {
      result = this.toExcel(reminders, columns, '到期提醒', finalFilename)
    } else {
      result = this.toCSV(reminders, columns, finalFilename)
    }

    await logService.logExport('reminders', { format }, reminders.length, 'user')
    return result
  }

  async exportCollections(collections, format = 'excel', filename = null) {
    const columns = this.getCollectionColumns()
    const ext = format === 'excel' ? '.xlsx' : '.csv'
    const finalFilename = filename || `托收清单_${new Date().toISOString().split('T')[0]}${ext}`

    let result
    if (format === 'excel') {
      result = this.toExcel(collections, columns, '托收清单', finalFilename)
    } else {
      result = this.toCSV(collections, columns, finalFilename)
    }

    await logService.logExport('collections', { format }, collections.length, 'user')
    return result
  }

  async exportDiscounts(discounts, format = 'excel', filename = null) {
    const columns = this.getDiscountColumns()
    const ext = format === 'excel' ? '.xlsx' : '.csv'
    const finalFilename = filename || `贴现清单_${new Date().toISOString().split('T')[0]}${ext}`

    let result
    if (format === 'excel') {
      result = this.toExcel(discounts, columns, '贴现清单', finalFilename)
    } else {
      result = this.toCSV(discounts, columns, finalFilename)
    }

    await logService.logExport('discounts', { format }, discounts.length, 'user')
    return result
  }

  async exportEndorses(endorses, format = 'excel', filename = null) {
    const columns = this.getEndorseColumns()
    const ext = format === 'excel' ? '.xlsx' : '.csv'
    const finalFilename = filename || `背书清单_${new Date().toISOString().split('T')[0]}${ext}`

    let result
    if (format === 'excel') {
      result = this.toExcel(endorses, columns, '背书清单', finalFilename)
    } else {
      result = this.toCSV(endorses, columns, finalFilename)
    }

    await logService.logExport('endorses', { format }, endorses.length, 'user')
    return result
  }

  exportToJSON(data, filename) {
    const jsonContent = JSON.stringify(data, null, 2)
    this.downloadFile(jsonContent, filename, 'application/json')
    return { success: true, count: Array.isArray(data) ? data.length : 1 }
  }

  importFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          resolve(data)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }
}

export const exportService = new ExportService()
export default exportService
