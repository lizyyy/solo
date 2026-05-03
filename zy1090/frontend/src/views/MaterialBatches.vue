<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">材料批次管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon> 新增批次
      </el-button>
    </div>

    <el-card>
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索材料名称/批次号"
          clearable
          @keyup.enter="loadData"
        />
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable @change="loadData">
          <el-option label="全部" value="" />
          <el-option label="正常" value="normal" />
          <el-option label="临期" value="expiring" />
          <el-option label="已过期" value="expired" />
          <el-option label="低库存" value="low_stock" />
        </el-select>
        <el-button type="primary" @click="loadData">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="materialName" label="材料名称" min-width="120" />
        <el-table-column prop="batchNo" label="批次号" width="140" />
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
        <el-table-column label="库存" width="140">
          <template #default="{ row }">
            <span :class="row.currentQuantity < (row.safetyStock || 10) ? 'danger-text' : ''">
              {{ row.currentQuantity }} / {{ row.originalQuantity }}
            </span>
            {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="单位成本" width="100">
          <template #default="{ row }">
            ¥{{ row.unitCost?.toFixed(4) }}
          </template>
        </el-table-column>
        <el-table-column prop="expiryDate" label="有效期" width="120">
          <template #default="{ row }">
            <span :class="getExpiryClass(row)">
              {{ row.expiryDate || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isExpired" type="danger" size="small">已过期</el-tag>
            <el-tag v-else-if="row.isExpiring" type="warning" size="small">临期</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="过敏原" min-width="120">
          <template #default="{ row }">
            <div v-if="row.allergens?.length">
              <el-tag
                v-for="allergen in row.allergens"
                :key="allergen"
                type="warning"
                size="small"
                style="margin-right: 4px"
              >
                {{ allergen }}
              </el-tag>
            </div>
            <span v-else style="color: #909399">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="remarks" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="primary" @click="handleTrace(row)">追溯</el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next"
        @size-change="loadData"
        @current-change="loadData"
        style="margin-top: 20px; justify-content: flex-end; display: flex"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑材料批次' : '新增材料批次'"
      width="800px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <div class="form-section">
          <h4 class="form-section-title">基本信息</h4>
          <div class="form-row">
            <el-form-item label="材料" prop="materialId">
              <el-select v-model="form.materialId" placeholder="选择材料" filterable style="width: 220px">
                <el-option v-for="m in materials" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="批次号" prop="batchNo">
              <el-input v-model="form.batchNo" placeholder="如：20240101001" style="width: 220px" />
            </el-form-item>
          </div>
          <div class="form-row">
            <el-form-item label="供应商" prop="supplierId">
              <el-select v-model="form.supplierId" placeholder="选择供应商" filterable clearable style="width: 220px">
                <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="采购日期" prop="purchaseDate">
              <el-date-picker
                v-model="form.purchaseDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 220px"
              />
            </el-form-item>
          </div>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">库存与成本</h4>
          <div class="form-row">
            <el-form-item label="入库数量" prop="originalQuantity">
              <el-input-number v-model="form.originalQuantity" :min="0" :precision="2" style="width: 150px" />
            </el-form-item>
            <el-form-item label="单位" prop="unit">
              <el-select v-model="form.unit" placeholder="选择单位" style="width: 150px">
                <el-option label="克 (g)" value="g" />
                <el-option label="千克 (kg)" value="kg" />
                <el-option label="毫升 (ml)" value="ml" />
                <el-option label="升 (l)" value="l" />
                <el-option label="个" value="piece" />
                <el-option label="套" value="set" />
                <el-option label="盒" value="box" />
              </el-select>
            </el-form-item>
            <el-form-item label="单位成本" prop="unitCost">
              <el-input-number v-model="form.unitCost" :min="0" :precision="4" placeholder="元" style="width: 150px" />
            </el-form-item>
          </div>
          <div class="form-row">
            <el-form-item label="安全库存" prop="safetyStock">
              <el-input-number v-model="form.safetyStock" :min="0" :precision="2" placeholder="低于此值预警" style="width: 150px" />
            </el-form-item>
            <el-form-item label="有效期" prop="expiryDate">
              <el-date-picker
                v-model="form.expiryDate"
                type="date"
                placeholder="可选"
                value-format="YYYY-MM-DD"
                style="width: 220px"
              />
            </el-form-item>
          </div>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">其他信息</h4>
          <div class="form-row">
            <el-form-item label="过敏原" prop="allergens">
              <el-select v-model="form.allergens" multiple placeholder="可多选" style="width: 300px">
                <el-option label="坚果" value="nuts" />
                <el-option label="花生" value="peanut" />
                <el-option label="大豆" value="soy" />
                <el-option label="乳制品" value="dairy" />
                <el-option label="麸质" value="gluten" />
                <el-option label="香精" value="fragrance" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="备注" prop="remarks">
            <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="可选备注信息" />
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

    <el-dialog v-model="traceDialogVisible" title="批次追溯" width="800px">
      <div v-if="traceData" class="card-content">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="form-section-title">材料批次信息</div>
            <div class="form-row">
              <div><span style="color: #909399">材料：</span>{{ traceData.batch.materialName }}</div>
              <div><span style="color: #909399">批次号：</span>{{ traceData.batch.batchNo }}</div>
              <div><span style="color: #909399">供应商：</span>{{ traceData.batch.supplierName || '-' }}</div>
              <div><span style="color: #909399">库存：</span>{{ traceData.batch.currentQuantity }}/{{ traceData.batch.originalQuantity }} {{ traceData.batch.unit }}</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="form-section-title">风险提示</div>
            <div v-if="traceData.warnings?.length">
              <div
                v-for="(w, i) in traceData.warnings"
                :key="i"
                class="danger-text"
              >
                ⚠️ {{ w.message }}
              </div>
            </div>
            <span v-else style="color: #909399">无风险</span>
          </el-col>
        </el-row>

        <el-divider />

        <div class="form-section-title">影响的生产批次 ({{ traceData.affectedProductions?.length || 0 }})</div>
        <el-table v-if="traceData.affectedProductions?.length" :data="traceData.affectedProductions" size="small">
          <el-table-column prop="productionNo" label="生产单号" width="140" />
          <el-table-column prop="productName" label="产品名称" />
          <el-table-column prop="quantity" label="生产数量" width="100" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'completed' ? 'success' : 'warning'" size="small">
                {{ row.status === 'completed' ? '已完成' : '进行中' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else :image-size="60" description="无" />

        <el-divider />

        <div class="form-section-title">影响的订单 ({{ traceData.affectedOrders?.length || 0 }})</div>
        <el-table v-if="traceData.affectedOrders?.length" :data="traceData.affectedOrders" size="small">
          <el-table-column prop="orderNo" label="订单号" width="140" />
          <el-table-column prop="customerName" label="客户" />
          <el-table-column label="金额" width="120">
            <template #default="{ row }">
              ¥{{ row.totalAmount?.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else :image-size="60" description="无" />
      </div>
      <el-empty v-else description="加载中..." />

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="exportTraceReport('markdown')">
            导出 Markdown 报告
          </el-button>
          <el-button type="success" @click="exportTraceReport('html')">
            导出 HTML 报告
          </el-button>
          <el-button @click="traceDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { materialBatchesAPI, materialsAPI, suppliersAPI, exportAPI } from '@/api'

const loading = ref(false)
const submitLoading = ref(false)
const tableData = ref([])
const materials = ref([])
const suppliers = ref([])

const searchKeyword = ref('')
const filterStatus = ref('')

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref(null)
const formRef = ref(null)

const form = reactive({
  materialId: null,
  batchNo: '',
  supplierId: null,
  purchaseDate: '',
  originalQuantity: 0,
  currentQuantity: 0,
  unit: 'g',
  unitCost: 0,
  safetyStock: 10,
  expiryDate: '',
  allergens: [],
  remarks: ''
})

const rules = {
  materialId: [{ required: true, message: '请选择材料', trigger: 'change' }],
  batchNo: [{ required: true, message: '请输入批次号', trigger: 'blur' }],
  originalQuantity: [{ required: true, message: '请输入入库数量', trigger: 'blur' }],
  unit: [{ required: true, message: '请选择单位', trigger: 'change' }],
  unitCost: [{ required: true, message: '请输入单位成本', trigger: 'blur' }]
}

const traceDialogVisible = ref(false)
const traceData = ref(null)
const currentTraceBatch = ref(null)

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.pageSize
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (filterStatus.value) params.status = filterStatus.value

    const res = await materialBatchesAPI.list(params)
    tableData.value = res.data || []
    pagination.total = res.total || 0
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

const loadMaterials = async () => {
  try {
    const res = await materialsAPI.list({ limit: 1000 })
    materials.value = res.data || []
  } catch (e) {
    console.error('加载材料失败', e)
  }
}

const loadSuppliers = async () => {
  try {
    const res = await suppliersAPI.list({ limit: 1000 })
    suppliers.value = res.data || []
  } catch (e) {
    console.error('加载供应商失败', e)
  }
}

const resetSearch = () => {
  searchKeyword.value = ''
  filterStatus.value = ''
  pagination.page = 1
  loadData()
}

const resetForm = () => {
  Object.assign(form, {
    materialId: null,
    batchNo: '',
    supplierId: null,
    purchaseDate: '',
    originalQuantity: 0,
    currentQuantity: 0,
    unit: 'g',
    unitCost: 0,
    safetyStock: 10,
    expiryDate: '',
    allergens: [],
    remarks: ''
  })
}

const handleAdd = () => {
  isEdit.value = false
  currentId.value = null
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  currentId.value = row.id
  Object.assign(form, {
    ...row,
    allergens: row.allergens || []
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      const data = {
        ...form,
        currentQuantity: isEdit.value ? form.currentQuantity : form.originalQuantity
      }
      if (isEdit.value) {
        await materialBatchesAPI.update(currentId.value, data)
        ElMessage.success('更新成功')
      } else {
        await materialBatchesAPI.create(data)
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

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除批次 "${row.batchNo}" 吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await materialBatchesAPI.delete(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('删除失败', e)
    }
  }
}

const handleTrace = async (row) => {
  currentTraceBatch.value = row
  traceDialogVisible.value = true
  traceData.value = null
  try {
    const res = await materialBatchesAPI.trace(row.id)
    traceData.value = res.data
  } catch (e) {
    console.error('加载追溯数据失败', e)
  }
}

const getExpiryClass = (row) => {
  if (row.isExpired) return 'danger-text'
  if (row.isExpiring) return 'warning-text'
  return ''
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

const exportTraceReport = async (format) => {
  if (!currentTraceBatch.value) return
  try {
    const res = await exportAPI.traceReport(currentTraceBatch.value.id, format)
    const date = new Date().toISOString().split('T')[0]
    const ext = format === 'html' ? 'html' : 'md'
    const mimeType = format === 'html' ? 'text/html' : 'text/markdown'
    downloadFile(
      res.data,
      `批次追溯报告_${currentTraceBatch.value.materialName}_${currentTraceBatch.value.batchNo}_${date}.${ext}`,
      mimeType
    )
    ElMessage.success('导出报告成功')
  } catch (e) {
    ElMessage.error('导出报告失败')
  }
}

onMounted(() => {
  loadData()
  loadMaterials()
  loadSuppliers()
})
</script>
