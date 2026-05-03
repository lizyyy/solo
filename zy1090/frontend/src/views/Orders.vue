<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">订单管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新建订单
      </el-button>
      <el-button type="success" @click="exportOrdersReport('markdown')">
        <el-icon><Download /></el-icon> 导出 Markdown 报告
      </el-button>
      <el-button type="success" @click="exportOrdersReport('html')">
        <el-icon><Download /></el-icon> 导出 HTML 报告
      </el-button>
    </div>

    <el-card>
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索订单号/客户"
          clearable
          @keyup.enter="loadData"
        />
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable @change="loadData">
          <el-option label="全部" value="" />
          <el-option label="待确认" value="pending" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="已完成" value="completed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-button type="primary" @click="loadData">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="160" />
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column label="订单项" min-width="200">
          <template #default="{ row }">
            <div v-if="row.items?.length">
              <div v-for="item in row.items.slice(0, 2)" :key="item.id" class="status-tag">
                {{ item.productName }} x{{ item.quantity }}
              </div>
              <span v-if="row.items.length > 2" style="color: #909399">...</span>
            </div>
            <span v-else style="color: #909399">-</span>
          </template>
        </el-table-column>
        <el-table-column label="订单金额" width="120">
          <template #default="{ row }">
            ¥{{ row.totalAmount?.toFixed(2) || '0.00' }}
          </template>
        </el-table-column>
        <el-table-column label="成本" width="100">
          <template #default="{ row }">
            ¥{{ row.totalCost?.toFixed(2) || '0.00' }}
          </template>
        </el-table-column>
        <el-table-column label="利润" width="120">
          <template #default="{ row }">
            <span :class="(row.totalAmount - row.totalCost) < 0 ? 'danger-text' : 'success-text'">
              ¥{{ (row.totalAmount - row.totalCost)?.toFixed(2) || '0.00' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="利润率" width="100">
          <template #default="{ row }">
            <span :class="(row.totalAmount - row.totalCost) < 0 ? 'danger-text' : 'success-text'">
              {{ row.totalAmount > 0
                ? (((row.totalAmount - row.totalCost) / row.totalAmount) * 100).toFixed(1)
                : '0' }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="100">
          <template #default="{ row }">
            <el-tag v-if="(row.totalAmount - row.totalCost) < 0" type="danger" size="small">
              亏损
            </el-tag>
            <span v-else style="color: #909399">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="orderDate" label="下单日期" width="120" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="handleView(row)">详情</el-button>
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button
                v-if="row.status === 'pending'"
                link
                type="danger"
                @click="handleCancel(row)"
              >
                取消
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next"
        @size-change="loadData"
        @current-change="loadData"
        style="margin-top: 20px; justify-content: flex-end; display: flex"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑订单' : '新建订单'"
      width="900px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <div class="form-section">
          <h4 class="form-section-title">基本信息</h4>
          <div class="form-row">
            <el-form-item label="客户" prop="customerId">
              <el-select v-model="form.customerId" placeholder="选择客户" filterable style="width: 250px">
                <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="订单日期" prop="orderDate">
              <el-date-picker
                v-model="form.orderDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 220px"
              />
            </el-form-item>
          </div>
          <div class="form-row">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" style="width: 150px">
                <el-option label="待确认" value="pending" />
                <el-option label="已确认" value="confirmed" />
                <el-option label="已完成" value="completed" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
            </el-form-item>
            <el-form-item label="交货日期" prop="deliveryDate">
              <el-date-picker
                v-model="form.deliveryDate"
                type="date"
                placeholder="可选"
                value-format="YYYY-MM-DD"
                style="width: 220px"
              />
            </el-form-item>
          </div>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">
            订单项
            <el-button type="primary" link size="small" @click="addOrderItem">
              <el-icon><Plus /></el-icon> 添加商品
            </el-button>
          </h4>

          <el-table :data="form.items" border size="small">
            <el-table-column label="产品" min-width="200">
              <template #default="{ row, $index }">
                <el-select
                  v-model="row.productId"
                  placeholder="选择产品"
                  filterable
                  style="width: 100%"
                  @change="(val) => handleProductChange(val, $index)"
                >
                  <el-option
                    v-for="p in products"
                    :key="p.id"
                    :label="p.name"
                    :value="p.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="120">
              <template #default="{ row, $index }">
                <el-input-number
                  v-model="row.quantity"
                  :min="1"
                  :precision="0"
                  style="width: 100%"
                  @change="() => calculateItemPrice($index)"
                />
              </template>
            </el-table-column>
            <el-table-column label="单价" width="120">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.unitPrice"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                  @change="calculateQuote"
                />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="120">
              <template #default="{ row }">
                ¥{{ (row.quantity * row.unitPrice).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column label="成本" width="120">
              <template #default="{ row }">
                <span style="color: #909399">
                  ¥{{ (row.estimatedCost || 0).toFixed(2) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ $index }">
                <el-button type="danger" link size="small" @click="removeOrderItem($index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-button
            v-if="form.items.length > 0"
            type="primary"
            plain
            style="margin-top: 16px"
            @click="calculateQuote"
          >
            <el-icon><Calculator /></el-icon> 自动计算报价
          </el-button>
        </div>

        <div v-if="quoteResult" class="form-section">
          <h4 class="form-section-title">报价预览</h4>
          <div class="quote-preview">
            <div class="summary-row">
              <span>总成本预估</span>
              <span>¥{{ quoteResult.totalEstimatedCost?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="summary-row">
              <span>建议报价</span>
              <span class="info-text">¥{{ quoteResult.suggestedPrice?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="summary-row">
              <span>当前报价</span>
              <span>¥{{ quoteResult.currentPrice?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="summary-row">
              <span>利润</span>
              <span :class="quoteResult.margin >= 0 ? 'success-text' : 'danger-text'">
                ¥{{ quoteResult.profit?.toFixed(2) || '0.00' }}
                ({{ quoteResult.margin?.toFixed(1) || '0' }}%)
              </span>
            </div>
          </div>

          <div v-if="quoteResult.warnings?.length > 0" style="margin-top: 16px">
            <div v-for="(w, i) in quoteResult.warnings" :key="i" class="danger-text">
              ⚠️ {{ w.message }}
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">其他信息</h4>
          <el-form-item label="备注" prop="remarks">
            <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="订单备注" />
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="viewDialogVisible" title="订单详情" width="800px">
      <div v-if="currentViewItem" class="card-content">
        <div class="form-section">
          <h4 class="form-section-title">基本信息</h4>
          <div class="form-row">
            <div><span style="color: #909399">订单号：</span>{{ currentViewItem.orderNo }}</div>
            <div><span style="color: #909399">客户：</span>{{ currentViewItem.customerName || '-' }}</div>
            <div><span style="color: #909399">下单日期：</span>{{ currentViewItem.orderDate }}</div>
            <div>
              <span style="color: #909399">状态：</span>
              <el-tag :type="getStatusType(currentViewItem.status)" size="small">
                {{ getStatusText(currentViewItem.status) }}
              </el-tag>
            </div>
          </div>
        </div>

        <el-divider />

        <div v-if="currentViewItem.items?.length" class="form-section">
          <h4 class="form-section-title">订单项</h4>
          <el-table :data="currentViewItem.items" border size="small">
            <el-table-column prop="productName" label="产品名称" />
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column label="单价" width="120">
              <template #default="{ row }">
                ¥{{ row.unitPrice?.toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column label="小计" width="120">
              <template #default="{ row }">
                ¥{{ (row.quantity * row.unitPrice).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column label="成本" width="120">
              <template #default="{ row }">
                ¥{{ row.estimatedCost?.toFixed(2) || '0.00' }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-divider />

        <div class="form-section">
          <h4 class="form-section-title">利润分析</h4>
          <div class="quote-preview">
            <div class="summary-row">
              <span>订单金额</span>
              <span>¥{{ currentViewItem.totalAmount?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="summary-row">
              <span>成本金额</span>
              <span>¥{{ currentViewItem.totalCost?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="summary-row">
              <span>利润</span>
              <span :class="(currentViewItem.totalAmount - currentViewItem.totalCost) >= 0 ? 'success-text' : 'danger-text'">
                ¥{{ (currentViewItem.totalAmount - currentViewItem.totalCost)?.toFixed(2) || '0.00' }}
                ({{ currentViewItem.totalAmount > 0
                  ? (((currentViewItem.totalAmount - currentViewItem.totalCost) / currentViewItem.totalAmount) * 100).toFixed(1)
                  : '0' }}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ordersAPI, customersAPI, productsAPI, exportAPI } from '@/api'

const loading = ref(false)
const submitLoading = ref(false)
const tableData = ref([])
const customers = ref([])
const products = ref([])

const searchKeyword = ref('')
const filterStatus = ref('')
const quoteResult = ref(null)

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const formRef = ref(null)

const viewDialogVisible = ref(false)
const currentViewItem = ref(null)

const form = reactive({
  customerId: null,
  orderDate: new Date().toISOString().split('T')[0],
  deliveryDate: '',
  status: 'pending',
  remarks: '',
  items: []
})

const rules = {
  orderDate: [{ required: true, message: '请选择订单日期', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.pageSize
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await ordersAPI.list(params)
    tableData.value = res.data || []
    pagination.total = res.total || 0
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const loadCustomers = async () => {
  try {
    const res = await customersAPI.list({ limit: 1000 })
    customers.value = res.data || []
  } catch (e) {
    console.error('加载客户失败', e)
  }
}

const loadProducts = async () => {
  try {
    const res = await productsAPI.list({ limit: 1000 })
    products.value = res.data || []
  } catch (e) {
    console.error('加载产品失败', e)
  }
}

const resetForm = () => {
  Object.assign(form, {
    customerId: null,
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    status: 'pending',
    remarks: '',
    items: []
  })
  quoteResult.value = null
}

const addOrderItem = () => {
  form.items.push({
    productId: null,
    quantity: 1,
    unitPrice: 0,
    estimatedCost: 0
  })
}

const removeOrderItem = (index) => {
  form.items.splice(index, 1)
  calculateQuote()
}

const handleProductChange = (productId, index) => {
  if (!productId) return
  const product = products.value.find(p => p.id === productId)
  if (product && form.items[index]) {
    form.items[index].unitPrice = product.suggestedPrice || product.basePrice || 0
    calculateQuote()
  }
}

const calculateItemPrice = (index) => {
  calculateQuote()
}

const calculateQuote = async () => {
  const validItems = form.items.filter(i => i.productId && i.quantity > 0)
  if (validItems.length === 0) {
    quoteResult.value = null
    return
  }

  try {
    const items = validItems.map(i => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice
    }))

    const res = await ordersAPI.calculateQuote({ items })
    quoteResult.value = res.data

    if (res.data.suggestedDetails) {
      res.data.suggestedDetails.forEach((detail, idx) => {
        if (form.items[idx]) {
          form.items[idx].unitPrice = detail.suggestedPrice
          form.items[idx].estimatedCost = detail.estimatedCost
        }
      })
    }
  } catch (e) {
    console.error('计算报价失败', e)
  }
}

const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  resetForm()
  addOrderItem()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(form, {
    customerId: row.customerId,
    orderDate: row.orderDate,
    deliveryDate: row.deliveryDate,
    status: row.status,
    remarks: row.remarks,
    items: row.items?.map(i => ({
      ...i
    })) || []
  })
  quoteResult.value = null
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  if (form.items.length === 0) {
    ElMessage.warning('请至少添加一个订单项')
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      const data = {
        ...form,
        totalAmount: form.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
      }
      if (isEdit.value) {
        await ordersAPI.update(currentId.value, data)
        ElMessage.success('更新成功')
      } else {
        await ordersAPI.create(data)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      loadData()
    } catch (e) {
      console.error('提交失败', e)
    } finally {
      submitLoading.value = false
    }
  })
}

const handleView = (row) => {
  currentViewItem.value = row
  viewDialogVisible.value = true
}

const handleCancel = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要取消订单 "${row.orderNo}" 吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await ordersAPI.update(row.id, { status: 'cancelled' })
    ElMessage.success('已取消')
    loadData()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('取消失败', e)
    }
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    confirmed: 'primary',
    completed: 'success',
    cancelled: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const exportOrdersReport = async (format) => {
  try {
    const res = await exportAPI.ordersReport(format)
    const date = new Date().toISOString().split('T')[0]
    const ext = format === 'html' ? 'html' : 'md'
    const mimeType = format === 'html' ? 'text/html' : 'text/markdown'
    downloadFile(res.data, `订单利润分析报告_${date}.${ext}`, mimeType)
    ElMessage.success('导出报告成功')
  } catch (e) {
    ElMessage.error('导出报告失败')
  }
}

onMounted(() => {
  loadData()
  loadCustomers()
  loadProducts()
})
</script>
