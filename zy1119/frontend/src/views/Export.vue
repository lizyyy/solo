<template>
  <div class="export">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>报表导出</h2>
    </div>

    <div class="row mb-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <form>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">开始日期</label>
                  <input type="date" class="form-control" v-model="filters.date_from">
                </div>
                <div class="col-md-6">
                  <label class="form-label">结束日期</label>
                  <input type="date" class="form-control" v-model="filters.date_to">
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0">📋 自提清单</h5>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">
              导出指定日期的自提订单清单，包含客户信息、商品明细和自提码。
            </p>
            <div class="mb-3">
              <label class="form-label">选择日期</label>
              <input type="date" class="form-control" v-model="pickupDate">
            </div>
            <div class="d-grid">
              <button 
                class="btn btn-primary" 
                @click="exportPickupList"
                :disabled="exporting.pickup"
              >
                {{ exporting.pickup ? '导出中...' : '导出自提清单' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header bg-danger text-white">
            <h5 class="mb-0">❌ 缺货报告</h5>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">
              导出指定时间段内的缺货异常报告，包含缺货商品、影响订单和处理建议。
            </p>
            <div class="mb-3">
              <label class="form-label">状态筛选</label>
              <select class="form-select" v-model="shortageStatus">
                <option value="">全部</option>
                <option value="open">待处理</option>
                <option value="resolved">已解决</option>
              </select>
            </div>
            <div class="d-grid">
              <button 
                class="btn btn-danger" 
                @click="exportShortageReport"
                :disabled="exporting.shortage"
              >
                {{ exporting.shortage ? '导出中...' : '导出缺货报告' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header bg-warning text-dark">
            <h5 class="mb-0">💰 退款报告</h5>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">
              导出指定时间段内的退款记录报告，包含退款金额、原因和处理结果。
            </p>
            <div class="mb-3">
              <label class="form-label">&nbsp;</label>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" v-model="includePartialRefund" id="partialRefund">
                <label class="form-check-label" for="partialRefund">
                  包含部分退款
                </label>
              </div>
            </div>
            <div class="d-grid">
              <button 
                class="btn btn-warning" 
                @click="exportRefundReport"
                :disabled="exporting.refund"
              >
                {{ exporting.refund ? '导出中...' : '导出退款报告' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header bg-info text-white">
            <h5 class="mb-0">📊 每日综合报告</h5>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">
              导出指定日期的综合运营报告，包含订单统计、库存预警和异常汇总。
            </p>
            <div class="mb-3">
              <label class="form-label">选择日期</label>
              <input type="date" class="form-control" v-model="dailyReportDate">
            </div>
            <div class="d-grid">
              <button 
                class="btn btn-info" 
                @click="exportDailyReport"
                :disabled="exporting.daily"
              >
                {{ exporting.daily ? '导出中...' : '导出每日报告' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header bg-secondary text-white">
            <h5 class="mb-0">⏰ 逾期未取提醒</h5>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">
              导出当前所有逾期未取的订单列表，用于通知客户或准备处理。
            </p>
            <div class="mb-3">
              <label class="form-label">逾期天数</label>
              <input type="number" class="form-control" v-model.number="overdueDays" min="1" placeholder="1">
              <small class="text-muted">超过自提日期多少天算逾期</small>
            </div>
            <div class="d-grid">
              <button 
                class="btn btn-secondary" 
                @click="exportOverdueReport"
                :disabled="exporting.overdue"
              >
                {{ exporting.overdue ? '导出中...' : '导出逾期列表' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-header bg-success text-white">
            <h5 class="mb-0">📈 临期商品预警</h5>
          </div>
          <div class="card-body">
            <p class="text-muted mb-3">
              导出当前临期商品列表，用于优先安排发货或促销处理。
            </p>
            <div class="mb-3">
              <label class="form-label">临期阈值(天)</label>
              <select class="form-select" v-model="expiryThreshold">
                <option value="3">3天内</option>
                <option value="7">7天内</option>
                <option value="14">14天内</option>
                <option value="30">30天内</option>
              </select>
            </div>
            <div class="d-grid">
              <button 
                class="btn btn-success" 
                @click="exportExpiryReport"
                :disabled="exporting.expiry"
              >
                {{ exporting.expiry ? '导出中...' : '导出临期列表' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="exportError" class="alert alert-danger mt-4">
      {{ exportError }}
    </div>

    <div v-if="exportSuccess" class="alert alert-success mt-4">
      {{ exportSuccess }}
    </div>
  </div>
</template>

<script>
import { exportApi } from '../api'
import dayjs from 'dayjs'

export default {
  name: 'Export',
  data() {
    const today = dayjs().format('YYYY-MM-DD')
    return {
      filters: {
        date_from: today,
        date_to: today
      },
      pickupDate: today,
      dailyReportDate: today,
      shortageStatus: '',
      includePartialRefund: true,
      overdueDays: 1,
      expiryThreshold: 7,
      exporting: {
        pickup: false,
        shortage: false,
        refund: false,
        daily: false,
        overdue: false,
        expiry: false
      },
      exportError: '',
      exportSuccess: ''
    }
  },
  methods: {
    async exportPickupList() {
      this.exportError = ''
      this.exportSuccess = ''
      this.exporting.pickup = true

      try {
        const response = await exportApi.exportPickupList(this.pickupDate)
        if (response.data.success) {
          this.exportSuccess = `自提清单导出成功！共 ${response.data.data?.count || 0} 条记录`
          this.downloadFile(response.data.data, 'pickup_list')
        } else {
          this.exportError = response.data.message || '导出失败'
        }
      } catch (error) {
        console.error('导出失败:', error)
        this.exportError = error.response?.data?.message || '导出失败，请重试'
      } finally {
        this.exporting.pickup = false
      }
    },
    async exportShortageReport() {
      this.exportError = ''
      this.exportSuccess = ''
      this.exporting.shortage = true

      try {
        const params = {
          date_from: this.filters.date_from,
          date_to: this.filters.date_to
        }
        if (this.shortageStatus) params.status = this.shortageStatus

        const response = await exportApi.exportShortageReport(params)
        if (response.data.success) {
          this.exportSuccess = `缺货报告导出成功！共 ${response.data.data?.count || 0} 条记录`
          this.downloadFile(response.data.data, 'shortage_report')
        } else {
          this.exportError = response.data.message || '导出失败'
        }
      } catch (error) {
        console.error('导出失败:', error)
        this.exportError = error.response?.data?.message || '导出失败，请重试'
      } finally {
        this.exporting.shortage = false
      }
    },
    async exportRefundReport() {
      this.exportError = ''
      this.exportSuccess = ''
      this.exporting.refund = true

      try {
        const params = {
          date_from: this.filters.date_from,
          date_to: this.filters.date_to,
          include_partial: this.includePartialRefund
        }

        const response = await exportApi.exportRefundReport(params)
        if (response.data.success) {
          this.exportSuccess = `退款报告导出成功！共 ${response.data.data?.count || 0} 条记录`
          this.downloadFile(response.data.data, 'refund_report')
        } else {
          this.exportError = response.data.message || '导出失败'
        }
      } catch (error) {
        console.error('导出失败:', error)
        this.exportError = error.response?.data?.message || '导出失败，请重试'
      } finally {
        this.exporting.refund = false
      }
    },
    async exportDailyReport() {
      this.exportError = ''
      this.exportSuccess = ''
      this.exporting.daily = true

      try {
        const response = await exportApi.exportDailyReport(this.dailyReportDate)
        if (response.data.success) {
          this.exportSuccess = `每日综合报告导出成功！`
          this.downloadFile(response.data.data, 'daily_report')
        } else {
          this.exportError = response.data.message || '导出失败'
        }
      } catch (error) {
        console.error('导出失败:', error)
        this.exportError = error.response?.data?.message || '导出失败，请重试'
      } finally {
        this.exporting.daily = false
      }
    },
    async exportOverdueReport() {
      this.exportError = ''
      this.exportSuccess = ''
      this.exporting.overdue = true

      try {
        const params = {
          days: this.overdueDays
        }

        const response = await exportApi.exportOverdueReport(params)
        if (response.data.success) {
          this.exportSuccess = `逾期未取报告导出成功！共 ${response.data.data?.count || 0} 条记录`
          this.downloadFile(response.data.data, 'overdue_report')
        } else {
          this.exportError = response.data.message || '导出失败'
        }
      } catch (error) {
        console.error('导出失败:', error)
        this.exportError = error.response?.data?.message || '导出失败，请重试'
      } finally {
        this.exporting.overdue = false
      }
    },
    async exportExpiryReport() {
      this.exportError = ''
      this.exportSuccess = ''
      this.exporting.expiry = true

      try {
        const params = {
          days: this.expiryThreshold
        }

        const response = await exportApi.exportExpiryReport(params)
        if (response.data.success) {
          this.exportSuccess = `临期商品预警导出成功！共 ${response.data.data?.count || 0} 条记录`
          this.downloadFile(response.data.data, 'expiry_report')
        } else {
          this.exportError = response.data.message || '导出失败'
        }
      } catch (error) {
        console.error('导出失败:', error)
        this.exportError = error.response?.data?.message || '导出失败，请重试'
      } finally {
        this.exporting.expiry = false
      }
    },
    downloadFile(data, filenamePrefix) {
      if (!data || !data.data) return

      try {
        const wb = {
          SheetNames: data.sheetNames || ['Sheet1'],
          Sheets: {}
        }

        if (data.sheetNames && data.sheets) {
          data.sheetNames.forEach((name, i) => {
            if (data.sheets[name]) {
              wb.Sheets[name] = this.jsonToSheet(data.sheets[name])
            }
          })
        } else if (data.data) {
          wb.Sheets['Sheet1'] = this.jsonToSheet(data.data)
        }

        const csvContent = this.jsonToCsv(data.data || [])
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `${filenamePrefix}_${dayjs().format('YYYYMMDD')}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('下载文件失败:', error)
        console.log('导出数据:', data)
        alert('文件已准备，请查看控制台获取数据')
      }
    },
    jsonToSheet(jsonData) {
      if (!jsonData || jsonData.length === 0) return []
      return jsonData
    },
    jsonToCsv(jsonData) {
      if (!jsonData || jsonData.length === 0) return ''

      const headers = Object.keys(jsonData[0])
      const headerRow = headers.join(',')
      
      const dataRows = jsonData.map(row => {
        return headers.map(header => {
          let value = row[header]
          if (value === null || value === undefined) return ''
          value = String(value)
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = '"' + value.replace(/"/g, '""') + '"'
          }
          return value
        }).join(',')
      })

      return [headerRow, ...dataRows].join('\n')
    }
  }
}
</script>
