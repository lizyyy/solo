<template>
  <div class="dashboard">
    <h2 class="page-title">数据概览</h2>
    
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card stat-blue">
          <div class="stat-icon">
            <el-icon size="32"><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.activePoints || 0 }}</div>
            <div class="stat-label">活跃埋点</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-green">
          <div class="stat-icon">
            <el-icon size="32"><SuccessFilled /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalEvents || 0 }}</div>
            <div class="stat-label">事件总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-orange">
          <div class="stat-icon">
            <el-icon size="32"><VideoPlay /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalSessions || 0 }}</div>
            <div class="stat-label">测试会话</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-red">
          <div class="stat-icon">
            <el-icon size="32"><Warning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalMissing || 0 }}</div>
            <div class="stat-label">漏报总数</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="14">
        <el-card class="chart-card">
          <template #header>
            <span class="card-title">漏报趋势（近7天）</span>
          </template>
          <div ref="trendChartRef" class="chart"></div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card class="chart-card">
          <template #header>
            <span class="card-title">页面漏报分布</span>
          </template>
          <div ref="pageChartRef" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">最近会话</span>
          <el-button type="primary" link @click="$router.push('/session')">查看全部</el-button>
        </div>
      </template>
      <el-table :data="recentSessions" stripe>
        <el-table-column prop="sessionId" label="会话ID" width="260" />
        <el-table-column prop="version" label="版本" width="120" />
        <el-table-column prop="operator" label="操作人员" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row.sessionId)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { statsAPI, sessionAPI } from '@/api'

const router = useRouter()
const stats = ref({})
const recentSessions = ref([])
const trendChartRef = ref(null)
const pageChartRef = ref(null)
let trendChart = null
let pageChart = null

const loadStats = async () => {
  const res = await statsAPI.getStats()
  stats.value = res.data
}

const loadTrend = async () => {
  const res = await statsAPI.getTrend(7)
  const data = res.data
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: data.map(d => d.date.split('-').slice(1).join('/')) },
    yAxis: { type: 'value' },
    series: [{
      data: data.map(d => d.count),
      type: 'line',
      smooth: true,
      areaStyle: { color: 'rgba(102, 126, 234, 0.3)' },
      lineStyle: { color: '#667eea' },
      itemStyle: { color: '#667eea' }
    }]
  })
}

const loadPageStats = async () => {
  const res = await statsAPI.getByPage()
  const data = res.data
  pageChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}: {c}' },
      data: data.map(d => ({ value: d.missing, name: d.page }))
    }]
  })
}

const loadSessions = async () => {
  const res = await sessionAPI.getSessions({ page: 1, pageSize: 5 })
  recentSessions.value = res.data.data || []
}

const getStatusType = (status) => {
  const map = { active: 'success', completed: 'info', cancelled: 'warning' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { active: '进行中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

const formatDate = (date) => new Date(date).toLocaleString('zh-CN')

const viewDetail = (id) => router.push(`/session/${id}`)

onMounted(() => {
  trendChart = echarts.init(trendChartRef.value)
  pageChart = echarts.init(pageChartRef.value)
  loadStats()
  loadTrend()
  loadPageStats()
  loadSessions()
  window.addEventListener('resize', () => {
    trendChart.resize()
    pageChart.resize()
  })
})
</script>

<style scoped>
.dashboard { padding: 0; }
.page-title { font-size: 24px; margin-bottom: 24px; color: #303133; }
.stats-row { margin-bottom: 24px; }
.stat-card { border: none; border-radius: 12px; overflow: hidden; }
.stat-blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-green { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
.stat-orange { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.stat-red { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
.stat-card :deep(.el-card__body) { display: flex; align-items: center; padding: 24px; color: white; }
.stat-icon { margin-right: 20px; opacity: 0.9; }
.stat-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
.stat-label { font-size: 14px; opacity: 0.9; }
.charts-row { margin-bottom: 24px; }
.chart-card { border-radius: 12px; }
.chart { height: 300px; width: 100%; }
.card-title { font-weight: 600; font-size: 16px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.table-card { border-radius: 12px; }
</style>
