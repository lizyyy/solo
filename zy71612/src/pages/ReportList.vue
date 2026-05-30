<template>
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">报表中心</div>
        <div class="flex gap-8">
          <button class="btn btn-primary" @click="generateMatureReport">生成到期报告</button>
        </div>
      </div>

      <div class="mb-16">
        <div class="filter-bar">
          <div class="filter-item">
            <label>报表类型:</label>
            <select v-model="reportType">
              <option value="">全部</option>
              <option value="mature_daily">到期日报</option>
              <option value="collection">托收报表</option>
              <option value="discount">贴现报表</option>
              <option value="endorse_chain">背书链报表</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="reports.length === 0" class="empty-state">
        <div class="icon">📈</div>
        <p>暂无报表数据</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
          <tr>
            <th>报表类型</th>
            <th>报表日期</th>
            <th>数据摘要</th>
            <th>幂等Key</th>
            <th>生成时间</th>
            <th>操作</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in filteredReports" :key="item.id">
            <td>
              <span class="badge badge-primary">
                {{ getReportTypeText(item.reportType) }}
              </span>
            </td>
            <td>{{ item.reportDate || item.startDate + ' ~ ' + item.endDate }}</td>
            <td>
              <div v-if="item.summary">
                <span v-if="item.summary.totalBills">{{ item.summary.totalBills }} 笔票据</span>
                <span v-if="item.summary.totalAmount">，¥{{ formatAmount(item.summary.totalAmount) }}</span>
              </div>
            </td>
            <td class="text-muted" style="font-size: 12px;">{{ item.idemKey }}</td>
            <td>{{ item.createdAt }}</td>
            <td>
              <button class="btn btn-sm" @click="viewReport(item)">查看</button>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import reportService from '../services/ReportService.js'

const reports = ref([])
const reportType = ref('')
const loading = ref(false)

const filteredReports = computed(() => {
  if (!reportType.value) return reports.value
  return reports.value.filter(r => r.reportType === reportType.value)
})

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getReportTypeText = (type) => {
  const map = {
    mature_daily: '到期日报',
    collection: '托收报表',
    discount: '贴现报表',
    endorse_chain: '背书链报表'
  }
  return map[type] || type
}

const loadReports = async () => {
  loading.value = true
  try {
    reports.value = await reportService.getAllReports()
  } catch (error) {
    console.error('加载报表列表失败:', error)
  } finally {
    loading.value = false
  }
}

const generateMatureReport = async () => {
  try {
    const result = await reportService.generateMatureReport()
    if (result.cached) {
      alert('今日报告已存在，返回缓存数据')
    } else {
      alert('报告生成成功')
    }
    loadReports()
  } catch (error) {
    console.error('生成报告失败:', error)
    alert('生成报告失败')
  }
}

const viewReport = (item) => {
  console.log('查看报表:', item)
  alert('查看详情功能开发中')
}

onMounted(() => {
  loadReports()
})
</script>
