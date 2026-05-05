<template>
  <div class="dashboard-container">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
              <el-icon :size="32"><Cpu /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.total_turbines || 0 }}</div>
              <div class="stat-label">风机总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
              <el-icon :size="32"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value" style="color: #f56c6c">{{ highRiskCount }}</div>
              <div class="stat-label">高风险项目</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
              <el-icon :size="32"><Bell /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.active_alarms || 0 }}</div>
              <div class="stat-label">活跃告警</div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">
              <el-icon :size="32"><List /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics?.pending_work_orders || 0 }}</div>
              <div class="stat-label">待处理工单</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <span class="card-title">风险等级分布</span>
          </template>
          <div ref="riskChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <span class="card-title">风险统计</span>
          </template>
          <div class="risk-stats">
            <div class="risk-item" v-for="(count, level) in riskDistribution" :key="level">
              <el-tag :type="getRiskTagType(level)" size="large">
                {{ level }}: {{ count }}
              </el-tag>
            </div>
            <el-divider />
            <div class="risk-summary">
              <div class="summary-item">
                <span class="summary-label">总评估数</span>
                <span class="summary-value">{{ totalRisks }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">高风险占比</span>
                <span class="summary-value" style="color: #f56c6c">
                  {{ totalRisks > 0 ? ((highRiskCount / totalRisks) * 100).toFixed(1) : 0 }}%
                </span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">最近巡检</span>
              <el-button type="primary" link @click="$router.push('/inspections')">
                查看全部 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>
          <el-table :data="recentInspections" style="width: 100%">
            <el-table-column prop="turbine_id" label="风机编号" width="120" />
            <el-table-column prop="turbine_name" label="风机名称" />
            <el-table-column prop="inspection_date" label="巡检日期" width="180">
              <template #default="{ row }">
                {{ formatDate(row.inspection_date) }}
              </template>
            </el-table-column>
            <el-table-column prop="inspector" label="巡检人" width="100" />
          </el-table>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title" style="color: #f56c6c">高风险项目</span>
              <el-button type="danger" link @click="$router.push('/risk-assessments')">
                查看全部 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>
          <el-table :data="highRiskItems" style="width: 100%">
            <el-table-column prop="turbine_id" label="风机编号" width="100" />
            <el-table-column prop="blade_number" label="叶片" width="80">
              <template #default="{ row }">
                {{ row.blade_number }}号
              </template>
            </el-table-column>
            <el-table-column prop="risk_level" label="风险等级" width="100">
              <template #default="{ row }">
                <el-tag :type="getRiskTagType(row.risk_level)" size="small">
                  {{ row.risk_level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="detection_type" label="检测类型" />
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button type="primary" link @click="goToAssessmentDetail(row.id)">
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores'
import { storeToRefs } from 'pinia'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { getRiskLevelType } from '@/types'

const router = useRouter()
const dashboardStore = useDashboardStore()
const { statistics, loading, totalRisks, highRiskCount } = storeToRefs(dashboardStore)

const riskChartRef = ref<HTMLElement>()
let riskChart: echarts.ECharts | null = null

const riskDistribution = computed(() => {
  if (!statistics.value) {
    return { '严重': 0, '高': 0, '中': 0, '低': 0 }
  }
  return {
    '严重': statistics.value.critical_risks,
    '高': statistics.value.high_risks,
    '中': statistics.value.medium_risks,
    '低': statistics.value.low_risks,
  }
})

const recentInspections = computed(() => {
  return statistics.value?.recent_inspections || []
})

const highRiskItems = computed(() => {
  return statistics.value?.high_risk_items || []
})

const getRiskTagType = (level: string) => {
  const typeMap: Record<string, string> = {
    '严重': 'danger',
    '高': 'warning',
    '中': 'primary',
    '低': 'success',
  }
  return typeMap[level] || 'info'
}

const formatDate = (date: string | undefined) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const goToAssessmentDetail = (id: number) => {
  router.push(`/risk-assessments/${id}`)
}

const initChart = () => {
  if (!riskChartRef.value) return
  
  riskChart = echarts.init(riskChartRef.value)
  
  const updateChart = () => {
    if (!statistics.value) return
    
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center',
      },
      series: [
        {
          name: '风险等级',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            { value: statistics.value.critical_risks, name: '严重', itemStyle: { color: '#f56c6c' } },
            { value: statistics.value.high_risks, name: '高', itemStyle: { color: '#e6a23c' } },
            { value: statistics.value.medium_risks, name: '中', itemStyle: { color: '#409eff' } },
            { value: statistics.value.low_risks, name: '低', itemStyle: { color: '#67c23a' } },
          ],
        },
      ],
    }
    
    riskChart?.setOption(option)
  }
  
  updateChart()
  
  watch(statistics, () => {
    updateChart()
  }, { deep: true })
}

const handleResize = () => {
  riskChart?.resize()
}

onMounted(() => {
  dashboardStore.fetchStatistics()
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  riskChart?.dispose()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.dashboard-container {
  min-height: 100%;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  height: 100%;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
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
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.chart-card {
  height: 400px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  width: 100%;
  height: 320px;
}

.risk-stats {
  padding: 10px 0;
}

.risk-item {
  margin-bottom: 16px;
  text-align: center;
}

.risk-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 14px;
  color: #606266;
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
</style>
