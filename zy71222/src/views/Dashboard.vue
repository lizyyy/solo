<template>
  <div class="dashboard">
    <div class="page-title">数据概览</div>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">授信总额度</div>
          <div class="stats-value primary">{{ formatMoney(creditStore.totalCreditLimit) }}</div>
          <div class="stats-trend">总授信额度</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">已使用额度</div>
          <div class="stats-value warning">{{ formatMoney(creditStore.usedCredit) }}</div>
          <div class="stats-trend">使用率 {{ creditStore.creditUtilizationRate }}%</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">已回补额度</div>
          <div class="stats-value success">{{ formatMoney(totalRedeemedAmount) }}</div>
          <div class="stats-trend down">红冲回补 {{ redemptionStore.completedRedemptions }} 笔</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">异常待处理</div>
          <div class="stats-value danger">{{ redemptionStore.anomalies.length }}</div>
          <div class="stats-trend up">需要关注</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="16">
        <div class="page-container">
          <div class="chart-title">额度使用趋势</div>
          <div ref="trendChart" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="page-container">
          <div class="chart-title">红冲状态分布</div>
          <div ref="statusChart" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="anomaly-row">
      <el-col :span="24">
        <div class="page-container">
          <div class="chart-title">
            <span>异常预警</span>
            <el-tag type="danger" size="small" style="margin-left: 10px;">{{ redemptionStore.anomalies.length }} 条异常</el-tag>
          </div>
          <el-table :data="redemptionStore.anomalies" stripe style="width: 100%" @row-click="handleAnomalyClick">
            <el-table-column prop="redemptionNo" label="红冲单号" width="140">
              <template #default="{ row }">
                <el-link type="primary" @click.stop="handleViewDetail(row)">{{ row.redemptionNo }}</el-link>
              </template>
            </el-table-column>
            <el-table-column prop="invoiceNo" label="发票号码" width="180" />
            <el-table-column prop="buyerName" label="买方名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="amount" label="红冲金额" width="120">
              <template #default="{ row }">
                {{ formatMoney(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column label="异常类型" width="200">
              <template #default="{ row }">
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <el-tag 
                    v-for="anomaly in row.anomalies" 
                    :key="anomaly.type"
                    :type="getAnomalyTagType(anomaly.type)"
                    size="small"
                    @click.stop="showAnomalyDetail(anomaly)"
                    style="cursor: pointer;"
                  >
                    {{ getAnomalyLabel(anomaly.type) }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleViewDetail(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="detailDialogVisible" title="红冲申请详情" width="900px">
      <RedemptionDetail v-if="currentRedemption" :redemption="currentRedemption" />
    </el-dialog>

    <el-dialog v-model="anomalyDialogVisible" title="异常详情" width="600px">
      <div v-if="currentAnomaly">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="异常类型">
            <el-tag :type="getAnomalyTagType(currentAnomaly.type)">
              {{ getAnomalyLabel(currentAnomaly.type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="判断理由">
            <div class="reason-box">{{ currentAnomaly.reason }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="证据依据">
            <div style="color: #606266; font-size: 14px;">{{ currentAnomaly.evidence }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useCreditStore } from '@/stores/credit'
import { useRedemptionStore } from '@/stores/redemption'
import { REDEMPTION_STATUS_LABEL, ANOMALY_LABELS } from '@/stores/redemption'
import * as echarts from 'echarts'
import RedemptionDetail from '@/components/RedemptionDetail.vue'
import { ElMessage } from 'element-plus'

const creditStore = useCreditStore()
const redemptionStore = useRedemptionStore()

const trendChart = ref(null)
const statusChart = ref(null)
const detailDialogVisible = ref(false)
const anomalyDialogVisible = ref(false)
const currentRedemption = ref(null)
const currentAnomaly = ref(null)

const totalRedeemedAmount = computed(() => {
  return redemptionStore.redemptions
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + r.amount, 0)
})

function formatMoney(value) {
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getStatusLabel(status) {
  return REDEMPTION_STATUS_LABEL[status] || status
}

function getStatusTagType(status) {
  const typeMap = {
    draft: 'info',
    submitted: 'warning',
    buyer_confirmed: 'primary',
    processing: 'primary',
    completed: 'success',
    rejected: 'danger'
  }
  return typeMap[status] || 'info'
}

function getAnomalyLabel(type) {
  return ANOMALY_LABELS[type] || type
}

function getAnomalyTagType(type) {
  const typeMap = {
    duplicate: 'danger',
    early_release: 'warning',
    unconfirmed: 'danger'
  }
  return typeMap[type] || 'warning'
}

function handleAnomalyClick(row) {
}

function handleViewDetail(row) {
  currentRedemption.value = row
  detailDialogVisible.value = true
}

function showAnomalyDetail(anomaly) {
  currentAnomaly.value = anomaly
  anomalyDialogVisible.value = true
}

function initTrendChart() {
  if (!trendChart.value) return
  
  const chart = echarts.init(trendChart.value)
  
  const creditHistory = creditStore.creditHistory
  const sortedHistory = [...creditHistory].sort((a, b) => new Date(a.operateTime) - new Date(b.operateTime))
  
  let runningTotal = 0
  const dates = []
  const values = []
  
  sortedHistory.forEach(item => {
    if (item.type === 'occupy') {
      runningTotal += item.amount
    } else {
      runningTotal -= item.amount
    }
    dates.push(new Date(item.operateTime).toLocaleDateString('zh-CN'))
    values.push(runningTotal)
  })

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        return `${params[0].axisValue}<br/>已使用额度: ¥${params[0].value.toLocaleString()}`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => '¥' + (value / 10000).toFixed(0) + '万'
      }
    },
    series: [{
      name: '已使用额度',
      type: 'line',
      smooth: true,
      data: values,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
        ])
      },
      lineStyle: {
        color: '#409eff',
        width: 2
      },
      itemStyle: {
        color: '#409eff'
      }
    }]
  }

  chart.setOption(option)
  
  window.addEventListener('resize', () => chart.resize())
}

function initStatusChart() {
  if (!statusChart.value) return
  
  const chart = echarts.init(statusChart.value)
  
  const statusCounts = {}
  redemptionStore.redemptions.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
  })

  const data = Object.entries(statusCounts).map(([status, count]) => ({
    name: REDEMPTION_STATUS_LABEL[status] || status,
    value: count
  }))

  const colors = {
    '草稿': '#909399',
    '已提交': '#e6a23c',
    '买方已确认': '#409eff',
    '处理中': '#409eff',
    '已完成': '#67c23a',
    '已拒绝': '#f56c6c'
  }

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: false
      },
      data: data.map(item => ({
        ...item,
        itemStyle: { color: colors[item.name] }
      }))
    }]
  }

  chart.setOption(option)
  
  window.addEventListener('resize', () => chart.resize())
}

onMounted(() => {
  setTimeout(() => {
    initTrendChart()
    initStatusChart()
  }, 100)
})
</script>

<style lang="scss" scoped>
.dashboard {
  .stats-row {
    margin-bottom: 20px;
  }

  .charts-row {
    margin-bottom: 20px;
  }

  .chart-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 16px;
  }

  .chart-container {
    height: 300px;
    width: 100%;
  }

  .anomaly-row {
    .chart-title {
      display: flex;
      align-items: center;
    }
  }

  .reason-box {
    background: #f8f9fa;
    border-left: 4px solid #409eff;
    padding: 12px 16px;
    border-radius: 0 4px 4px 0;
    font-size: 14px;
    color: #606266;
  }
}
</style>
