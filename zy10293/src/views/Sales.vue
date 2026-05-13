<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>销售记录</span>
          <el-button type="primary" @click="openDialog">
            <el-icon><Plus /></el-icon>新增销售
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="sale_no" label="销售单号" width="160" />
        <el-table-column prop="product_name" label="产品名称" />
        <el-table-column prop="scheme_name" label="配方方案" />
        <el-table-column prop="customer_name" label="客户" width="120" />
        <el-table-column prop="sale_date" label="销售日期" width="120" />
        <el-table-column prop="quantity" label="数量" width="80" align="right" />
        <el-table-column prop="unit_price" label="单价" width="100" align="right">
          <template #default="{ row }">¥{{ row.unit_price }}</template>
        </el-table-column>
        <el-table-column prop="total_amount" label="金额" width="120" align="right">
          <template #default="{ row }">
            <strong>¥{{ row.total_amount }}</strong>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" />
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新增销售记录" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="产品" required>
          <el-select v-model="form.product_id" placeholder="选择产品" style="width: 100%">
            <el-option
              v-for="p in products"
              :key="p.id"
              :label="`${p.name} (库存: ${p.quantity}${p.unit})`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="form.customer_name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="销售日期" required>
          <el-date-picker v-model="form.sale_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="销售数量" required>
          <el-input-number v-model="form.quantity" :min="1" style="width: 100%" @change="calculateTotal" />
        </el-form-item>
        <el-form-item label="单价" required>
          <el-input-number v-model="form.unit_price" :min="0" :precision="2" style="width: 100%" @change="calculateTotal" />
        </el-form-item>
        <el-form-item label="总金额">
          <strong style="font-size: 18px; color: #F56C6C">¥{{ totalAmount.toFixed(2) }}</strong>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSale">确认销售</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saleApi, productApi } from '../api'

const tableData = ref([])
const products = ref([])
const dialogVisible = ref(false)
const dateRange = ref<string[]>([])

const filters = reactive({
  start_date: '',
  end_date: ''
})

const form = reactive({
  product_id: null as number | null,
  customer_name: '',
  sale_date: '',
  quantity: 1,
  unit_price: 0,
  notes: ''
})

const totalAmount = computed(() => {
  return form.quantity * form.unit_price
})

watch(() => form.product_id, (newId) => {
  if (newId) {
    const product = products.value.find((p: any) => p.id === newId)
    if (product) {
      form.unit_price = product.selling_price || 0
    }
  }
})

const calculateTotal = () => {
  // 自动计算，由computed处理
}

const resetFilters = () => {
  filters.start_date = ''
  filters.end_date = ''
  dateRange.value = []
  loadData()
}

const loadData = async () => {
  try {
    if (dateRange.value && dateRange.value.length === 2) {
      filters.start_date = dateRange.value[0]
      filters.end_date = dateRange.value[1]
    }
    
    const res = await saleApi.list(filters)
    tableData.value = res.data
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const loadProducts = async () => {
  try {
    const res = await productApi.list()
    products.value = res.data
  } catch (e) {
    ElMessage.error('加载产品失败')
  }
}

const openDialog = () => {
  Object.assign(form, {
    product_id: null,
    customer_name: '',
    sale_date: new Date().toISOString().split('T')[0],
    quantity: 1,
    unit_price: 0,
    notes: ''
  })
  dialogVisible.value = true
}

const saveSale = async () => {
  if (!form.product_id || !form.sale_date || !form.quantity || !form.unit_price) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  try {
    await saleApi.create(form)
    ElMessage.success('销售记录创建成功')
    dialogVisible.value = false
    loadData()
    loadProducts() // 刷新库存
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  }
}

onMounted(() => {
  loadData()
  loadProducts()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}
</style>
