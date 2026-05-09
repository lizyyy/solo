<template>
  <div>
    <div class="page-header">
      <div class="page-title">工作台</div>
      <el-button @click="loadData">
        <el-icon><Refresh /></el-icon>
        刷新数据
      </el-button>
    </div>

    <el-row :gutter="16" style="margin-bottom: 20px;">
      <el-col :span="6" v-for="item in statCards" :key="item.title">
        <div class="stat-card" @click="goToPage(item.route)">
          <div class="stat-value" :style="{ color: item.color }">{{ item.value }}</div>
          <div class="stat-label">{{ item.title }}</div>
          <el-icon :size="32" class="stat-icon" :style="{ color: item.color }">
            <component :is="item.icon" />
          </el-icon>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="table-card">
          <div class="detail-section-title">最近转诊单</div>
          <el-table :data="recentOrders" stripe style="width: 100%">
            <el-table-column prop="referral_no" label="转诊单号" width="160" />
            <el-table-column prop="patient_name" label="患者姓名" width="100" />
            <el-table-column prop="target_hospital" label="目标医院" width="160" />
            <el-table-column prop="target_department" label="目标科室" width="120" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <span :class="['status-tag', `status-${row.status}`]">{{ getStatusText(row.status) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="create_time" label="创建时间" width="180" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="primary" link @click="viewDetail(row.id)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="table-card">
          <div class="detail-section-title" style="border-left-color: #F56C6C;">待处理异常</div>
          <el-table :data="recentExceptions" stripe style="width: 100%" :empty-text="暂无待处理异常">
            <el-table-column prop="referral_no" label="转诊单号" width="140" />
            <el-table-column prop="patient_name" label="患者" width="80" />
            <el-table-column prop="exception_content" label="异常内容" />
            <el-table-column label="级别" width="80">
              <template #default="{ row }">
                <el-tag :type="row.exception_level === 'danger' ? 'danger' : 'warning'" size="small">
                  {{ row.exception_level === 'danger' ? '严重' : '警告' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 20px;">
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">转诊状态分布</div>
          <div ref="statusChartRef" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="table-card">
          <div class="detail-section-title">目标科室分布</div>
          <div ref="deptChartRef" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import * as echarts from 'echarts'

const router = useRouter()
const statusChartRef = ref(null)
const deptChartRef = ref(null)

const summary = ref({
  today_orders: 0,
  pending_orders: 0,
  checking_orders: 0,
  unhandled_exceptions: 0
})
const recentOrders = ref([])
const recentExceptions = ref([])
const statistics = ref(null)

const statCards = [
  { title: '今日新增', value: summary.value.today_orders, icon: 'Plus', color: '#409EFF', route: '/referral-orders' },
  { title: '待接诊', value: summary.value.pending_orders, icon: 'Clock', color: '#E6A23C', route: '/referral-orders?status=pending' },
  { title: '检查中', value: summary.value.checking_orders, icon: 'Loading', color: '#F56C6C', route: '/referral-orders?status=checking' },
  { title: '待处理异常', value: summary.value.unhandled_exceptions, icon: 'Warning', color: '#F56C6C', route: '/exceptions' }
]

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
    const [summaryRes, statsRes] = await Promise.all([
      axios.get('/api/dashboard/summary'),
      axios.get('/api/statistics')
    ])

    if (summaryRes.data.success) {
      summary.value = summaryRes.data.data
      recentOrders.value = summaryRes.data.data.recent_orders || []
      recentExceptions.value = summaryRes.data.data.recent_exceptions || []

      statCards[0].value = summary.value.today_orders
      statCards[1].value = summary.value.pending_orders
      statCards[2].value = summary.value.checking_orders
      statCards[3].value = summary.value.unhandled_exceptions
    }

    if (statsRes.data.success) {
      statistics.value = statsRes.data.data
      await nextTick()
      renderCharts()
    }
  } catch (e) {
    console.error('加载数据失败:', e)
  }
}

const renderCharts = () => {
  if (statusChartRef.value && statistics.value) {
    const statusChart = echarts.init(statusChartRef.value)
    const statusData = statistics.value.by_status || []
    const statusMap = {
      'pending': '待接诊',
      'accepted': '已接诊',
      'checking': '检查中',
      'reported': '已出报告',
      'closed': '已闭环',
      'cancelled': '已取消'
    }
    statusChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: statusData.map(item => ({
          name: statusMap[item.status] || item.status,
          value: item.count
        }))
      }]
    })
  }

  if (deptChartRef.value && statistics.value) {
    const deptChart = echarts.init(deptChartRef.value)
    const deptData = statistics.value.by_department || []
    deptChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: deptData.map(d => d.target_department || '未知') },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: deptData.map(d => d.count),
        itemStyle: { color: '#409EFF' }
      }]
    })
  }
}

const viewDetail = (id) => {
  router.push(`/referral-orders/${id}`)
}

const goToPage = (route) => {
  router.push(route)
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stat-card {
  position: relative;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

.stat-icon {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.2;
}
</style>
