<template>
  <div>
    <div class="page-header">
      <div class="page-title">统计分析</div>
      <div>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          style="width: 300px;"
        />
        <el-button type="primary" @click="loadData" style="margin-left: 12px;">
          <el-icon><Search /></el-icon>
          查询
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom: 20px;">
      <el-col :span="6">
        <div class="stat-card" style="background: #ecf5ff;">
          <div class="stat-value" style="color: #409EFF;">{{ overview.total }}</div>
          <div class="stat-label">总转诊数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: #fdf6ec;">
          <div class="stat-value" style="color: #E6A23C;">{{ overview.pending }}</div>
          <div class="stat-label">待接诊</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: #f0f9eb;">
          <div class="stat-value" style="color: #67C23A;">{{ overview.closed }}</div>
          <div class="stat-label">已闭环</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card" style="background: #f4f4f5;">
          <div class="stat-value" style="color: #909399;">{{ overview.closure_rate }}%</div>
          <div class="stat-label">闭环率</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">转诊状态分布</div>
          <div ref="statusChartRef" class="chart-container" style="height: 350px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">来源医院分布</div>
          <div ref="sourceChartRef" class="chart-container" style="height: 350px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 20px;">
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">目标医院分布</div>
          <div ref="targetChartRef" class="chart-container" style="height: 350px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">目标科室分布</div>
          <div ref="deptChartRef" class="chart-container" style="height: 350px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 20px;">
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">异常类型分布</div>
          <div ref="exceptionChartRef" class="chart-container" style="height: 350px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">状态统计明细</div>
          <el-table :data="byStatus" stripe style="width: 100%; margin-top: 12px;">
            <el-table-column label="状态">
              <template #default="{ row }">
                <span :class="['status-tag', `status-${row.status}`]">{{ getStatusText(row.status) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="数量" align="right" />
            <el-table-column label="占比">
              <template #default="{ row }">
                {{ overview.total > 0 ? ((row.count / overview.total) * 100).toFixed(1) : 0 }}%
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'

const dateRange = ref([])
const statusChartRef = ref(null)
const sourceChartRef = ref(null)
const targetChartRef = ref(null)
const deptChartRef = ref(null)
const exceptionChartRef = ref(null)

const overview = reactive({
  total: 0,
  pending: 0,
  closed: 0,
  closure_rate: 0
})

const byStatus = ref([])
const statistics = ref(null)

const getStatusText = (status) => {
  const map = {
    'pending': '待接诊',
    'accepted': '已接诊',
    'checking': '检查中',
    'reported': '已出报告',
    'closed': '已闭环',
    'cancelled': '已取消'
  }
  return map[status] || status
}

const loadData = async () => {
  try {
    const params = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = `${dateRange.value[0]} 00:00:00`
      params.end_date = `${dateRange.value[1]} 23:59:59`
    }

    const res = await axios.get('/api/statistics', { params })
    if (res.data.success) {
      statistics.value = res.data.data
      Object.assign(overview, res.data.data.overview)
      byStatus.value = res.data.data.by_status || []
      
      await nextTick()
      renderCharts()
    }
  } catch (e) {
    console.error('加载数据失败:', e)
  }
}

const renderCharts = () => {
  if (!statistics.value) return

  const statusMap = {
    'pending': '待接诊',
    'accepted': '已接诊',
    'checking': '检查中',
    'reported': '已出报告',
    'closed': '已闭环',
    'cancelled': '已取消'
  }

  if (statusChartRef.value) {
    const chart = echarts.init(statusChartRef.value)
    const data = (statistics.value.by_status || []).map(item => ({
      name: statusMap[item.status] || item.status,
      value: item.count
    }))
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        }
      }]
    })
  }

  if (sourceChartRef.value) {
    const chart = echarts.init(sourceChartRef.value)
    const data = statistics.value.by_source_hospital || []
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: data.map(d => d.source_hospital || '未知') },
      series: [{
        type: 'bar',
        data: data.map(d => d.count),
        itemStyle: { color: '#409EFF', borderRadius: [0, 4, 4, 0] }
      }]
    })
  }

  if (targetChartRef.value) {
    const chart = echarts.init(targetChartRef.value)
    const data = statistics.value.by_target_hospital || []
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: data.map(d => d.target_hospital || '未知') },
      series: [{
        type: 'bar',
        data: data.map(d => d.count),
        itemStyle: { color: '#67C23A', borderRadius: [0, 4, 4, 0] }
      }]
    })
  }

  if (deptChartRef.value) {
    const chart = echarts.init(deptChartRef.value)
    const data = statistics.value.by_department || []
    chart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '60%',
        data: data.map(d => ({ name: d.target_department || '未知', value: d.count })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    })
  }

  if (exceptionChartRef.value) {
    const chart = echarts.init(exceptionChartRef.value)
    const data = statistics.value.by_exception_type || []
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(d => {
          const map = { 'exam_abnormal': '检查异常', 'timeout': '超时', 'other': '其他' }
          return map[d.exception_type] || d.exception_type
        })
      },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: data.map(d => d.count),
        itemStyle: { color: '#F56C6C', borderRadius: [4, 4, 0, 0] }
      }]
    })
  }
}

onMounted(() => {
  loadData()
})
</script>
