<template>
  <div class="timeline">
    <div class="page-header">
      <h2 class="page-title">交易日时间线</h2>
      <div class="action-bar">
        <el-button type="primary" @click="openCreateTradingDayDialog">
          <el-icon><Plus /></el-icon>
          新建交易日
        </el-button>
        <el-button @click="loadTradingDays">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <el-row :gutter="15">
      <el-col :span="6">
        <el-card>
          <template #header>
            <span>交易日列表</span>
          </template>
          <el-table :data="tradingDays" style="width: 100%" highlight-current-row @current-change="handleTradingDayChange">
            <el-table-column prop="date" label="日期" width="120">
              <template #default="{ row }">
                <div style="font-weight: bold">{{ row.date }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">
                  {{ getStatusName(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="18">
        <el-card v-if="selectedTradingDay">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>{{ selectedTradingDay.date }} 交易概览</span>
              <div class="action-bar">
                <el-button 
                  v-if="selectedTradingDay.status === 'pending'"
                  type="primary"
                  size="small"
                  @click="openTradingDay"
                >
                  开盘
                </el-button>
                <el-button 
                  v-if="selectedTradingDay.status === 'active'"
                  type="warning"
                  size="small"
                  @click="closeTradingDay"
                >
                  收盘
                </el-button>
                <el-button 
                  v-if="selectedTradingDay.status === 'closed'"
                  type="success"
                  size="small"
                  @click="reviewTradingDay"
                >
                  复盘
                </el-button>
              </div>
            </div>
          </template>

          <div class="position-summary" style="margin-bottom: 20px">
            <el-card>
              <div class="position-summary-item">
                <div class="position-summary-label">初始资金</div>
                <div class="position-summary-value">{{ formatMoney(selectedTradingDay.initial_cash) }}</div>
              </div>
            </el-card>
            <el-card>
              <div class="position-summary-item">
                <div class="position-summary-label">期末资金</div>
                <div class="position-summary-value">{{ formatMoney(selectedTradingDay.final_cash) }}</div>
              </div>
            </el-card>
            <el-card>
              <div class="position-summary-item">
                <div class="position-summary-label">总市值</div>
                <div class="position-summary-value">{{ formatMoney(selectedTradingDay.total_market_value) }}</div>
              </div>
            </el-card>
            <el-card>
              <div class="position-summary-item">
                <div class="position-summary-label">总资产</div>
                <div class="position-summary-value">{{ formatMoney(selectedTradingDay.total_asset) }}</div>
              </div>
            </el-card>
            <el-card>
              <div class="position-summary-item">
                <div class="position-summary-label">当日盈亏</div>
                <div class="position-summary-value" :class="selectedTradingDay.daily_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
                  {{ selectedTradingDay.daily_pnl >= 0 ? '+' : '' }}{{ formatMoney(selectedTradingDay.daily_pnl) }}
                  <span style="font-size: 12px; margin-left: 5px">
                    ({{ selectedTradingDay.daily_pnl_percent >= 0 ? '+' : '' }}{{ formatPercent(selectedTradingDay.daily_pnl_percent) }})
                  </span>
                </div>
              </div>
            </el-card>
            <el-card>
              <div class="position-summary-item">
                <div class="position-summary-label">仓位比例</div>
                <div class="position-summary-value">{{ formatPercent(selectedTradingDay.position_ratio) }}</div>
              </div>
            </el-card>
          </div>

          <el-divider content-position="left">交易统计</el-divider>

          <el-row :gutter="15" style="margin-bottom: 20px">
            <el-col :span="8">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="买入次数">
                  <span style="color: #67c23a; font-weight: bold">{{ selectedTradingDay.buy_count || 0 }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="卖出次数">
                  <span style="color: #f56c6c; font-weight: bold">{{ selectedTradingDay.sell_count || 0 }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </el-col>
            <el-col :span="8">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="最大回撤">
                  <span style="color: #f56c6c; font-weight: bold">{{ formatPercent(selectedTradingDay.max_drawdown) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="胜率">
                  <span style="font-weight: bold">{{ formatPercent(selectedTradingDay.win_rate) }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </el-col>
            <el-col :span="8">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="开盘时间">
                  {{ formatTime(selectedTradingDay.opened_at) }}
                </el-descriptions-item>
                <el-descriptions-item label="收盘时间">
                  {{ formatTime(selectedTradingDay.closed_at) }}
                </el-descriptions-item>
              </el-descriptions>
            </el-col>
          </el-row>

          <el-divider content-position="left">今日操作时间线</el-divider>

          <el-timeline>
            <el-timeline-item
              v-for="(event, index) in timelineEvents"
              :key="index"
              :type="event.type"
              :timestamp="event.timestamp"
            >
              <el-card>
                <h4>{{ event.title }}</h4>
                <p>{{ event.content }}</p>
                <p v-if="event.details" style="font-size: 12px; color: #909399; margin-top: 5px">
                  {{ event.details }}
                </p>
              </el-card>
            </el-timeline-item>
            <el-timeline-item type="info" v-if="timelineEvents.length === 0">
              <el-card>
                <el-empty description="暂无交易记录" />
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-card>
        <el-empty v-else description="请选择一个交易日" />
      </el-col>
    </el-row>

    <el-dialog v-model="createDialogVisible" title="新建交易日" width="400px">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
        <el-form-item label="交易日期" prop="date">
          <el-date-picker
            v-model="createForm.date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="初始资金" prop="initial_cash">
          <el-input-number v-model="createForm.initial_cash" :precision="2" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="createForm.status" style="width: 100%">
            <el-option label="待开盘" value="pending" />
            <el-option label="开盘" value="active" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createTradingDay">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { tradingDayApi, tradingApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const tradingDays = ref([])
const selectedTradingDay = ref(null)
const selectedTradingDayId = ref(null)

const createDialogVisible = ref(false)
const createFormRef = ref(null)
const createForm = ref({
  date: dayjs().format('YYYY-MM-DD'),
  initial_cash: 1000000,
  status: 'pending'
})
const createRules = {
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  initial_cash: [{ required: true, message: '请输入初始资金', trigger: 'blur' }]
}

const timelineEvents = computed(() => {
  const events = []
  
  if (selectedTradingDay.value) {
    if (selectedTradingDay.value.opened_at) {
      events.push({
        type: 'primary',
        timestamp: formatTime(selectedTradingDay.value.opened_at),
        title: '开盘',
        content: `交易日 ${selectedTradingDay.value.date} 开盘`,
        details: `初始资金: ${formatMoney(selectedTradingDay.value.initial_cash)}`
      })
    }
    
    if (selectedTradingDay.value.buy_count > 0) {
      events.push({
        type: 'success',
        timestamp: '--:--:--',
        title: '买入操作',
        content: `执行 ${selectedTradingDay.value.buy_count} 次买入`
      })
    }
    
    if (selectedTradingDay.value.sell_count > 0) {
      events.push({
        type: 'danger',
        timestamp: '--:--:--',
        title: '卖出操作',
        content: `执行 ${selectedTradingDay.value.sell_count} 次卖出`
      })
    }
    
    if (selectedTradingDay.value.closed_at) {
      events.push({
        type: 'warning',
        timestamp: formatTime(selectedTradingDay.value.closed_at),
        title: '收盘',
        content: `交易日 ${selectedTradingDay.value.date} 收盘`,
        details: `当日盈亏: ${selectedTradingDay.value.daily_pnl >= 0 ? '+' : ''}${formatMoney(selectedTradingDay.value.daily_pnl)} (${selectedTradingDay.value.daily_pnl_percent >= 0 ? '+' : ''}${formatPercent(selectedTradingDay.value.daily_pnl_percent)})`
      })
    }
    
    if (selectedTradingDay.value.status === 'reviewed') {
      events.push({
        type: 'info',
        timestamp: '--:--:--',
        title: '复盘完成',
        content: '该交易日已完成复盘'
      })
    }
  }
  
  return events
})

function formatMoney(value) {
  if (value === null || value === undefined) return '¥0.00'
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(value) {
  if (value === null || value === undefined) return '0.00%'
  return (Number(value) * 100).toFixed(2) + '%'
}

function formatTime(value) {
  if (!value) return '--:--:--'
  return dayjs(value).format('HH:mm:ss')
}

function getStatusTagType(status) {
  const map = {
    pending: 'info',
    active: 'success',
    closed: 'warning',
    reviewed: 'primary'
  }
  return map[status] || 'info'
}

function getStatusName(status) {
  const map = {
    pending: '待开盘',
    active: '交易中',
    closed: '已收盘',
    reviewed: '已复盘'
  }
  return map[status] || status
}

async function loadTradingDays() {
  try {
    const res = await tradingDayApi.list({ pageSize: 50 })
    tradingDays.value = res.data?.list || []
    
    if (tradingDays.value.length > 0 && !selectedTradingDay.value) {
      const active = tradingDays.value.find(d => d.status === 'active')
      if (active) {
        handleTradingDayChange(active)
      } else {
        handleTradingDayChange(tradingDays.value[0])
      }
    }
  } catch (error) {
    console.error('加载交易日失败:', error)
  }
}

function handleTradingDayChange(row) {
  if (row) {
    selectedTradingDay.value = row
    selectedTradingDayId.value = row.id
  }
}

function openCreateTradingDayDialog() {
  createForm.value = {
    date: dayjs().format('YYYY-MM-DD'),
    initial_cash: 1000000,
    status: 'pending'
  }
  createDialogVisible.value = true
}

async function createTradingDay() {
  if (!createFormRef.value) return
  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await tradingDayApi.create(createForm.value)
        ElMessage.success('创建成功')
        createDialogVisible.value = false
        await loadTradingDays()
      } catch (error) {
        console.error('创建失败:', error)
      }
    }
  })
}

async function openTradingDay() {
  if (!selectedTradingDayId.value) return
  
  ElMessageBox.confirm(
    '确定要开盘吗？开盘后可以开始交易。',
    '开盘确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'primary'
    }
  ).then(async () => {
    try {
      await tradingDayApi.open(selectedTradingDayId.value)
      ElMessage.success('开盘成功')
      await loadTradingDays()
    } catch (error) {
      console.error('开盘失败:', error)
    }
  }).catch(() => {})
}

async function closeTradingDay() {
  if (!selectedTradingDayId.value) return
  
  ElMessageBox.confirm(
    '确定要收盘吗？收盘后将无法进行交易。',
    '收盘确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await tradingDayApi.close(selectedTradingDayId.value)
      ElMessage.success('收盘成功')
      await loadTradingDays()
    } catch (error) {
      console.error('收盘失败:', error)
    }
  }).catch(() => {})
}

async function reviewTradingDay() {
  if (!selectedTradingDayId.value) return
  
  ElMessageBox.confirm(
    '确定要标记为已复盘吗？',
    '复盘确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'success'
    }
  ).then(async () => {
    try {
      await tradingDayApi.review(selectedTradingDayId.value)
      ElMessage.success('复盘标记成功')
      await loadTradingDays()
    } catch (error) {
      console.error('复盘失败:', error)
    }
  }).catch(() => {})
}

onMounted(async () => {
  await loadTradingDays()
})
</script>

<style scoped>
.timeline {
  height: 100%;
}
</style>
