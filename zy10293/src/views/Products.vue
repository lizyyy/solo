<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>成品入库</span>
          <el-button type="primary" @click="openDialog">
            <el-icon><Plus /></el-icon>新增入库
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="product_no" label="产品编号" width="160" />
        <el-table-column prop="name" label="产品名称" />
        <el-table-column prop="scheme_name" label="配方方案" />
        <el-table-column prop="production_date" label="生产日期" width="120" />
        <el-table-column label="库存数量" width="120">
          <template #default="{ row }">
            <span :class="{ 'low-stock': row.quantity < 100 }">
              {{ row.quantity }} {{ row.unit }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="cost_price" label="成本价" width="100">
          <template #default="{ row }">¥{{ row.cost_price }}</template>
        </el-table-column>
        <el-table-column prop="selling_price" label="售价" width="100">
          <template #default="{ row }">¥{{ row.selling_price }}</template>
        </el-table-column>
        <el-table-column label="已售" width="80" align="center">
          <template #default="{ row }">{{ row.sold_quantity || 0 }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag type="success" size="small">在库</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="成品入库" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="产品名称" required>
          <el-input v-model="form.name" placeholder="输入产品名称" />
        </el-form-item>
        <el-form-item label="拼配方案" required>
          <el-select v-model="form.scheme_id" placeholder="选择已审核的方案" style="width: 100%">
            <el-option
              v-for="s in approvedSchemes"
              :key="s.id"
              :label="`${s.name} - ${s.scheme_no}`"
              :value="s.id"
            />
          </el-select>
          <div class="form-tip">只有审核通过的方案才能用于生产</div>
        </el-form-item>
        <el-form-item label="生产日期" required>
          <el-date-picker v-model="form.production_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="入库数量" required>
          <el-input-number v-model="form.quantity" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="form.unit" style="width: 100%">
            <el-option label="g" value="g" />
            <el-option label="kg" value="kg" />
            <el-option label="罐" value="罐" />
            <el-option label="盒" value="盒" />
          </el-select>
        </el-form-item>
        <el-form-item label="成本价">
          <el-input-number v-model="form.cost_price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="销售价">
          <el-input-number v-model="form.selling_price" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProduct">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { productApi, schemeApi } from '../api'

const tableData = ref([])
const approvedSchemes = ref([])
const dialogVisible = ref(false)

const form = reactive({
  name: '',
  scheme_id: null as number | null,
  production_date: '',
  quantity: 0,
  unit: 'g',
  cost_price: 0,
  selling_price: 0,
  notes: ''
})

const loadData = async () => {
  try {
    const res = await productApi.list()
    tableData.value = res.data
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const loadSchemes = async () => {
  try {
    const res = await schemeApi.list({ status: 'approved' })
    approvedSchemes.value = res.data
  } catch (e) {
    ElMessage.error('加载方案失败')
  }
}

const openDialog = () => {
  Object.assign(form, {
    name: '',
    scheme_id: null,
    production_date: new Date().toISOString().split('T')[0],
    quantity: 0,
    unit: 'g',
    cost_price: 0,
    selling_price: 0,
    notes: ''
  })
  dialogVisible.value = true
}

const saveProduct = async () => {
  if (!form.name || !form.scheme_id || !form.production_date || !form.quantity) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  try {
    await productApi.create(form)
    ElMessage.success('入库成功')
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  }
}

onMounted(() => {
  loadData()
  loadSchemes()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.low-stock {
  color: #F56C6C;
  font-weight: 600;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
