<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>订单列表</span>
          <el-button type="primary" @click="showCreateDialog">
            <el-icon><Plus /></el-icon>
            新建订单
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" style="margin-bottom: 20px;">
        <el-form-item label="订单号">
          <el-input v-model="filters.order_no" placeholder="输入订单号" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="已完成" value="completed" />
            <el-option label="部分完成" value="partial_completed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadOrders">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" @click="initSampleData">初始化示例数据</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="orders" border style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="order_no" label="订单号" width="150" />
        <el-table-column prop="customer_name" label="客户名称" width="120" />
        <el-table-column prop="customer_address" label="收货地址" min-width="180" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本号" width="90" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button size="small" type="success" @click="splitOrder(row)" :disabled="row.status !== 'pending'">拆单</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="快速创建订单" width="600px">
      <el-form :model="quickOrder" label-width="100px">
        <el-form-item label="订单号">
          <el-input v-model="quickOrder.order_no" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="quickOrder.customer_name" />
        </el-form-item>
        <el-form-item label="收货地址">
          <el-input v-model="quickOrder.customer_address" placeholder="如：北京市 朝阳区..." />
        </el-form-item>
        <el-form-item label="商品SKU">
          <el-input v-model="quickOrder.sku" placeholder="SKU001, SKU002, SKU003" />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="quickOrder.product_name" />
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="quickOrder.quantity" :min="1" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input-number v-model="quickOrder.unit_price" :min="0" :precision="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="quickCreateOrder">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { orderApi, initApi } from '../api'

const router = useRouter()
const orders = ref([])
const createDialogVisible = ref(false)
const filters = ref({
  order_no: '',
  status: ''
})

const quickOrder = ref({
  order_no: '',
  customer_name: '',
  customer_address: '',
  sku: 'SKU001',
  product_name: '示例商品',
  quantity: 2,
  unit_price: 99.00
})

const loadOrders = async () => {
  try {
    const res = await orderApi.list(filters.value)
    orders.value = res.data
  } catch (e) {
    ElMessage.error('加载订单失败')
  }
}

const resetFilters = () => {
  filters.value = { order_no: '', status: '' }
  loadOrders()
}

const showCreateDialog = () => {
  quickOrder.value.order_no = `ORD${Date.now()}`
  createDialogVisible.value = true
}

const quickCreateOrder = async () => {
  try {
    await orderApi.create({
      order_no: quickOrder.value.order_no,
      customer_name: quickOrder.value.customer_name,
      customer_address: quickOrder.value.customer_address,
      order_lines: [
        {
          sku: quickOrder.value.sku,
          product_name: quickOrder.value.product_name,
          quantity: quickOrder.value.quantity,
          unit_price: quickOrder.value.unit_price
        }
      ]
    })
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    loadOrders()
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || '创建失败')
  }
}

const splitOrder = async (row) => {
  try {
    const idempotencyKey = `${row.order_no}-${Date.now()}`
    const res = await orderApi.split({
      order_no: row.order_no,
      idempotency_key: idempotencyKey
    })
    ElMessage.success(res.data.message)
    loadOrders()
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || '拆单失败')
  }
}

const viewDetail = (row) => {
  router.push(`/order/${row.id}`)
}

const initSampleData = async () => {
  try {
    await initApi.initSample()
    ElMessage.success('初始化成功')
    loadOrders()
  } catch (e) {
    ElMessage.error('初始化失败或已初始化')
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    completed: 'success',
    partial_completed: 'info'
  }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    completed: '已完成',
    partial_completed: '部分完成'
  }
  return map[status] || status
}

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadOrders()
})
</script>
