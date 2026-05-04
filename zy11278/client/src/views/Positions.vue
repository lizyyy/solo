<template>
  <div class="positions">
    <div class="page-header">
      <h2 class="page-title">持仓看板</h2>
      <div class="action-bar">
        <el-select v-model="selectedTradingDayId" placeholder="选择交易日" style="width: 200px" @change="loadData">
          <el-option
            v-for="day in tradingDays"
            :key="day.id"
            :label="day.date"
            :value="day.id"
          />
        </el-select>
        <el-button type="primary" @click="loadData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="position-summary">
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">总资产</div>
          <div class="position-summary-value" :class="totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
            {{ formatMoney(totalAsset) }}
          </div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">可用资金</div>
          <div class="position-summary-value">{{ formatMoney(availableCash) }}</div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">持仓市值</div>
          <div class="position-summary-value">{{ formatMoney(marketValue) }}</div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">总盈亏</div>
          <div class="position-summary-value" :class="totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
            {{ totalPnl >= 0 ? '+' : '' }}{{ formatMoney(totalPnl) }}
            <span style="font-size: 14px; margin-left: 5px">
              ({{ totalPnlPercent >= 0 ? '+' : '' }}{{ formatPercent(totalPnlPercent) }})
            </span>
          </div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">浮盈亏</div>
          <div class="position-summary-value" :class="floatingPnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
            {{ floatingPnl >= 0 ? '+' : '' }}{{ formatMoney(floatingPnl) }}
          </div>
        </div>
      </el-card>
      <el-card>
        <div class="position-summary-item">
          <div class="position-summary-label">已实现盈亏</div>
          <div class="position-summary-value" :class="realizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
            {{ realizedPnl >= 0 ? '+' : '' }}{{ formatMoney(realizedPnl) }}
          </div>
        </div>
      </el-card>
    </div>

    <el-row :gutter="15">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>仓位分布</span>
          </template>
          <el-table :data="positions" style="width: 100%" v-loading="loading">
            <el-table-column prop="symbol" label="代码" width="100" />
            <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
            <el-table-column prop="position_ratio" label="仓位占比" width="150">
              <template #default="{ row }">
                <el-progress 
                  :percentage="row.position_ratio * 100" 
                  :format="formatProgress"
                  :stroke-width="18"
                />
              </template>
            </el-table-column>
            <el-table-column label="风险提示" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.position_ratio > 0.3" type="danger" size="small">超配</el-tag>
                <el-tag v-else-if="row.position_ratio > 0.2" type="warning" size="small">高配</el-tag>
                <span v-else class="pnl-neutral">正常</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <span>盈亏分析</span>
          </template>
          <el-table :data="positions" style="width: 100%" v-loading="loading">
            <el-table-column prop="symbol" label="代码" width="100" />
            <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
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
            <el-table-column prop="floating_pnl_percent" label="盈亏比例" width="120">
              <template #default="{ row }">
                <span :class="row.floating_pnl_percent >= 0 ? 'pnl-positive' : 'pnl-negative'">
                  {{ row.floating_pnl_percent >= 0 ? '+' : '' }}{{ formatPercent(row.floating_pnl_percent) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="floating_pnl" label="浮盈亏" width="120">
              <template #default="{ row }">
                <span :class="row.floating_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
                  {{ row.floating_pnl >= 0 ? '+' : '' }}{{ formatMoney(row.floating_pnl) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px">
      <template #header>
        <span>持仓明细</span>
      </template>
      <el-table :data="positions" style="width: 100%" v-loading="loading" stripe>
        <el-table-column prop="symbol" label="代码" width="100" fixed="left" />
        <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
        <el-table-column prop="direction" label="方向" width="80">
          <template #default="{ row }">
            <el-tag :type="row.direction === 'long' ? 'success' : 'danger'" size="small">
              {{ row.direction === 'long' ? '做多' : '做空' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="持仓量" width="100">
          <template #default="{ row }">
            {{ formatNumber(row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column prop="available_quantity" label="可用量" width="100">
          <template #default="{ row }">
            {{ formatNumber(row.available_quantity) }}
          </template>
        </el-table-column>
        <el-table-column prop="frozen_quantity" label="冻结量" width="100">
          <template #default="{ row }">
            {{ formatNumber(row.frozen_quantity) }}
          </template>
        </el-table-column>
        <el-table-column prop="avg_cost_price" label="成本价" width="100">
          <template #default="{ row }">
            {{ formatPrice(row.avg_cost_price) }}
          </template>
        </el-table-column>
        <el-table-column prop="total_cost" label="总成本" width="120">
          <template #default="{ row }">
            {{ formatMoney(row.total_cost) }}
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
        <el-table-column prop="floating_pnl_percent" label="浮盈比例" width="100">
          <template #default="{ row }">
            <span :class="row.floating_pnl_percent >= 0 ? 'pnl-positive' : 'pnl-negative'">
              {{ row.floating_pnl_percent >= 0 ? '+' : '' }}{{ formatPercent(row.floating_pnl_percent) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="realized_pnl" label="已实现盈亏" width="120">
          <template #default="{ row }">
            <span :class="row.realized_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
              {{ row.realized_pnl >= 0 ? '+' : '' }}{{ formatMoney(row.realized_pnl) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="max_drawdown" label="最大回撤" width="100">
          <template #default="{ row }">
            <span class="pnl-negative">{{ formatPercent(row.max_drawdown) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button text type="primary" size="small" @click="quickSell(row)">卖出</el-button>
              <el-button text type="info" size="small" @click="viewDetail(row)">详情</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="positions.length === 0 && !loading" description="暂无持仓" />
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="持仓详情" width="600px">
      <el-descriptions :column="2" border v-if="selectedPosition">
        <el-descriptions-item label="股票代码">{{ selectedPosition.symbol }}</el-descriptions-item>
        <el-descriptions-item label="股票名称">{{ selectedPosition.name }}</el-descriptions-item>
        <el-descriptions-item label="持仓方向">
          <el-tag :type="selectedPosition.direction === 'long' ? 'success' : 'danger'" size="small">
            {{ selectedPosition.direction === 'long' ? '做多' : '做空' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag type="success" size="small">持有中</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="持仓数量" :span="2">{{ formatNumber(selectedPosition.quantity) }} 股</el-descriptions-item>
        <el-descriptions-item label="可用数量">{{ formatNumber(selectedPosition.available_quantity) }} 股</el-descriptions-item>
        <el-descriptions-item label="冻结数量">{{ formatNumber(selectedPosition.frozen_quantity) }} 股</el-descriptions-item>
        <el-descriptions-item label="平均成本价">{{ formatPrice(selectedPosition.avg_cost_price) }}</el-descriptions-item>
        <el-descriptions-item label="当前价格">{{ formatPrice(selectedPosition.current_price) }}</el-descriptions-item>
        <el-descriptions-item label="总成本">{{ formatMoney(selectedPosition.total_cost) }}</el-descriptions-item>
        <el-descriptions-item label="当前市值">{{ formatMoney(selectedPosition.market_value) }}</el-descriptions-item>
        <el-descriptions-item label="浮动盈亏">
          <span :class="selectedPosition.floating_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
            {{ selectedPosition.floating_pnl >= 0 ? '+' : '' }}{{ formatMoney(selectedPosition.floating_pnl) }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="浮动盈亏比例">
          <span :class="selectedPosition.floating_pnl_percent >= 0 ? 'pnl-positive' : 'pnl-negative'">
            {{ selectedPosition.floating_pnl_percent >= 0 ? '+' : '' }}{{ formatPercent(selectedPosition.floating_pnl_percent) }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="已实现盈亏">
          <span :class="selectedPosition.realized_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'">
            {{ selectedPosition.realized_pnl >= 0 ? '+' : '' }}{{ formatMoney(selectedPosition.realized_pnl) }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="最大回撤">
          <span class="pnl-negative">{{ formatPercent(selectedPosition.max_drawdown) }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="quickSell(selectedPosition)">卖出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { positionApi, tradingDayApi, tradingApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const tradingDays = ref([])
const selectedTradingDayId = ref(null)
const positions = ref([])
const cashAccount = ref(null)
const portfolioMetrics = ref(null)

const detailDialogVisible = ref(false)
const selectedPosition = ref(null)

const totalAsset = computed(() => {
  if (!portfolioMetrics.value) return 0
  return portfolioMetrics.value.totalAsset || 0
})

const marketValue = computed(() => {
  if (!portfolioMetrics.value) return 0
  return portfolioMetrics.value.totalMarketValue || 0
})

const availableCash = computed(() => {
  if (!cashAccount.value) return 0
  return cashAccount.value.available_balance || 0
})

const totalPnl = computed(() => {
  if (!portfolioMetrics.value) return 0
  return portfolioMetrics.value.totalPnl || 0
})

const totalPnlPercent = computed(() => {
  if (!portfolioMetrics.value) return 0
  return portfolioMetrics.value.totalPnlPercent || 0
})

const floatingPnl = computed(() => {
  return positions.value.reduce((sum, p) => sum + (p.floating_pnl || 0), 0)
})

const realizedPnl = computed(() => {
  return positions.value.reduce((sum, p) => sum + (p.realized_pnl || 0), 0)
})

function formatNumber(value) {
  if (value === null || value === undefined) return '0'
  return Number(value).toLocaleString('zh-CN')
}

function formatPrice(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toFixed(2)
}

function formatMoney(value) {
  if (value === null || value === undefined) return '¥0.00'
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(value) {
  if (value === null || value === undefined) return '0.00%'
  return (Number(value) * 100).toFixed(2) + '%'
}

function formatProgress(percentage) {
  return percentage.toFixed(2) + '%'
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

async function loadData() {
  if (!selectedTradingDayId.value) return
  try {
    loading.value = true
    
    const [positionsRes, metricsRes, cashRes] = await Promise.all([
      positionApi.getAllPositions({ trading_day_id: selectedTradingDayId.value }),
      positionApi.getPortfolioMetrics({ trading_day_id: selectedTradingDayId.value }),
      positionApi.getCashAccount({ trading_day_id: selectedTradingDayId.value })
    ])
    
    positions.value = positionsRes?.data || []
    portfolioMetrics.value = metricsRes?.data || null
    cashAccount.value = cashRes?.data || null
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

function viewDetail(position) {
  selectedPosition.value = position
  detailDialogVisible.value = true
}

function quickSell(position) {
  ElMessageBox.confirm(
    `确定要卖出 ${position.symbol}(${position.name}) 吗？`,
    '卖出确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await tradingApi.executeSell({
        trading_day_id: selectedTradingDayId.value,
        symbol: position.symbol,
        name: position.name,
        price: position.current_price || position.avg_cost_price,
        quantity: position.available_quantity || position.quantity,
        order_subtype: 'limit'
      })
      ElMessage.success('卖出订单已提交')
      detailDialogVisible.value = false
      await loadData()
    } catch (error) {
      console.error('卖出失败:', error)
    }
  }).catch(() => {})
}

onMounted(async () => {
  await loadTradingDays()
  if (selectedTradingDayId.value) {
    await loadData()
  }
})
</script>

<style scoped>
.positions {
  height: 100%;
}
</style>
