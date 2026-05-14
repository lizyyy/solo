<template>
  <div class="dashboard">
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon size="40" color="#409EFF"><Document /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.total_templates || 0 }}</div>
              <div class="stat-label">模板总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon size="40" color="#67C23A"><Collection /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.total_batches || 0 }}</div>
              <div class="stat-label">批次总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon size="40" color="#E6A23C"><Message /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.total_emails_sent || 0 }}</div>
              <div class="stat-label">发送邮件数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon size="40" color="#F56C6C"><SuccessFilled /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.success_rate || 0 }}%</div>
              <div class="stat-label">发送成功率</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>待办事项</span>
          </template>
          <el-empty v-if="statistics.pending_approvals === 0 && statistics.batches_in_progress === 0" />
          <div v-else>
            <el-alert
              v-if="statistics.pending_approvals > 0"
              :title="`有 ${statistics.pending_approvals} 条审批待处理`"
              type="warning"
              style="margin-bottom: 10px"
              show-icon
            >
              <template #default>
                <el-button type="text" @click="$router.push('/approvals')">前往审批</el-button>
              </template>
            </el-alert>
            <el-alert
              v-if="statistics.batches_in_progress > 0"
              :title="`有 ${statistics.batches_in_progress} 个批次正在进行`"
              type="info"
              show-icon
            >
              <template #default>
                <el-button type="text" @click="$router.push('/batches')">查看批次</el-button>
              </template>
            </el-alert>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>月度趋势</span>
          </template>
          <div ref="chartRef" style="height: 200px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <span>快捷操作</span>
          </template>
          <el-space wrap>
            <el-button type="primary" @click="$router.push('/templates')">
              <el-icon><DocumentAdd /></el-icon>
              管理模板
            </el-button>
            <el-button type="success" @click="$router.push('/batches')">
              <el-icon><Plus /></el-icon>
              创建批次
            </el-button>
            <el-button type="warning" @click="$router.push('/approvals')">
              <el-icon><Check /></el-icon>
              处理审批
            </el-button>
          </el-space>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { statisticsApi } from '@/api'

const router = useRouter()
const statistics = ref({})
const chartRef = ref(null)
let chart = null

const loadStatistics = async () => {
  try {
    const res = await statisticsApi.getStatistics()
    statistics.value = res.data
    renderChart()
  } catch (error) {
    console.error('加载统计数据失败', error)
  }
}

const renderChart = () => {
  if (!chartRef.value) return
  
  chart = echarts.init(chartRef.value)
  
  const monthlyData = statistics.value.monthly_stats || {}
  const months = Object.keys(monthlyData).sort().slice(-6)
  const values = months.map(m => monthlyData[m])
  
  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: months
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: values,
      type: 'line',
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.5)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.1)' }
        ])
      }
    }]
  }
  
  chart.setOption(option)
}

onMounted(() => {
  loadStatistics()
  window.addEventListener('resize', () => chart?.resize())
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 20px;
}
.stat-info {
  flex: 1;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}
.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}
</style>
