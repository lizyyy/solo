<template>
  <div class="dashboard-page">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #409EFF">
              <el-icon :size="30"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.total_resumes || 0 }}</div>
              <div class="stat-label">简历总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #67C23A">
              <el-icon :size="30"><SuccessFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.status_distribution?.['解析成功'] || 0 }}</div>
              <div class="stat-label">解析成功</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #E6A23C">
              <el-icon :size="30"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ getPendingReviewCount }}</div>
              <div class="stat-label">待复核</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #F56C6C">
              <el-icon :size="30"><Percent /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ (statistics?.avg_match_score || 0).toFixed(1) }}%</div>
              <div class="stat-label">平均匹配度</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header-title">状态分布</div>
          </template>
          <div ref="statusChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header-title">技能热度TOP10</div>
          </template>
          <div ref="skillsChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header-title">近30天简历上传趋势</div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useResumeStore } from '@/store/resume'
import * as echarts from 'echarts'

const resumeStore = useResumeStore()
const statistics = ref(null)

const statusChartRef = ref(null)
const skillsChartRef = ref(null)
const trendChartRef = ref(null)

let statusChart = null
let skillsChart = null
let trendChart = null

const getPendingReviewCount = computed(() => {
  const dist = statistics.value?.status_distribution || {}
  return (dist['解析拦截'] || 0) + (dist['解析补偿'] || 0) + (dist['待人工复核'] || 0)
})

const fetchStatistics = async () => {
  statistics.value = await resumeStore.fetchStatistics()
  renderCharts()
}

const renderCharts = () => {
  renderStatusChart()
  renderSkillsChart()
  renderTrendChart()
}

const renderStatusChart = () => {
  if (!statusChartRef.value || !statistics.value) return
  
  if (statusChart) statusChart.dispose()
  
  statusChart = echarts.init(statusChartRef.value)
  
  const dist = statistics.value.status_distribution || {}
  const data = Object.entries(dist).map(([name, value]) => ({ name, value }))
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
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
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: data
      }
    ]
  }
  
  statusChart.setOption(option)
}

const renderSkillsChart = () => {
  if (!skillsChartRef.value || !statistics.value?.top_skills) return
  
  if (skillsChart) skillsChart.dispose()
  
  skillsChart = echarts.init(skillsChartRef.value)
  
  const skills = statistics.value.top_skills.slice(0, 10).reverse()
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c}人'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value'
    },
    yAxis: {
      type: 'category',
      data: skills.map(s => s.skill || s)
    },
    series: [
      {
        type: 'bar',
        data: skills.map(s => s.count || 1),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#409EFF' },
            { offset: 1, color: '#67C23A' }
          ])
        }
      }
    ]
  }
  
  skillsChart.setOption(option)
}

const renderTrendChart = () => {
  if (!trendChartRef.value || !statistics.value?.daily_trend) return
  
  if (trendChart) trendChart.dispose()
  
  trendChart = echarts.init(trendChartRef.value)
  
  const trend = statistics.value.daily_trend
  
  const option = {
    tooltip: {
      trigger: 'axis'
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
      data: trend.map(t => t.date?.split('-').slice(1).join('/') || t)
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        type: 'line',
        smooth: true,
        data: trend.map(t => t.count || 0),
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.5)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        },
        lineStyle: {
          color: '#409EFF',
          width: 3
        },
        itemStyle: {
          color: '#409EFF'
        }
      }
    ]
  }
  
  trendChart.setOption(option)
}

const handleResize = () => {
  statusChart?.resize()
  skillsChart?.resize()
  trendChart?.resize()
}

onMounted(() => {
  fetchStatistics()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  statusChart?.dispose()
  skillsChart?.dispose()
  trendChart?.dispose()
})
</script>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.card-header-title {
  font-size: 16px;
  font-weight: 500;
}

.chart-container {
  width: 100%;
  height: 350px;
}
</style>
