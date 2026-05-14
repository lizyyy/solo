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
          <el-select v-model="form.scheme_id" placeholder="选择已审核的方案" style="width: 100%" @change="loadSchemeItems">
            <el-option
              v-for="s in approvedSchemes"
              :key="s.id"
              :label="`${s.name} - ${s.scheme_no}`"
              :value="s.id"
            />
          </el-select>
          <div class="form-tip">只有审核通过的方案才能用于生产</div>
        </el-form-item>
        
        <el-form-item v-if="schemeItems.length > 0" label="原料清单">
          <table class="material-table">
            <thead>
              <tr>
                <th>原料名称</th>
                <th>配比(%)</th>
                <th>当前库存</th>
                <th>预计用量</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in schemeItems" :key="item.material_id" :class="{ 'low-stock': item.insufficient }">
                <td>{{ item.material_name }} ({{ item.batch_no }})</td>
                <td align="right">{{ item.ratio }}%</td>
                <td align="right">{{ item.stock_quantity }} g</td>
                <td align="right">{{ item.required_qty.toFixed(2) }} g</td>
                <td>
                  <el-tag v-if="item.insufficient" type="danger" size="small">库存不足</el-tag>
                  <el-tag v-else type="success" size="small">充足</el-tag>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="total-usage">预计总用量: {{ totalUsage.toFixed(2) }} g</div>
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
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { productApi, schemeApi } from '../api'

const tableData = ref([])
const approvedSchemes = ref([])
const dialogVisible = ref(false)
const schemeItems = ref<any[]>([])
const currentScheme = ref<any>(null)

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

const baseRatio = computed(() => {
  return schemeItems.value.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
})

const totalUsage = computed(() => {
  if (baseRatio.value === 0) return 0
  return schemeItems.value.reduce((sum, item) => {
    return sum + (Number(item.quantity) / baseRatio.value * form.quantity)
  }, 0)
})

watch(() => form.quantity, () => {
  if (schemeItems.value.length > 0) {
    calculateRequiredQty()
  }
})

const calculateRequiredQty = () => {
  if (baseRatio.value === 0) return
  schemeItems.value.forEach(item => {
    item.required_qty = (Number(item.quantity) / baseRatio.value) * form.quantity
    item.insufficient = Number(item.stock_quantity) < item.required_qty
  })
}

const loadSchemeItems = async (schemeId: number) => {
  if (!schemeId) {
    schemeItems.value = []
    return
  }
  try {
    const res = await schemeApi.get(schemeId)
    currentScheme.value = res.data
    schemeItems.value = res.data.items || []
    calculateRequiredQty()
  } catch (e) {
    ElMessage.error('加载方案明细失败')
  }
}

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
  schemeItems.value = []
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

.material-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.material-table th {
  border: 1px solid #ebeef5;
}

.material-table th,
.material-table td {
  padding: 8px 12px;
  border: 1px solid #ebeef5;
}

.material-table th {
  background: #f5f7fa;
  font-weight: 600;
}

.material-table tr.low-stock {
  background: #fef0f0;
}

.total-usage {
  margin-top: 8px;
  font-size: 13px;
  color: #606266;
  text-align: right;
  font-weight: 600;
}
</style>
