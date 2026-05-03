<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">生产管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新建生产批次
      </el-button>
    </div>

    <el-card>
      <div class="search-bar">
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable @change="loadData">
          <el-option label="全部" value="" />
          <el-option label="待开始" value="pending" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="已完成" value="completed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-button type="primary" @click="loadData">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="productionNo" label="生产单号" width="160" />
        <el-table-column prop="productName" label="产品名称" min-width="150" />
        <el-table-column prop="quantity" label="生产数量" width="100" />
        <el-table-column label="成本" width="120">
          <template #default="{ row }">
            ¥{{ row.actualCost?.toFixed(2) || row.estimatedCost?.toFixed(2) || '0.00' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startDate" label="开始日期" width="120" />
        <el-table-column prop="endDate" label="完成日期" width="120" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="handleView(row)">详情</el-button>
              <el-button
                v-if="row.status === 'pending' || row.status === 'in_progress'"
                link
                type="success"
                @click="handleComplete(row)"
              >
                完成
              </el-button>
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
      title="新建生产批次"
      width="800px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <div class="form-section">
          <h4 class="form-section-title">生产信息</h4>
          <div class="form-row">
            <el-form-item label="产品" prop="productId">
              <el-select
                v-model="form.productId"
                placeholder="选择产品"
                filterable
                style="width: 250px"
                @change="handleProductChange"
              >
                <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="生产数量" prop="quantity">
              <el-input-number v-model="form.quantity" :min="1" :precision="0" style="width: 150px" />
            </el-form-item>
          </div>
          <div class="form-row">
            <el-form-item label="计划开始日期" prop="startDate">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 220px"
              />
            </el-form-item>
            <el-form-item label="配方" prop="recipeId">
              <el-select
                v-model="form.recipeId"
                placeholder="选择配方"
                filterable
                style="width: 250px"
                @change="handleRecipeChange"
              >
                <el-option
                  v-for="r in productRecipes"
                  :key="r.id"
                  :label="`${r.version} - ${r.ingredients?.length || 0}种成分`"
                  :value="r.id"
                />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="备注" prop="remarks">
            <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="生产备注" />
          </el-form-item>
        </div>

        <div v-if="selectedRecipe" class="form-section">
          <h4 class="form-section-title">配方预览</h4>
          <el-alert
            v-if="feasibilityCheck.warnings?.length > 0"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
          >
            <template #title>
              <span>生产可行性检查 - 发现 {{ feasibilityCheck.warnings.length }} 个问题</span>
            </template>
            <div v-for="(w, i) in feasibilityCheck.warnings" :key="i" class="danger-text">
              ⚠️ {{ w.message }}
            </div>
          </el-alert>
          <el-alert
            v-else-if="feasibilityCheck.feasible"
            type="success"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
          >
            生产可行，可以开始生产
          </el-alert>

          <el-table :data="form.materialAllocations || []" border size="small">
            <el-table-column prop="materialName" label="材料名称" />
            <el-table-column label="需要量（含损耗）" width="160">
              <template #default="{ row }">
                {{ row.requiredQuantity }} {{ row.unit }}
                <span style="color: #909399; font-size: 12px">(损耗{{ row.wasteRate }}%)</span>
              </template>
            </el-table-column>
            <el-table-column label="分配批次" min-width="200">
              <template #default="{ row, $index }">
                <el-select
                  v-model="row.batchId"
                  placeholder="选择批次"
                  filterable
                  style="width: 100%"
                  @change="(val) => handleBatchChange(val, $index)"
                >
                  <el-option
                    v-for="b in getAvailableBatches(row.materialId)"
                    :key="b.id"
                    :label="`${b.batchNo} - 库存${b.currentQuantity}${b.unit} (¥${b.unitCost}/${b.unit})`"
                    :value="b.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="批次库存" width="120">
              <template #default="{ row }">
                <span :class="row.currentQuantity < row.requiredQuantity ? 'danger-text' : ''">
                  {{ row.currentQuantity }} {{ row.unit }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="单位成本" width="100">
              <template #default="{ row }">
                ¥{{ row.unitCost?.toFixed(4) }}/{{ row.unit }}
              </template>
            </el-table-column>
          </el-table>

          <div v-if="selectedRecipe" class="quote-preview" style="margin-top: 16px">
            <div class="summary-row">
              <span>预估总成本</span>
              <span class="info-text">¥{{ feasibilityCheck.estimatedCost?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="summary-row">
              <span>单位成本</span>
              <span>
                ¥{{ form.quantity > 0 ? (feasibilityCheck.estimatedCost / form.quantity).toFixed(2) : '0.00' }}
              </span>
            </div>
          </div>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">创建生产批次</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="viewDialogVisible" title="生产批次详情" width="800px">
      <div v-if="currentViewItem" class="card-content">
        <div class="form-section">
          <h4 class="form-section-title">基本信息</h4>
          <div class="form-row">
            <div><span style="color: #909399">生产单号：</span>{{ currentViewItem.productionNo }}</div>
            <div><span style="color: #909399">产品：</span>{{ currentViewItem.productName }}</div>
            <div><span style="color: #909399">数量：</span>{{ currentViewItem.quantity }}</div>
            <div>
              <span style="color: #909399">状态：</span>
              <el-tag :type="getStatusType(currentViewItem.status)" size="small">
                {{ getStatusText(currentViewItem.status) }}
              </el-tag>
            </div>
          </div>
        </div>

        <el-divider />

        <div v-if="currentViewItem.materialUsages?.length" class="form-section">
          <h4 class="form-section-title">材料耗用</h4>
          <el-table :data="currentViewItem.materialUsages" border size="small">
            <el-table-column prop="materialName" label="材料名称" />
            <el-table-column prop="batchNo" label="批次号" width="140" />
            <el-table-column label="耗用数量" width="120">
              <template #default="{ row }">
                {{ row.quantity }} {{ row.unit }}
              </template>
            </el-table-column>
            <el-table-column label="单位成本" width="120">
              <template #default="{ row }">
                ¥{{ row.unitCost?.toFixed(4) }}
              </template>
            </el-table-column>
            <el-table-column label="成本" width="100">
              <template #default="{ row }">
                ¥{{ (row.quantity * row.unitCost)?.toFixed(2) }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-divider />

        <div class="form-section">
          <h4 class="form-section-title">成本汇总</h4>
          <div class="quote-preview">
            <div class="summary-row">
              <span>实际成本</span>
              <span>¥{{ currentViewItem.actualCost?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="summary-row">
              <span>预估成本</span>
              <span>¥{{ currentViewItem.estimatedCost?.toFixed(2) || '0.00' }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productionAPI, productsAPI, recipesAPI, materialBatchesAPI } from '@/api'

const loading = ref(false)
const submitLoading = ref(false)
const tableData = ref([])
const products = ref([])
const materialBatches = ref([])

const filterStatus = ref('')

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const dialogVisible = ref(false)
const formRef = ref(null)
const productRecipes = ref([])
const selectedRecipe = ref(null)
const feasibilityCheck = ref({ feasible: false, warnings: [], estimatedCost: 0 })

const viewDialogVisible = ref(false)
const currentViewItem = ref(null)

const form = reactive({
  productId: null,
  quantity: 1,
  startDate: '',
  recipeId: null,
  remarks: '',
  materialAllocations: []
})

const rules = {
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入生产数量', trigger: 'blur' }],
  recipeId: [{ required: true, message: '请选择配方', trigger: 'change' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.pageSize
    }
    if (filterStatus.value) params.status = filterStatus.value
    const res = await productionAPI.list(params)
    tableData.value = res.data || []
    pagination.total = res.total || 0
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
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

const loadMaterialBatches = async () => {
  try {
    const res = await materialBatchesAPI.list({ limit: 1000, status: 'normal' })
    materialBatches.value = res.data || []
  } catch (e) {
    console.error('加载材料批次失败', e)
  }
}

const getAvailableBatches = (materialId) => {
  return materialBatches.value.filter(b => 
    b.materialId === materialId && b.currentQuantity > 0 && !b.isExpired
  )
}

const handleProductChange = async (productId) => {
  form.recipeId = null
  form.materialAllocations = []
  selectedRecipe.value = null
  feasibilityCheck.value = { feasible: false, warnings: [], estimatedCost: 0 }
  
  if (!productId) {
    productRecipes.value = []
    return
  }
  
  try {
    const res = await recipesAPI.getByProduct(productId)
    productRecipes.value = res.data || []
  } catch (e) {
    console.error('加载产品配方失败', e)
  }
}

const handleRecipeChange = async (recipeId) => {
  if (!recipeId || !form.quantity) return
  
  try {
    const recipe = productRecipes.value.find(r => r.id === recipeId)
    selectedRecipe.value = recipe
    
    const checkRes = await productionAPI.checkFeasibility({
      recipeId,
      quantity: form.quantity
    })
    feasibilityCheck.value = checkRes.data
    
    form.materialAllocations = (checkRes.data.requirements || []).map(req => {
      const available = getAvailableBatches(req.materialId)
      const selectedBatch = available.length > 0 ? available[0] : null
      return {
        materialId: req.materialId,
        materialName: req.materialName,
        requiredQuantity: req.requiredQuantity,
        wasteRate: req.wasteRate,
        unit: req.unit,
        batchId: selectedBatch?.id || null,
        currentQuantity: selectedBatch?.currentQuantity || 0,
        unitCost: selectedBatch?.unitCost || 0
      }
    })
  } catch (e) {
    console.error('检查生产可行性失败', e)
  }
}

const handleBatchChange = (batchId, index) => {
  if (!batchId) return
  const batch = materialBatches.value.find(b => b.id === batchId)
  if (batch && form.materialAllocations[index]) {
    form.materialAllocations[index].currentQuantity = batch.currentQuantity
    form.materialAllocations[index].unitCost = batch.unitCost
  }
}

const handleAdd = () => {
  Object.assign(form, {
    productId: null,
    quantity: 1,
    startDate: new Date().toISOString().split('T')[0],
    recipeId: null,
    remarks: '',
    materialAllocations: []
  })
  productRecipes.value = []
  selectedRecipe.value = null
  feasibilityCheck.value = { feasible: false, warnings: [], estimatedCost: 0 }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  const invalidAllocation = form.materialAllocations.find(a => !a.batchId)
  if (invalidAllocation) {
    ElMessage.warning('请为所有材料选择批次')
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      await productionAPI.create(form)
      ElMessage.success('创建成功')
      dialogVisible.value = false
      loadData()
    } catch (e) {
      console.error('提交失败', e)
    } finally {
      submitLoading.value = false
    }
  })
}

const handleView = async (row) => {
  currentViewItem.value = row
  viewDialogVisible.value = true
}

const handleComplete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要完成生产批次 "${row.productionNo}" 吗？完成后将自动扣减材料库存。`, '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await productionAPI.complete(row.id)
    ElMessage.success('生产完成，库存已扣减')
    loadData()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('完成生产失败', e)
    }
  }
}

const handleCancel = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要取消生产批次 "${row.productionNo}" 吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await productionAPI.update(row.id, { status: 'cancelled' })
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
    pending: 'info',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待开始',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

onMounted(() => {
  loadData()
  loadProducts()
  loadMaterialBatches()
})
</script>
