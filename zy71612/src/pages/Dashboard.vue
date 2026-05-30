<template>
  <div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">票据总数</div>
        <div class="stat-value">{{ dashboardData?.bills?.total || 0 }}</div>
        <div class="stat-sub">票面总额: ¥{{ formatAmount(dashboardData?.bills?.totalAmount) }}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">7天内到期</div>
        <div class="stat-value">{{ dashboardData?.bills?.matureIn7Days || 0 }}</div>
        <div class="stat-sub">金额: ¥{{ formatAmount(dashboardData?.reminders?.pendingAmount) }}</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-label">已逾期</div>
        <div class="stat-value">{{ dashboardData?.bills?.overdue || 0 }}</div>
        <div class="stat-sub">待处理: {{ dashboardData?.reminders?.pendingCount || 0 }} 笔</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">托收中</div>
        <div class="stat-value">{{ dashboardData?.collections?.byStatus?.applied || 0 }}</div>
        <div class="stat-sub">金额: ¥{{ formatAmount(dashboardData?.collections?.pendingAmount) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">贴现中</div>
        <div class="stat-value">{{ dashboardData?.discounts?.byStatus?.applied || 0 }}</div>
        <div class="stat-sub">金额: ¥{{ formatAmount(dashboardData?.discounts?.pendingAmount) }}</div>
      </div>
      <div class="stat-card" :class="dashboardData?.endorses?.brokenChains > 0 ? 'warning' : 'success'">
        <div class="stat-label">背书断链</div>
        <div class="stat-value">{{ dashboardData?.endorses?.brokenChains || 0 }}</div>
        <div class="stat-sub">健康背书链: {{ dashboardData?.endorses?.healthyChains || 0 }} 条</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">快捷操作</div>
        <div class="flex gap-8">
          <button class="btn btn-primary" @click="generateReminders">生成今日提醒</button>
          <button class="btn btn-success" @click="exportData">导出数据</button>
          <button class="btn" @click="addSampleData">导入示例数据</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">待处理提醒</div>
      </div>
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="pendingReminders.length === 0" class="empty-state">
        <div class="icon">✅</div>
        <p>暂无待处理提醒</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
          <tr>
            <th>票据号</th>
            <th>承兑人</th>
            <th>票面金额</th>
            <th>到期日</th>
            <th>提醒类型</th>
            <th>票据状态</th>
            <th>处理状态</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in pendingReminders.slice(0, 10)" :key="item.id">
            <td>{{ item.billNo }}</td>
            <td>{{ item.acceptor }}</td>
            <td class="amount">¥{{ formatAmount(item.amount) }}</td>
            <td>{{ item.matureDate }}</td>
            <td>
              <span :class="getReminderBadgeClass(item.reminderType)">
                {{ getReminderTypeText(item.reminderType) }}
              </span>
            </td>
            <td>
              <span :class="getBillStatusBadgeClass(item.billStatus)">
                {{ getBillStatusText(item.billStatus) }}
              </span>
            </td>
            <td>
              <span class="badge badge-warning">待处理</span>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import reportService from '../services/ReportService.js'
import reminderService from '../services/ReminderService.js'
import billService from '../services/BillService.js'
import { BillStatusText, ReminderTypeText, ProcessStatus } from '../models/types.js'

const dashboardData = ref(null)
const pendingReminders = ref([])
const loading = ref(false)

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getReminderBadgeClass = (type) => {
  const map = {
    mature_7d: 'badge badge-info',
    mature_3d: 'badge badge-warning',
    mature_1d: 'badge badge-danger',
    mature_today: 'badge badge-danger',
    overdue: 'badge badge-danger'
  }
  return map[type] || 'badge'
}

const getReminderTypeText = (type) => ReminderTypeText[type] || type

const getBillStatusBadgeClass = (status) => {
  if (['collected', 'discounted'].includes(status)) {
    return 'badge badge-success'
  } else if (['expired', 'void'].includes(status)) {
    return 'badge badge-danger'
  } else if (status === 'collecting') {
    return 'badge badge-warning'
  }
  return 'badge badge-primary'
}

const getBillStatusText = (status) => BillStatusText[status] || status

const loadData = async () => {
  loading.value = true
  try {
    dashboardData.value = await reportService.getDashboardData()
    pendingReminders.value = await reminderService.getAllReminders({ processStatus: ProcessStatus.PENDING })
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

const generateReminders = async () => {
  try {
    const result = await reminderService.generateReminders()
    alert(`生成了 ${result.totalGenerated} 条提醒，跳过 ${result.totalSkipped} 条`)
    loadData()
  } catch (error) {
    console.error('生成提醒失败:', error)
    alert('生成提醒失败')
  }
}

const exportData = () => {
  alert('导出功能请在对应页面使用')
}

const addSampleData = async () => {
  try {
    const sampleBills = [
      {
        billNo: 'CD123456789001',
        acceptor: '中国工商银行北京分行',
        drawer: 'ABC贸易有限公司',
        holder: '本公司',
        amount: 500000,
        acceptDate: dayjs().format('YYYY-MM-DD'),
        matureDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
        remark: '示例票据1'
      },
      {
        billNo: 'CD123456789002',
        acceptor: '中国建设银行上海分行',
        drawer: 'XYZ科技有限公司',
        holder: '本公司',
        amount: 1000000,
        acceptDate: dayjs().format('YYYY-MM-DD'),
        matureDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
        remark: '示例票据2'
      },
      {
        billNo: 'CD123456789003',
        acceptor: '招商银行深圳分行',
        drawer: 'DEF制造有限公司',
        holder: '本公司',
        amount: 800000,
        acceptDate: dayjs().format('YYYY-MM-DD'),
        matureDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        remark: '示例票据3'
      }
    ]

    for (const bill of sampleBills) {
      try {
        await billService.createBill(bill)
      } catch (e) {
        console.log('票据已存在:', bill.billNo)
      }
    }

    alert('示例数据导入成功')
    loadData()
  } catch (error) {
    console.error('导入示例数据失败:', error)
    alert('导入示例数据失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
