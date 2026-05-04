<template>
  <div class="watchlist">
    <div class="page-header">
      <h2 class="page-title">自选股/行情导入</h2>
      <div class="action-bar">
        <el-button type="primary" @click="openImportQuotesDialog">
          <el-icon><Upload /></el-icon>
          导入行情
        </el-button>
        <el-button @click="openAddWatchlistDialog">
          <el-icon><Plus /></el-icon>
          添加自选股
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="自选股" name="watchlist">
        <el-card>
          <el-table :data="watchlist" style="width: 100%" v-loading="loading">
            <el-table-column prop="symbol" label="代码" width="100" />
            <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
            <el-table-column prop="category" label="分类" width="100">
              <template #default="{ row }">
                <el-tag :type="getCategoryTagType(row.category)" size="small">
                  {{ getCategoryName(row.category) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="80">
              <template #default="{ row }">
                <el-rate v-model="row.priority" :max="5" disabled show-score text-color="#ff9900" score-template="{value}" />
              </template>
            </el-table-column>
            <el-table-column prop="last_price" label="最新价" width="100">
              <template #default="{ row }">
                {{ formatPrice(row.last_price) }}
              </template>
            </el-table-column>
            <el-table-column prop="price_change_percent" label="涨跌幅" width="100">
              <template #default="{ row }">
                <span :class="row.price_change_percent >= 0 ? 'pnl-positive' : 'pnl-negative'">
                  {{ row.price_change_percent >= 0 ? '+' : '' }}{{ formatPercent(row.price_change_percent) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button text type="primary" size="small" @click="quickTrade('buy', row)">买入</el-button>
                  <el-button text type="danger" size="small" @click="quickTrade('sell', row)">卖出</el-button>
                  <el-button text type="info" size="small" @click="editWatchlist(row)">编辑</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="watchlist.length === 0 && !loading" description="暂无自选股" />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="行情数据" name="quotes">
        <div class="search-bar">
          <el-select v-model="selectedTradingDayId" placeholder="选择交易日" style="width: 200px" @change="loadQuotes">
            <el-option
              v-for="day in tradingDays"
              :key="day.id"
              :label="day.date"
              :value="day.id"
            />
          </el-select>
          <el-input v-model="quoteSearch" placeholder="搜索代码/名称" style="width: 200px" clearable @keyup.enter="loadQuotes" />
          <el-button type="primary" @click="loadQuotes">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
        </div>

        <el-card>
          <el-table :data="quotes" style="width: 100%" v-loading="loading">
            <el-table-column prop="symbol" label="代码" width="100" />
            <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
            <el-table-column prop="open" label="开盘" width="90">
              <template #default="{ row }">
                {{ formatPrice(row.open) }}
              </template>
            </el-table-column>
            <el-table-column prop="high" label="最高" width="90">
              <template #default="{ row }">
                {{ formatPrice(row.high) }}
              </template>
            </el-table-column>
            <el-table-column prop="low" label="最低" width="90">
              <template #default="{ row }">
                {{ formatPrice(row.low) }}
              </template>
            </el-table-column>
            <el-table-column prop="close" label="收盘" width="90">
              <template #default="{ row }">
                {{ formatPrice(row.close) }}
              </template>
            </el-table-column>
            <el-table-column prop="change_percent" label="涨跌幅" width="90">
              <template #default="{ row }">
                <span :class="row.change_percent >= 0 ? 'pnl-positive' : 'pnl-negative'">
                  {{ row.change_percent >= 0 ? '+' : '' }}{{ formatPercent(row.change_percent) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="volume" label="成交量(万)" width="100">
              <template #default="{ row }">
                {{ formatNumber((row.volume || 0) / 10000) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button text type="primary" size="small" @click="addQuoteToWatchlist(row)">加自选</el-button>
                  <el-button text type="success" size="small" @click="quickTrade('buy', row)">买入</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="quotes.length === 0 && !loading" description="请先导入行情数据" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="importQuotesDialogVisible" title="导入行情数据" width="500px">
      <el-form :model="importForm" label-width="100px">
        <el-form-item label="交易日期" required>
          <el-select v-model="importForm.trading_day_id" placeholder="选择交易日" style="width: 100%">
            <el-option
              v-for="day in tradingDays"
              :key="day.id"
              :label="day.date"
              :value="day.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="行情文件" required>
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".csv"
            :on-change="handleQuoteFileChange"
          >
            <el-button type="primary">选择 CSV 文件</el-button>
            <template #tip>
              <div class="el-upload__tip">仅支持 CSV 格式</div>
            </template>
          </el-upload>
          <div v-if="importForm.fileName" style="margin-top: 10px">
            <el-tag>{{ importForm.fileName }}</el-tag>
          </div>
        </el-form-item>
        <el-form-item label="文件格式">
          <div style="font-size: 12px; color: #909399">
            CSV 应包含：symbol, name, open, high, low, close, volume 等字段
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importQuotesDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="uploadQuotes">导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="watchlistDialogVisible" :title="editingWatchlist ? '编辑自选股' : '添加自选股'" width="400px">
      <el-form :model="watchlistForm" :rules="watchlistRules" ref="watchlistFormRef" label-width="100px">
        <el-form-item label="股票代码" prop="symbol">
          <el-input v-model="watchlistForm.symbol" placeholder="如：600519" />
        </el-form-item>
        <el-form-item label="股票名称" prop="name">
          <el-input v-model="watchlistForm.name" placeholder="如：贵州茅台" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="watchlistForm.category" style="width: 100%">
            <el-option label="关注" value="watch" />
            <el-option label="重点关注" value="focus" />
            <el-option label="回避" value="avoid" />
            <el-option label="持仓" value="portfolio" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-rate v-model="watchlistForm.priority" :max="5" show-text :texts="['低', '中低', '中', '中高', '高']" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="watchlistForm.notes" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="watchlistDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveWatchlist">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="quickTradeDialogVisible" :title="quickTradeType === 'buy' ? '快速买入' : '快速卖出'" width="500px">
      <el-form :model="quickTradeForm" :rules="quickTradeRules" ref="quickTradeFormRef" label-width="100px">
        <el-form-item label="股票">
          <el-tag size="large">{{ quickTradeForm.symbol }} - {{ quickTradeForm.name }}</el-tag>
        </el-form-item>
        <el-form-item label="交易价格" prop="price">
          <el-input-number v-model="quickTradeForm.price" :precision="2" :min="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="交易数量" prop="quantity">
          <el-input-number v-model="quickTradeForm.quantity" :min="1" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-select v-model="quickTradeForm.order_subtype" style="width: 100%">
            <el-option label="限价单" value="limit" />
            <el-option label="市价单" value="market" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quickTradeDialogVisible = false">取消</el-button>
        <el-button :type="quickTradeType === 'buy' ? 'primary' : 'danger'" @click="submitQuickTrade">确认下单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { watchlistApi, importApi, tradingDayApi, tradingApi } from '@/api'
import { ElMessage } from 'element-plus'

const activeTab = ref('watchlist')
const loading = ref(false)
const watchlist = ref([])
const quotes = ref([])
const tradingDays = ref([])
const selectedTradingDayId = ref(null)
const quoteSearch = ref('')

const importQuotesDialogVisible = ref(false)
const importForm = ref({
  trading_day_id: null,
  fileName: ''
})
const importing = ref(false)
const uploadRef = ref(null)

const watchlistDialogVisible = ref(false)
const editingWatchlist = ref(null)
const watchlistForm = ref({
  symbol: '',
  name: '',
  category: 'watch',
  priority: 3,
  notes: ''
})
const watchlistFormRef = ref(null)
const watchlistRules = {
  symbol: [{ required: true, message: '请输入股票代码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入股票名称', trigger: 'blur' }]
}

const quickTradeDialogVisible = ref(false)
const quickTradeType = ref('buy')
const quickTradeForm = ref({
  symbol: '',
  name: '',
  price: 0,
  quantity: 0,
  order_subtype: 'limit'
})
const quickTradeFormRef = ref(null)
const quickTradeRules = {
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
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

function getCategoryTagType(category) {
  const map = {
    focus: 'success',
    watch: 'primary',
    avoid: 'danger',
    portfolio: 'warning'
  }
  return map[category] || 'info'
}

function getCategoryName(category) {
  const map = {
    focus: '重点关注',
    watch: '关注',
    avoid: '回避',
    portfolio: '持仓'
  }
  return map[category] || category
}

async function loadTradingDays() {
  try {
    const res = await tradingDayApi.list({ pageSize: 50 })
    tradingDays.value = res.data?.list || []
    if (tradingDays.value.length > 0) {
      const active = tradingDays.value.find(d => d.status === 'active')
      selectedTradingDayId.value = active?.id || tradingDays.value[0].id
      importForm.value.trading_day_id = selectedTradingDayId.value
    }
  } catch (error) {
    console.error('加载交易日失败:', error)
  }
}

async function loadWatchlist() {
  try {
    loading.value = true
    const res = await watchlistApi.getWatchlist({ pageSize: 100 })
    watchlist.value = res.data?.list || []
  } catch (error) {
    console.error('加载自选股失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadQuotes() {
  if (!selectedTradingDayId.value) return
  try {
    loading.value = true
    const res = await importApi.getQuotes({
      trading_day_id: selectedTradingDayId.value,
      symbol: quoteSearch.value || undefined,
      pageSize: 100
    })
    quotes.value = res.data?.list || []
  } catch (error) {
    console.error('加载行情失败:', error)
  } finally {
    loading.value = false
  }
}

function openImportQuotesDialog() {
  importForm.value = {
    trading_day_id: selectedTradingDayId.value,
    fileName: ''
  }
  importQuotesDialogVisible.value = true
}

function handleQuoteFileChange(file) {
  importForm.value.fileName = file.name
}

async function uploadQuotes() {
  if (!importForm.value.trading_day_id) {
    ElMessage.warning('请选择交易日')
    return
  }
  if (!importForm.value.fileName || !uploadRef.value?.uploadFiles?.length) {
    ElMessage.warning('请选择文件')
    return
  }

  try {
    importing.value = true
    const formData = new FormData()
    formData.append('file', uploadRef.value.uploadFiles[0].raw)
    formData.append('trading_day_id', importForm.value.trading_day_id)

    const res = await importApi.importQuotes(formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    ElMessage.success(`成功导入 ${res.data?.imported || 0} 条行情数据`)
    importQuotesDialogVisible.value = false
    await loadQuotes()
  } catch (error) {
    console.error('导入行情失败:', error)
  } finally {
    importing.value = false
  }
}

function openAddWatchlistDialog() {
  editingWatchlist.value = null
  watchlistForm.value = {
    symbol: '',
    name: '',
    category: 'watch',
    priority: 3,
    notes: ''
  }
  watchlistDialogVisible.value = true
}

function editWatchlist(item) {
  editingWatchlist.value = item
  watchlistForm.value = {
    ...item
  }
  watchlistDialogVisible.value = true
}

async function saveWatchlist() {
  if (!watchlistFormRef.value) return
  await watchlistFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (editingWatchlist.value) {
          await watchlistApi.updateWatchlistItem(editingWatchlist.value.id, watchlistForm.value)
          ElMessage.success('更新成功')
        } else {
          await watchlistApi.addToWatchlist(watchlistForm.value)
          ElMessage.success('添加成功')
        }
        watchlistDialogVisible.value = false
        await loadWatchlist()
      } catch (error) {
        console.error('保存失败:', error)
      }
    }
  })
}

function addQuoteToWatchlist(quote) {
  watchlistForm.value = {
    symbol: quote.symbol,
    name: quote.name,
    category: 'watch',
    priority: 3,
    notes: ''
  }
  editingWatchlist.value = null
  watchlistDialogVisible.value = true
}

function quickTrade(type, item) {
  quickTradeType.value = type
  quickTradeForm.value = {
    symbol: item.symbol,
    name: item.name,
    price: item.close || item.last_price || 0,
    quantity: 100,
    order_subtype: 'limit'
  }
  quickTradeDialogVisible.value = true
}

async function submitQuickTrade() {
  if (!quickTradeFormRef.value) return
  await quickTradeFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const data = {
          trading_day_id: selectedTradingDayId.value,
          ...quickTradeForm.value
        }
        
        if (quickTradeType.value === 'buy') {
          await tradingApi.executeBuy(data)
          ElMessage.success('买入订单已提交')
        } else {
          await tradingApi.executeSell(data)
          ElMessage.success('卖出订单已提交')
        }
        
        quickTradeDialogVisible.value = false
      } catch (error) {
        console.error('下单失败:', error)
      }
    }
  })
}

onMounted(async () => {
  await loadTradingDays()
  await loadWatchlist()
  if (selectedTradingDayId.value) {
    await loadQuotes()
  }
})
</script>

<style scoped>
.watchlist {
  height: 100%;
}
</style>
