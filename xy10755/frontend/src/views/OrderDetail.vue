<template>
  <div>
    <el-page-header @back="$router.push('/')" content="订单详情" />
    
    <el-card style="margin-top: 20px;" v-loading="loading">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>订单信息 - {{ order?.order_no }}</span>
          <el-button type="success" @click="splitOrder" :disabled="order?.status !== 'pending'">执行拆单</el-button>
        </div>
      </template>

      <el-descriptions :column="3" border>
        <el-descriptions-item label="订单号">{{ order?.order_no }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ order?.customer_name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(order?.status)">{{ getStatusText(order?.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="收货地址" :span="2">{{ order?.customer_address }}</el-descriptions-item>
        <el-descriptions-item label="版本号">v{{ order?.version }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(order?.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDate(order?.updated_at) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>订单商品行</span>
      </template>
      <el-table :data="orderLines" border>
        <el-table-column prop="sku" label="SKU" width="100" />
        <el-table-column prop="product_name" label="商品名称" width="150" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="unit_price" label="单价" width="100">
          <template #default="{ row }">¥{{ row.unit_price.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="original_input" label="原始输入" min-width="150" />
        <el-table-column prop="processed_result" label="处理结果" min-width="200">
          <template #default="{ row }">
            <el-popover placement="top" width="400" trigger="click">
              <template #reference>
                <el-button type="primary" link size="small">查看</el-button>
              </template>
              <pre style="white-space: pre-wrap; word-break: break-all;">{{ row.processed_result }}</pre>
            </el-popover>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>履约记录</span>
        </div>
      </template>
      <el-table :data="fulfillmentRecords" border>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="warehouse_code" label="仓库编码" width="120" />
        <el-table-column prop="warehouse_name" label="仓库名称" width="150" />
        <el-table-column prop="sku" label="SKU" width="100" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="shipping_fee" label="运费" width="100">
          <template #default="{ row }">¥{{ row.shipping_fee.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="150">
          <template #default="{ row }">
            <el-tag size="small" :type="getFulfillmentStatusType(row.status)">{{ getFulfillmentStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_final" label="最终确认" width="100">
          <template #default="{ row }">
            <el-checkbox :model-value="row.is_final" disabled />
          </template>
        </el-table-column>
        <el-table-column label="处理结果" width="120">
          <template #default="{ row }">
            <el-popover placement="top" width="400" trigger="click">
              <template #reference>
                <el-button type="primary" link size="small">查看</el-button>
              </template>
              <pre style="white-space: pre-wrap; word-break: break-all;">{{ row.shipping_rule_result }}</pre>
            </el-popover>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="showChangeWarehouse(row)" :disabled="row.is_final">换仓</el-button>
            <el-button size="small" type="warning" @click="showCorrectShipping(row)" :disabled="row.is_final">修正运费</el-button>
            <el-button size="small" type="success" @click="finalizeFulfillment(row)" :disabled="row.is_final">最终确认</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>换仓记录（审计日志）</span>
      </template>
      <el-table :data="changeLogs" border>
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="old_warehouse_code" label="原仓库" width="120" />
        <el-table-column prop="new_warehouse_code" label="新仓库" width="120" />
        <el-table-column prop="processed_by" label="操作人" width="120" />
        <el-table-column prop="reason" label="原因/备注" min-width="200" />
      </el-table>
    </el-card>

    <el-dialog v-model="warehouseDialogVisible" title="换仓" width="500px">
      <el-form :model="warehouseForm" label-width="100px">
        <el-form-item label="选择仓库">
          <el-select v-model="warehouseForm.new_warehouse_code" placeholder="选择新仓库">
            <el-option v-for="wh in warehouses" :key="wh.warehouse_code" :label="wh.warehouse_name" :value="wh.warehouse_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="换仓原因">
          <el-input v-model="warehouseForm.reason" type="textarea" :rows="3" placeholder="请说明换仓原因，用于审计追溯" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="warehouseForm.processed_by" placeholder="您的姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="warehouseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmChangeWarehouse">确认换仓</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shippingDialogVisible" title="修正运费" width="500px">
      <el-form :model="shippingForm" label-width="100px">
        <el-form-item label="原运费">
          <el-input :model-value="`¥${shippingForm.old_fee?.toFixed(2)}`" disabled />
        </el-form-item>
        <el-form-item label="新运费">
          <el-input-number v-model="shippingForm.new_shipping_fee" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="修正原因">
          <el-input v-model="shippingForm.reason" type="textarea" :rows="3" placeholder="请说明修正原因，用于审计追溯" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="shippingForm.processed_by" placeholder="您的姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shippingDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCorrectShipping">确认修正</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { orderApi, fulfillmentApi, warehouseApi, changeLogApi } from '../api'

const route = useRoute()
const loading = ref(false)
const order = ref(null)
const orderLines = ref([])
const fulfillmentRecords = ref([])
const changeLogs = ref([])
const warehouses = ref([])

const warehouseDialogVisible = ref(false)
const shippingDialogVisible = ref(false)
const currentFulfillment = ref(null)

const warehouseForm = ref({
  new_warehouse_code: '',
  reason: '',
  processed_by: ''
})

const shippingForm = ref({
  old_fee: 0,
  new_shipping_fee: 0,
  reason: '',
  processed_by: ''
})

const loadDetail = async () => {
  loading.value = true
  try {
    const res = await orderApi.detail(route.params.id)
    order.value = res.data.order
    orderLines.value = res.data.order_lines
    fulfillmentRecords.value = res.data.fulfillment_records
    changeLogs.value = res.data.warehouse_change_logs
  } catch (e) {
    ElMessage.error('加载详情失败')
  } finally {
    loading.value = false
  }
}

const loadWarehouses = async () => {
  try {
    const res = await warehouseApi.list()
    warehouses.value = res.data
  } catch (e) {}
}

const splitOrder = async () => {
  try {
    const idempotencyKey = `${order.value.order_no}-${Date.now()}`
    const res = await orderApi.split({
      order_no: order.value.order_no,
      idempotency_key: idempotencyKey
    })
    ElMessage.success(res.data.message)
    loadDetail()
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || '拆单失败')
  }
}

const showChangeWarehouse = (row) => {
  currentFulfillment.value = row
  warehouseForm.value = {
    new_warehouse_code: '',
    reason: '',
    processed_by: ''
  }
  warehouseDialogVisible.value = true
}

const confirmChangeWarehouse = async () => {
  if (!warehouseForm.value.new_warehouse_code || !warehouseForm.value.reason) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await fulfillmentApi.changeWarehouse({
      fulfillment_record_id: currentFulfillment.value.id,
      ...warehouseForm.value
    })
    ElMessage.success('换仓成功')
    warehouseDialogVisible.value = false
    loadDetail()
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || '换仓失败')
  }
}

const showCorrectShipping = (row) => {
  currentFulfillment.value = row
  shippingForm.value = {
    old_fee: row.shipping_fee,
    new_shipping_fee: row.shipping_fee,
    reason: '',
    processed_by: ''
  }
  shippingDialogVisible.value = true
}

const confirmCorrectShipping = async () => {
  if (!shippingForm.value.reason || !shippingForm.value.processed_by) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await fulfillmentApi.correctShipping({
      fulfillment_record_id: currentFulfillment.value.id,
      new_shipping_fee: shippingForm.value.new_shipping_fee,
      reason: shippingForm.value.reason,
      processed_by: shippingForm.value.processed_by
    })
    ElMessage.success('运费修正成功')
    shippingDialogVisible.value = false
    loadDetail()
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || '修正失败')
  }
}

const finalizeFulfillment = async (row) => {
  try {
    await fulfillmentApi.finalize(row.id)
    ElMessage.success('已最终确认')
    loadDetail()
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || '操作失败')
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    completed: 'success',
    partial_completed: 'info',
    assigned: 'success',
    no_inventory: 'danger',
    shipping_rule_failed: 'danger'
  }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    completed: '已完成',
    partial_completed: '部分完成',
    assigned: '已分配',
    no_inventory: '无库存',
    shipping_rule_failed: '运费规则失败'
  }
  return map[status] || status
}

const getFulfillmentStatusType = (status) => {
  const map = {
    assigned: 'success',
    warehouse_changed: 'info',
    shipping_corrected: 'warning',
    finalized: 'success',
    shipping_rule_failed: 'danger'
  }
  return map[status] || ''
}

const getFulfillmentStatusText = (status) => {
  const map = {
    assigned: '已分配',
    warehouse_changed: '已换仓',
    shipping_corrected: '运费已修正',
    finalized: '已最终确认',
    shipping_rule_failed: '运费规则失败'
  }
  return map[status] || status
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadDetail()
  loadWarehouses()
})
</script>
