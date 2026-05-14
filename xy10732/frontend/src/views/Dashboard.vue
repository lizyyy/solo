<template>
  <div class="dashboard-page">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon primary">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total_tasks || 0 }}</div>
              <div class="stat-label">任务总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon success">
              <el-icon><Check /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.execution_stats?.success || 0 }}</div>
              <div class="stat-label">成功执行</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon danger">
              <el-icon><Close /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.execution_stats?.failed || 0 }}</div>
              <div class="stat-label">执行失败</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon warning">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.execution_stats?.needs_review || 0 }}</div>
              <div class="stat-label">待复核</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card title="执行状态分布">
          <div ref="pieChartRef" style="height: 400px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card title="近30天执行趋势">
          <div ref="lineChartRef" style="height: 400px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card title="特殊状态统计">
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="sub-stat">
                <span class="sub-stat-label">错过执行</span>
                <span class="sub-stat-value warning">{{ stats.execution_stats?.missed || 0 }}</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="sub-stat">
                <span class="sub-stat-label">已补偿</span>
                <span class="sub-stat-value info">{{ stats.execution_stats?.compensated || 0 }}</span>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="sub-stat">
                <span class="sub-stat-label">已拦截</span>
                <span class="sub-stat-value danger">{{ stats.execution_stats?.blocked || 0 }}</span>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Check, Close, Warning } from '@element-plus/icons-vue'
import { statsApi } from '../api'
import * as echarts from 'echarts'

const stats = ref({})
const pieChartRef = ref(null)
const lineChartRef = ref(null)

let pieChart = null
let lineChart = null

const loadStats = async () => {
  try {
    const res = await statsApi.dashboard()
    stats.value = res.data
    nextTick(() => {
      initPieChart()
      initLineChart()
    })
  } catch (e) {
    ElMessage.error('加载统计数据失败')
  }
}

const initPieChart = () => {
  if (!pieChartRef.value) return
  
  if (pieChart) {
    pieChart.dispose()
  }
  
  pieChart = echarts.init(pieChartRef.value)
  
  const execStats = stats.value.execution_stats || {}
  const data = [
    { value: execStats.success || 0, name: '成功', itemStyle: { color: '#67c23a' } },
    { value: execStats.failed || 0, name: '失败', itemStyle: { color: '#f56c6c' } },
    { value: execStats.running || 0, name: '运行中', itemStyle: { color: '#409eff' } },
    { value: execStats.scheduled || 0, name: '待执行', itemStyle: { color: '#909399' } },
    { value: execStats.blocked || 0, name: '已拦截', itemStyle: { color: '#e6a23c' } },
    { value: execStats.compensated || 0, name: '已补偿', itemStyle: { color: '#909399' } }
  ].filter(item => item.value > 0)
  
  pieChart.setOption({
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '执行状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        data: data
      }
    ]
  })
}

const initLineChart = () => {
  if (!lineChartRef.value) return
  
  if (lineChart) {
    lineChart.dispose()
  }
  
  lineChart = echarts.init(lineChartRef.value)
  
  const dailyStats = stats.value.daily_stats || {}
  const dates = Object.keys(dailyStats).sort()
  
  const successData = dates.map(date => dailyStats[date].success || 0)
  const failedData = dates.map(date => dailyStats[date].failed || 0)
  
  lineChart.setOption({
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['成功', '失败']
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
      data: dates.map(d => d.slice(5))
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '成功',
        type: 'line',
        data: successData,
        smooth: true,
        itemStyle: { color: '#67c23a' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ])
        }
      },
      {
        name: '失败',
        type: 'line',
        data: failedData,
        smooth: true,
        itemStyle: { color: '#f56c6c' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 108, 108, 0.3)' },
            { offset: 1, color: 'rgba(245, 108, 108, 0.05)' }
          ])
        }
      }
    ]
  })
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stat-card {
  text-align: center;
}
.stat-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  color: white;
}
.stat-icon.primary {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}
.stat-icon.success {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}
.stat-icon.danger {
  background: linear-gradient(135deg, #f56c6c, #f78989);
}
.stat-icon.warning {
  background: linear-gradient(135deg, #e6a23c, #ebb563);
}
.stat-info {
  text-align: left;
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
.sub-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}
.sub-stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 10px;
}
.sub-stat-value {
  font-size: 28px;
  font-weight: bold;
}
.sub-stat-value.warning {
  color: #e6a23c;
}
.sub-stat-value.info {
  color: #909399;
}
.sub-stat-value.danger {
  color: #f56c6c;
}
</style>
