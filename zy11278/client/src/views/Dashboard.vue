<template>
  <div class="dashboard">
    <div class="page-header">
      <h2 class="page-title">总览看板</h2>
      <div class="action-bar">
        <el-select v-model="selectedTradingDayId" placeholder="选择交易日" style="width: 200px" @change="handleTradingDayChange">
          <el-option
            v-for="day in tradingDays"
            :key="day.id"
            :label="day.date"
            :value="day.id"
          />
        </el-select>
        <el-button type="primary" @click="refresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <el-row :gutter="15" style="margin-bottom: 20px">
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value">{{ formatMoney(totalAsset) }}</div>
          <div class="stat-label">总资产</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card :class="totalPnl >= 0 ? 'stat-card-green' : 'stat-card-red'">
          <div class="stat-value">
            {{ totalPnl >= 0 ? '+' : '' }}{{ formatMoney(totalPnl) }}
            <span style="font-size: 14px; margin-left: 5px">
              {{ totalPnlPercent >= 0 ? '+' : '' }}{{ formatPercent(totalPnlPercent) }}
            </span>
          </div>
          <div class="stat-label">总盈亏</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card-blue">
          <div class="stat-value">{{ formatMoney(cashAvailable) }}</div>
          <div class="stat-label">可用资金</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card-orange">
          <div class="stat-value">{{ formatPercent(positionRatio) }}</div>
          <div class="stat-label">仓位比例</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card-red">
          <div class="stat-value">{{ formatPercent(maxDrawdown) }}</div>
          <div class="stat-label">最大回撤</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value">{{ activeAlerts.length }}</div>
          <div class="stat-label">活跃预警</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="15">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>持仓概览</span>
              <el-button text type="primary" @click="$router.push('/positions')">查看详情</el-button>
            </div>
          </template>
          <el-table :data="positions" style="width: 100%" :row-class-name="getPositionRowClass">
            <el-table-column prop="symbol" label="代码" width="100" />
            <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
            <el-table-column prop="quantity" label="持仓" width="100">
              <template #default="{ row }">
                {{ formatNumber(row.quantity) }}
              </template>
            </el-table-column>
            <el-table-column prop="avg_cost_price" label="成本价" width="100">
              <template #default="{ row }">
                {{ formatPrice(row.avg_cost_price) }}
              </template>
            </el-table-column>
            <el-table-column prop="current_price" label="现价" width="100">
              <template #default="{ row }">
                {{ formatPrice(row.current_price) }}
              </template>
            </el-table-column>
            <el-table-column prop="market_value" label="市值" width="120">
              <template #default="{ row }">
                {{ formatMoney(row.market_value) }}
              </template>
            </el-table-column>
            <el-table-column prop="floating_pnl" label="浮盈亏" width="120">
              <template #default="{ row }">
                <span :class="row.floating_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
                  {{ row.floating_pnl >= 0 ? '+' : '' }}{{ formatMoney(row.floating_pnl) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="position_ratio" label="仓位" width="80">
              <template #default="{ row }">
                {{ formatPercent(row.position_ratio) }}
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="positions.length === 0" description="暂无持仓" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card style="margin-bottom: 15px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>风险预警</span>
              <el-button text type="primary" @click="$router.push('/risk')">查看详情</el-button>
            </div>
          </template>
          <div v-for="alert in activeAlerts.slice(0, 5)" :key="alert.id" class="risk-alert-card" :class="alert.status">
            <el-card :shadow="alert.status === 'active' ? 'hover' : 'never'" style="padding: 10px">
              <div style="display: flex; justify-content: space-between; align-items: flex-start">
                <div>
                  <el-tag :type="getAlertTagType(alert.severity)" size="small">
                    {{ getAlertTypeName(alert.alert_type) }}
                  </el-tag>
                  <div style="margin-top: 8px; font-size: 13px; color: #606266">
                    {{ alert.title }}
                  </div>
                </div>
                <el-tag size="small" :type="alert.status === 'active' ? 'danger' : 'info'">
                  {{ getAlertStatusName(alert.status) }}
                </el-tag>
              </div>
            </el-card>
          </div>
          <el-empty v-if="activeAlerts.length === 0" description="暂无预警" />
        </el-card>

        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>快捷操作</span>
            </div>
          </template>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px">
            <el-button type="primary" @click="openTradeDialog('buy')">
              <el-icon><Plus /></el-icon>
              买入
            </el-button>
            <el-button type="danger" @click="openTradeDialog('sell')">
              <el-icon><Minus /></el-icon>
              卖出
            </el-button>
            <el-button @click="$router.push('/watchlist')">
              <el-icon><List /></el-icon>
              行情
            </el-button>
            <el-button @click="$router.push('/trade-plan')">
              <el-icon><Document /></el-icon>
              计划
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="tradeDialogVisible" :title="tradeType === 'buy' ? '买入下单' : '卖出下单'" width="500px">
      <el-form :model="tradeForm" :rules="tradeRules" ref="tradeFormRef" label-width="100px">
        <el-form-item label="股票代码" prop="symbol">
          <el-autocomplete
            v-model="tradeForm.symbol"
            :fetch-suggestions="querySearchSymbol"
            placeholder="请输入股票代码"
            @select="handleSelectSymbol"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="股票名称">
          <el-input v-model="tradeForm.name" disabled />
        </el-form-item>
        <el-form-item label="下单价格" prop="price">
          <el-input-number v-model="tradeForm.price" :precision="2" :min="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="下单数量" prop="quantity">
          <el-input-number v-model="tradeForm.quantity" :min="1" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-select v-model="tradeForm.order_subtype" style="width: 100%">
            <el-option label="限价单" value="limit" />
            <el-option label="市价单" value="market" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="tradeForm.notes" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tradeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitTrade">确认下单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTradingStore } from '@/stores/tradingStore'
import { tradingDayApi, importApi, watchlistApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const tradingStore = useTradingStore()

const selectedTradingDayId = ref(null)
const tradingDays = ref([])
const tradeDialogVisible = ref(false)
const tradeType = ref('buy')
const submitting = ref(false)
const tradeFormRef = ref(null)

const positions = computed(() => tradingStore.positions)
const totalAsset = computed(() => tradingStore.totalAsset)
const totalPnl = computed(() => tradingStore.totalPnl)
const totalPnlPercent = computed(() => tradingStore.totalPnlPercent)
const positionRatio = computed(() => tradingStore.positionRatio)
const maxDrawdown = computed(() => tradingStore.maxDrawdown)
const activeAlerts = computed(() => tradingStore.activeAlerts)

const cashAvailable = computed(() => {
  return tradingStore.cashAccount?.available_balance || 0
})

const tradeForm = ref({
  symbol: '',
  name: '',
  price: 0,
  quantity: 0,
  order_subtype: 'limit',
  notes: ''
})

const tradeRules = {
  symbol: [{ required: true, message: '请输入股票代码', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

function formatMoney(value) {
  if (value === null || value === undefined) return '¥0.00'
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatNumber(value) {
  if (value === null || value === undefined) return '0'
  return Number(value).toLocaleString('zh-CN')
}

function formatPrice(value) {
  if (value === null || value === undefined) return '0.00'
  return Number(value).toFixed(2)
}

function formatPercent(value) {
  if (value === null || value === undefined) return '0.00%'
  return (Number(value) * 100).toFixed(2) + '%'
}

function getPositionRowClass({ row }) {
  if (row.floating_pnl > 0) return 'profit-row'
  if (row.floating_pnl < 0) return 'loss-row'
  return ''
}

function getAlertTagType(severity) {
  const map = {
    info: 'info',
    warning: 'warning',
    danger: 'danger',
    critical: 'danger'
  }
  return map[severity] || 'info'
}

function getAlertTypeName(type) {
  const map = {
    over_position: '仓位超限',
    continuous_loss: '连续亏损',
    stop_loss_not_executed: '止损未执行',
    chase_high_buy: '追高买入',
    max_drawdown_exceed: '回撤超限',
    single_stock_over_weight: '单票超配',
    frequent_trading: '交易频繁'
  }
  return map[type] || type
}

function getAlertStatusName(status) {
  const map = {
    active: '活跃',
    acknowledged: '已确认',
    resolved: '已解决',
    ignored: '已忽略'
  }
  return map[status] || status
}

async function loadTradingDays() {
  try {
    const res = await tradingDayApi.list({ pageSize: 50 })
    tradingDays.value = res.data?.list || []
    if (tradingDays.value.length > 0) {
      const active = tradingDays.value.find(d => d.status === 'active')
      selectedTradingDayId.value = active?.id || tradingDays.value[0].id
    }
  } catch (error) {
    console.error('加载交易日失败:', error)
  }
}

async function handleTradingDayChange() {
  await refresh()
}

async function refresh() {
  if (!selectedTradingDayId.value) return
  await tradingStore.refreshAll(selectedTradingDayId.value)
}

function openTradeDialog(type) {
  tradeType.value = type
  tradeForm.value = {
    symbol: '',
    name: '',
    price: 0,
    quantity: type === 'sell' ? 0 : 100,
    order_subtype: 'limit',
    notes: ''
  }
  tradeDialogVisible.value = true
}

async function querySearchSymbol(queryString, cb) {
  try {
    const res = await watchlistApi.getWatchlist({ search: queryString, pageSize: 10 })
    const suggestions = (res.data?.list || []).map(item => ({
      value: item.symbol,
      label: `${item.symbol} - ${item.name}`
    }))
    cb(suggestions)
  } catch (error) {
    cb([])
  }
}

function handleSelectSymbol(item) {
  tradeForm.value.symbol = item.value
  const match = item.label.match(/^(\S+)\s*-\s*(.+)$/)
  if (match) {
    tradeForm.value.name = match[2]
  }
}

async function submitTrade() {
  if (!tradeFormRef.value) return
  await tradeFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        submitting.value = true
        const data = {
          trading_day_id: selectedTradingDayId.value,
          symbol: tradeForm.value.symbol,
          name: tradeForm.value.name,
          price: tradeForm.value.price,
          quantity: tradeForm.value.quantity,
          order_subtype: tradeForm.value.order_subtype,
          notes: tradeForm.value.notes
        }
        
        if (tradeType.value === 'buy') {
          await tradingStore.executeBuy(data)
          ElMessage.success('买入订单已提交')
        } else {
          await tradingStore.executeSell(data)
          ElMessage.success('卖出订单已提交')
        }
        
        tradeDialogVisible.value = false
        await refresh()
      } catch (error) {
        console.error('下单失败:', error)
      } finally {
        submitting.value = false
      }
    }
  })
}

onMounted(async () => {
  await loadTradingDays()
  if (selectedTradingDayId.value) {
    await refresh()
  }
})
</script>

<style scoped>
.dashboard {
  height: 100%;
}

.profit-row {
  background-color: rgba(103, 194, 58, 0.05);
}

.loss-row {
  background-color: rgba(245, 108, 108, 0.05);
}
</style>
