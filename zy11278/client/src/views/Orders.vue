<template>
  <div class="orders">
    <div class="page-header">
      <h2 class="page-title">订单流水</h2>
      <div class="action-bar">
        <el-button type="primary" @click="refresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="search-bar">
      <el-select v-model="selectedTradingDayId" placeholder="选择交易日" style="width: 200px" @change="loadOrders">
        <el-option
          v-for="day in tradingDays"
          :key="day.id"
          :label="day.date"
          :value="day.id"
        />
      </el-select>
      <el-select v-model="filterStatus" placeholder="订单状态" clearable style="width: 150px" @change="loadOrders">
        <el-option label="待提交" value="pending" />
        <el-option label="已提交" value="submitted" />
        <el-option label="部分成交" value="partially_filled" />
        <el-option label="已成交" value="filled" />
        <el-option label="已撤单" value="cancelled" />
        <el-option label="已拒绝" value="rejected" />
        <el-option label="已过期" value="expired" />
      </el-select>
      <el-select v-model="filterOrderType" placeholder="订单类型" clearable style="width: 150px" @change="loadOrders">
        <el-option label="买入" value="buy" />
        <el-option label="卖出" value="sell" />
      </el-select>
      <el-input v-model="filterSymbol" placeholder="股票代码" clearable style="width: 150px" @keyup.enter="loadOrders" />
    </div>

    <el-card>
      <el-table :data="orders" style="width: 100%" v-loading="loading" stripe>
        <el-table-column prop="order_no" label="订单号" width="200" />
        <el-table-column prop="symbol" label="代码" width="100" />
        <el-table-column prop="name" label="名称" width="120" show-overflow-tooltip />
        <el-table-column prop="order_type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.order_type === 'buy' ? 'success' : 'danger'" size="small">
              {{ row.order_type === 'buy' ? '买入' : '卖出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="order_subtype" label="子类型" width="100">
          <template #default="{ row }">
            {{ getSubtypeName(row.order_subtype) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">
            {{ formatPrice(row.price) }}
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="100">
          <template #default="{ row }">
            {{ formatNumber(row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column prop="filled_quantity" label="已成交" width="100">
          <template #default="{ row }">
            {{ formatNumber(row.filled_quantity || 0) }}
          </template>
        </el-table-column>
        <el-table-column prop="filled_price" label="成交价" width="100">
          <template #default="{ row }">
            {{ formatPrice(row.filled_price) }}
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="成交金额" width="120">
          <template #default="{ row }">
            {{ formatMoney((row.filled_quantity || 0) * (row.filled_price || row.price || 0)) }}
          </template>
        </el-table-column>
        <el-table-column prop="commission" label="佣金" width="100">
          <template #default="{ row }">
            {{ formatMoney(row.commission) }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button 
                text 
                type="warning" 
                size="small" 
                @click="cancelOrder(row)"
                :disabled="!canCancel(row)"
              >
                撤单
              </el-button>
              <el-button text type="info" size="small" @click="viewOrderDetail(row)">详情</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="orders.length === 0 && !loading" description="暂无订单记录" />
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="订单详情" width="600px">
      <el-descriptions :column="2" border v-if="selectedOrder">
        <el-descriptions-item label="订单号" :span="2">{{ selectedOrder.order_no }}</el-descriptions-item>
        <el-descriptions-item label="股票代码">{{ selectedOrder.symbol }}</el-descriptions-item>
        <el-descriptions-item label="股票名称">{{ selectedOrder.name }}</el-descriptions-item>
        <el-descriptions-item label="订单类型">
          <el-tag :type="selectedOrder.order_type === 'buy' ? 'success' : 'danger'" size="small">
            {{ selectedOrder.order_type === 'buy' ? '买入' : '卖出' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <el-tag :type="getStatusTagType(selectedOrder.status)" size="small">
            {{ getStatusName(selectedOrder.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="订单子类型">{{ getSubtypeName(selectedOrder.order_subtype) }}</el-descriptions-item>
        <el-descriptions-item label="触发价格">{{ formatPrice(selectedOrder.trigger_price) }}</el-descriptions-item>
        <el-descriptions-item label="下单价格">{{ formatPrice(selectedOrder.price) }}</el-descriptions-item>
        <el-descriptions-item label="下单数量">{{ formatNumber(selectedOrder.quantity) }}</el-descriptions-item>
        <el-descriptions-item label="已成交数量">{{ formatNumber(selectedOrder.filled_quantity || 0) }}</el-descriptions-item>
        <el-descriptions-item label="成交价格">{{ formatPrice(selectedOrder.filled_price) }}</el-descriptions-item>
        <el-descriptions-item label="成交金额">{{ formatMoney((selectedOrder.filled_quantity || 0) * (selectedOrder.filled_price || selectedOrder.price || 0)) }}</el-descriptions-item>
        <el-descriptions-item label="佣金">{{ formatMoney(selectedOrder.commission) }}</el-descriptions-item>
        <el-descriptions-item label="印花税">{{ formatMoney(selectedOrder.tax) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(selectedOrder.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatTime(selectedOrder.submitted_at) }}</el-descriptions-item>
        <el-descriptions-item label="成交时间">{{ formatTime(selectedOrder.filled_at) }}</el-descriptions-item>
        <el-descriptions-item label="撤销时间">{{ formatTime(selectedOrder.cancelled_at) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ selectedOrder.notes || '无' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="partialFillDialogVisible" title="部分成交" width="400px">
      <el-form :model="partialFillForm" :rules="partialFillRules" ref="partialFillFormRef" label-width="100px">
        <el-form-item label="股票">
          <el-tag size="large">{{ partialFillForm.symbol }} - {{ partialFillForm.name }}</el-tag>
        </el-form-item>
        <el-form-item label="成交价格" prop="price">
          <el-input-number v-model="partialFillForm.price" :precision="2" :min="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="成交数量" prop="quantity">
          <el-input-number v-model="partialFillForm.quantity" :min="1" :max="partialFillForm.maxQuantity" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="partialFillDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPartialFill">确认成交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { tradingApi, tradingDayApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const loading = ref(false)
const tradingDays = ref([])
const selectedTradingDayId = ref(null)
const filterStatus = ref('')
const filterOrderType = ref('')
const filterSymbol = ref('')
const orders = ref([])

const detailDialogVisible = ref(false)
const selectedOrder = ref(null)

const partialFillDialogVisible = ref(false)
const partialFillFormRef = ref(null)
const partialFillForm = ref({
  symbol: '',
  name: '',
  price: 0,
  quantity: 0,
  maxQuantity: 0
})
const partialFillRules = {
  price: [{ required: true, message: '请输入成交价格', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入成交数量', trigger: 'blur' }]
}

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

function formatTime(value) {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

function getSubtypeName(subtype) {
  const map = {
    limit: '限价单',
    market: '市价单',
    stop_loss: '止损单',
    take_profit: '止盈单'
  }
  return map[subtype] || subtype
}

function getStatusName(status) {
  const map = {
    pending: '待提交',
    submitted: '已提交',
    partially_filled: '部分成交',
    filled: '已成交',
    cancelled: '已撤单',
    rejected: '已拒绝',
    expired: '已过期'
  }
  return map[status] || status
}

function getStatusTagType(status) {
  const map = {
    pending: 'info',
    submitted: 'warning',
    partially_filled: 'warning',
    filled: 'success',
    cancelled: 'info',
    rejected: 'danger',
    expired: 'info'
  }
  return map[status] || 'info'
}

function canCancel(order) {
  return order.status === 'pending' || order.status === 'submitted' || order.status === 'partially_filled'
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

async function loadOrders() {
  if (!selectedTradingDayId.value) return
  try {
    loading.value = true
    const res = await tradingApi.getOrders({
      trading_day_id: selectedTradingDayId.value,
      status: filterStatus.value || undefined,
      order_type: filterOrderType.value || undefined,
      symbol: filterSymbol.value || undefined,
      pageSize: 200
    })
    orders.value = res.data?.list || []
  } catch (error) {
    console.error('加载订单失败:', error)
  } finally {
    loading.value = false
  }
}

function viewOrderDetail(order) {
  selectedOrder.value = order
  detailDialogVisible.value = true
}

async function cancelOrder(order) {
  if (!canCancel(order)) {
    ElMessage.warning('该订单无法撤单')
    return
  }
  
  ElMessageBox.confirm(
    `确定要撤销订单 ${order.order_no} 吗？`,
    '撤单确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await tradingApi.cancelOrder(order.id)
      ElMessage.success('撤单成功')
      await loadOrders()
    } catch (error) {
      console.error('撤单失败:', error)
    }
  }).catch(() => {})
}

async function refresh() {
  await loadOrders()
}

async function submitPartialFill() {
  if (!partialFillFormRef.value) return
  await partialFillFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await tradingApi.executePartialFill(selectedOrder.value.id, partialFillForm.value)
        ElMessage.success('部分成交成功')
        partialFillDialogVisible.value = false
        await loadOrders()
      } catch (error) {
        console.error('部分成交失败:', error)
      }
    }
  })
}

onMounted(async () => {
  await loadTradingDays()
  if (selectedTradingDayId.value) {
    await loadOrders()
  }
})
</script>

<style scoped>
.orders {
  height: 100%;
}
</style>
