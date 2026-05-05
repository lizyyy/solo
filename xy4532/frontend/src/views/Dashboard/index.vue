<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <el-col :span="6" v-for="(stat, index) in statistics" :key="index">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-left">
              <el-icon size="40" :color="stat.color">
                <component :is="stat.icon" />
              </el-icon>
            </div>
            <div class="stat-right">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
          <div class="stat-footer" v-if="stat.trend">
            <el-icon size="12" :color="stat.trend > 0 ? '#67c23a' : '#f56c6c'">
              <component :is="stat.trend > 0 ? 'CaretTop' : 'CaretBottom'" />
            </el-icon>
            <span :style="{ color: stat.trend > 0 ? '#67c23a' : '#f56c6c' }">
              {{ Math.abs(stat.trend) }}% 较昨日
            </span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">风险评估趋势</span>
              <el-radio-group v-model="chartPeriod" size="small">
                <el-radio-button label="day">今日</el-radio-button>
                <el-radio-button label="week">本周</el-radio-button>
                <el-radio-button label="month">本月</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <span class="card-title">风险等级分布</span>
          </template>
          <div ref="pieChartRef" class="chart-container" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">待处理高风险</span>
              <el-button type="primary" link @click="$router.push('/risk-assessments')">
                查看全部
              </el-button>
            </div>
          </template>
          
          <el-table :data="highRiskList" style="width: 100%" size="small">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="risk_level" label="风险等级" width="100">
              <template #default="{ row }">
                <el-tag :type="getRiskTagType(row.risk_level)" size="small">
                  {{ row.risk_level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="turbine" label="风机" min-width="120" />
            <el-table-column prop="blade" label="叶片" width="80" />
            <el-table-column prop="time" label="时间" width="150">
              <template #default="{ row }">
                {{ formatDate(row.time) }}
              </template>
            </el-table-column>
          </el-table>
          
          <el-empty v-if="highRiskList.length === 0" description="暂无高风险" :image-size="80" />
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">活跃告警</span>
              <el-button type="primary" link @click="$router.push('/alarms')">
                查看全部
              </el-button>
            </div>
          </template>
          
          <el-table :data="activeAlarms" style="width: 100%" size="small">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="severity" label="严重程度" width="80">
              <template #default="{ row }">
                <el-tag :type="getSeverityTagType(row.severity)" size="small">
                  {{ row.severity }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="alarm_name" label="告警名称" min-width="120" />
            <el-table-column prop="turbine" label="风机" min-width="100" />
            <el-table-column prop="time" label="发生时间" width="150">
              <template #default="{ row }">
                {{ formatDate(row.time) }}
              </template>
            </el-table-column>
          </el-table>
          
          <el-empty v-if="activeAlarms.length === 0" description="暂无活跃告警" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">快速操作</span>
            </div>
          </template>
          
          <el-row :gutter="20">
            <el-col :span="6">
              <div class="quick-action" @click="$router.push('/import')">
                <el-icon size="32" color="#409eff"><Upload /></el-icon>
                <div class="action-title">导入数据</div>
                <div class="action-desc">导入照片、告警、工单</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="quick-action" @click="$router.push('/risk-assessments')">
                <el-icon size="32" color="#e6a23c"><Warning /></el-icon>
                <div class="action-title">风险评估</div>
                <div class="action-desc">查看和处理风险记录</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="quick-action" @click="$router.push('/export')">
                <el-icon size="32" color="#67c23a"><Download /></el-icon>
                <div class="action-title">导出报告</div>
                <div class="action-desc">导出复核单和JSON明细</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="quick-action" @click="$router.push('/turbines')">
                <el-icon size="32" color="#909399"><OfficeBuilding /></el-icon>
                <div class="action-title">风机管理</div>
                <div class="action-desc">查看和管理风机信息</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { 
  WindPower, 
  Warning, 
  Bell, 
  Document, 
  Upload, 
  Download, 
  OfficeBuilding,
  CaretTop,
  CaretBottom
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const router = useRouter()

const trendChartRef = ref<HTMLElement>()
const pieChartRef = ref<HTMLElement>()
const chartPeriod = ref('week')

const statistics = ref([
  { label: '风机总数', value: 128, color: '#409eff', icon: 'WindPower', trend: 0 },
  { label: '风险评估', value: 856, color: '#e6a23c', icon: 'Warning', trend: 12.5 },
  { label: '活跃告警', value: 15, color: '#f56c6c', icon: 'Bell', trend: -5.3 },
  { label: '处理工单', value: 42, color: '#67c23a', icon: 'Document', trend: 8.7 },
])

const highRiskList = ref([
  { id: 1, risk_level: '严重', turbine: 'WT-015', blade: '1号', time: '2024-01-15 14:30:00' },
  { id: 2, risk_level: '高', turbine: 'WT-023', blade: '2号', time: '2024-01-15 12:15:00' },
  { id: 3, risk_level: '高', turbine: 'WT-008', blade: '3号', time: '2024-01-15 10:45:00' },
])

const activeAlarms = ref([
  { id: 1, severity: '严重', alarm_name: '叶片振动异常', turbine: 'WT-015', time: '2024-01-15 14:30:00' },
  { id: 2, severity: '高', alarm_name: '温度超限', turbine: 'WT-023', time: '2024-01-15 13:20:00' },
])

const formatDate = (date: string) => {
  return dayjs(date).format('MM-DD HH:mm')
}

const getRiskTagType = (level?: string) => {
  const typeMap: Record<string, string> = {
    '严重': 'danger',
    '高': 'warning',
    '中': 'primary',
    '低': 'success',
  }
  return typeMap[level || ''] || 'info'
}

const getSeverityTagType = (severity?: string) => {
  const typeMap: Record<string, string> = {
    '严重': 'danger',
    '高': 'warning',
    '中': 'primary',
    '低': 'success',
  }
  return typeMap[severity || ''] || 'info'
}

const initTrendChart = () => {
  if (!trendChartRef.value) return
  
  const chart = echarts.init(trendChartRef.value)
  
  const dates = []
  const now = dayjs()
  for (let i = 6; i >= 0; i--) {
    dates.push(now.subtract(i, 'day').format('MM-DD'))
  }
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    legend: {
      data: ['严重', '高', '中', '低'],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '严重',
        type: 'line',
        stack: 'Total',
        smooth: true,
        data: [2, 1, 3, 2, 1, 0, 1],
        areaStyle: { color: 'rgba(245, 108, 108, 0.3)' },
        lineStyle: { color: '#f56c6c' },
        itemStyle: { color: '#f56c6c' },
      },
      {
        name: '高',
        type: 'line',
        stack: 'Total',
        smooth: true,
        data: [5, 7, 4, 6, 8, 5, 7],
        areaStyle: { color: 'rgba(230, 162, 60, 0.3)' },
        lineStyle: { color: '#e6a23c' },
        itemStyle: { color: '#e6a23c' },
      },
      {
        name: '中',
        type: 'line',
        stack: 'Total',
        smooth: true,
        data: [12, 10, 15, 11, 9, 14, 12],
        areaStyle: { color: 'rgba(64, 158, 255, 0.3)' },
        lineStyle: { color: '#409eff' },
        itemStyle: { color: '#409eff' },
      },
      {
        name: '低',
        type: 'line',
        stack: 'Total',
        smooth: true,
        data: [20, 18, 22, 19, 21, 17, 20],
        areaStyle: { color: 'rgba(103, 194, 58, 0.3)' },
        lineStyle: { color: '#67c23a' },
        itemStyle: { color: '#67c23a' },
      },
    ],
  }
  
  chart.setOption(option)
  
  const handleResize = () => {
    chart.resize()
  }
  window.addEventListener('resize', handleResize)
  
  return () => {
    window.removeEventListener('resize', handleResize)
    chart.dispose()
  }
}

const initPieChart = () => {
  if (!pieChartRef.value) return
  
  const chart = echarts.init(pieChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'outside',
        },
        data: [
          { value: 15, name: '严重', itemStyle: { color: '#f56c6c' } },
          { value: 42, name: '高', itemStyle: { color: '#e6a23c' } },
          { value: 98, name: '中', itemStyle: { color: '#409eff' } },
          { value: 156, name: '低', itemStyle: { color: '#67c23a' } },
        ],
      },
    ],
  }
  
  chart.setOption(option)
  
  const handleResize = () => {
    chart.resize()
  }
  window.addEventListener('resize', handleResize)
  
  return () => {
    window.removeEventListener('resize', handleResize)
    chart.dispose()
  }
}

onMounted(() => {
  nextTick(() => {
    initTrendChart()
    initPieChart()
  })
})
</script>

<style scoped>
.dashboard-container {
  min-height: 100%;
  padding: 20px;
}

.stat-card {
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-left {
  flex-shrink: 0;
}

.stat-right {
  margin-left: 16px;
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.stat-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f5f7fa;
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-container {
  height: 300px;
}

.quick-action {
  text-align: center;
  padding: 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid #e4e7ed;
}

.quick-action:hover {
  background: #ecf5ff;
  border-color: #409eff;
}

.action-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-top: 12px;
}

.action-desc {
  font-size: 13px;
  color: #909399;
  margin-top: 6px;
}
</style>
