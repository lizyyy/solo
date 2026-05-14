<template>
  <div class="dashboard">
    <h2>数据看板</h2>
    
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card total">
          <div class="stat-icon"><el-icon><DataLine /></el-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.total_sessions || 0 }}</div>
            <div class="stat-label">总会话数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card success">
          <div class="stat-icon"><el-icon><SuccessFilled /></el-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.success_count || 0 }}</div>
            <div class="stat-label">成功路径</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card blocked">
          <div class="stat-icon"><el-icon><CircleCloseFilled /></el-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.blocked_count || 0 }}</div>
            <div class="stat-label">拦截路径</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card review">
          <div class="stat-icon"><el-icon><WarningFilled /></el-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.review_count || 0 }}</div>
            <div class="stat-label">人工复核</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span>状态分布</span>
          </template>
          <div ref="pieChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span>成功率</span>
          </template>
          <div ref="barChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="quick-actions">
      <template #header>
        <span>快速操作</span>
      </template>
      <el-space wrap>
        <el-button type="primary" @click="$router.push('/session/new')">
          <el-icon><Plus /></el-icon> 新建调试会话
        </el-button>
        <el-button @click="testCallback('success')">
          <el-icon><Check /></el-icon> 模拟成功回调
        </el-button>
        <el-button type="warning" @click="testCallback('error')">
          <el-icon><Close /></el-icon> 模拟错误回调
        </el-button>
        <el-button type="danger" @click="testCallback('blocked')">
          <el-icon><Lock /></el-icon> 模拟拦截回调
        </el-button>
      </el-space>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { 
  DataLine, SuccessFilled, CircleCloseFilled, WarningFilled,
  Plus, Check, Close, Lock 
} from '@element-plus/icons-vue'

const stats = ref(null)
const pieChartRef = ref(null)
const barChartRef = ref(null)
let pieChart = null
let barChart = null

const loadStats = async () => {
  try {
    const res = await api.getStats()
    stats.value = res.data
    renderCharts()
  } catch (e) {
    ElMessage.error('加载统计数据失败')
  }
}

const renderCharts = () => {
  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value)
    pieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 'left' },
      series: [{
        type: 'pie',
        radius: '60%',
        data: [
          { value: stats.value.success_count, name: '成功', itemStyle: { color: '#67c23a' } },
          { value: stats.value.blocked_count, name: '拦截', itemStyle: { color: '#f56c6c' } },
          { value: stats.value.compensation_count, name: '补偿', itemStyle: { color: '#e6a23c' } },
          { value: stats.value.review_count, name: '复核', itemStyle: { color: '#909399' } },
          { value: stats.value.pending_count, name: '待处理', itemStyle: { color: '#409eff' } }
        ]
      }]
    })
  }

  if (barChartRef.value) {
    barChart = echarts.init(barChartRef.value)
    barChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['成功率 %'] },
      yAxis: { type: 'value', max: 100 },
      series: [{
        type: 'bar',
        data: [stats.value.success_rate || 0],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ])
        },
        label: { show: true, position: 'top' }
      }]
    })
  }
}

const testCallback = async (type) => {
  try {
    const state = `test_${Date.now()}`
    await api.createSession({ state })
    
    let url = `/api/v1/callback?state=${state}`
    if (type === 'success') {
      url += '&code=test_code_123'
    } else if (type === 'error') {
      url += '&error=access_denied&error_description=User denied access'
    } else if (type === 'blocked') {
      url += '&error=blocked&error_description=Access blocked by security policy'
    }
    
    await fetch(url)
    ElMessage.success('回调模拟成功')
    loadStats()
  } catch (e) {
    ElMessage.error('回调模拟失败')
  }
}

onMounted(() => {
  loadStats()
  window.addEventListener('resize', () => {
    pieChart?.resize()
    barChart?.resize()
  })
})

onUnmounted(() => {
  pieChart?.dispose()
  barChart?.dispose()
})
</script>

<style scoped>
.dashboard h2 {
  margin: 0 0 20px 0;
  color: #303133;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
}

.total .stat-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.success .stat-icon {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

.blocked .stat-icon {
  background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
}

.review .stat-icon {
  background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.charts-row {
  margin-bottom: 20px;
}

.chart-container {
  height: 300px;
}

.quick-actions {
  margin-bottom: 20px;
}
</style>
