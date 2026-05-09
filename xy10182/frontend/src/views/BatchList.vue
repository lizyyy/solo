<template>
  <div class="batch-list">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="试剂名称/批次号/二维码"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option label="正常库存" value="in_stock" />
            <el-option label="库存不足" value="low_stock" />
            <el-option label="即将过期" value="expiring" />
            <el-option label="已过期" value="expired" />
            <el-option label="已空库" value="empty" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增入库
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px;">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="batchNo" label="批次号" min-width="180" />
        <el-table-column label="试剂信息" min-width="180">
          <template #default="scope">
            <div v-if="scope.row.reagent">
              <div class="reagent-name">{{ scope.row.reagent.name }}</div>
              <div class="reagent-code" style="color: #909399; font-size: 12px;">
                {{ scope.row.reagent.code }} · {{ scope.row.reagent.specification }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="manufacturer" label="生产厂家" min-width="150" />
        <el-table-column prop="expiryDate" label="有效期" width="120" />
        <el-table-column label="库存" width="150">
          <template #default="scope">
            <div>
              <el-progress
                :percentage="Math.round((scope.row.remainingQuantity / scope.row.totalQuantity) * 100)"
                :status="scope.row.status === 'expired' ? 'exception' : ''"
                :stroke-width="8"
              />
              <div class="stock-text">
                剩余 {{ scope.row.remainingQuantity }} / {{ scope.row.totalQuantity }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="storageLocation" label="存储位置" width="120" />
        <el-table-column prop="qrCode" label="二维码" width="150">
          <template #default="scope">
            <el-tag size="small">{{ scope.row.qrCode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" effect="dark">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="viewDetail(scope.row.id)">
              详情
            </el-button>
            <el-button link type="primary" @click="openEditDialog(scope.row)">
              编辑
            </el-button>
            <el-button link type="success" @click="goToScan(scope.row.qrCode)">
              扫码
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑批次' : '新增入库'"
      width="700px"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="试剂" prop="reagentId">
          <el-select v-model="formData.reagentId" placeholder="请选择试剂" filterable style="width: 100%;">
            <el-option
              v-for="reagent in reagentList"
              :key="reagent.id"
              :label="`${reagent.name} (${reagent.code})`"
              :value="reagent.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="批次号" prop="batchNo">
          <el-input v-model="formData.batchNo" placeholder="如：B-20260501-001" :disabled="isEdit" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="生产厂家">
              <el-input v-model="formData.manufacturer" placeholder="生产厂家" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入库数量" prop="totalQuantity">
              <el-input-number v-model="formData.totalQuantity" :min="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="生产日期" prop="productionDate">
              <el-date-picker
                v-model="formData.productionDate"
                type="date"
                placeholder="选择生产日期"
                value-format="YYYY-MM-DD"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效期" prop="expiryDate">
              <el-date-picker
                v-model="formData.expiryDate"
                type="date"
                placeholder="选择有效期"
                value-format="YYYY-MM-DD"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="存储位置">
          <el-input v-model="formData.storageLocation" placeholder="如：A-01-03" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getBatchList, createBatch, updateBatch } from '../api/batch'
import { getReagentList } from '../api/reagent'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const tableData = ref([])
const reagentList = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)

const searchForm = reactive({
  keyword: '',
  status: ''
})

const formData = reactive({
  id: '',
  reagentId: '',
  batchNo: '',
  manufacturer: '',
  productionDate: '',
  expiryDate: '',
  totalQuantity: 1,
  storageLocation: ''
})

const formRules = {
  reagentId: [{ required: true, message: '请选择试剂', trigger: 'change' }],
  batchNo: [{ required: true, message: '请输入批次号', trigger: 'blur' }],
  totalQuantity: [{ required: true, message: '请输入数量', trigger: 'change' }]
}

const statusMap = {
  in_stock: { label: '正常库存', type: 'success' },
  low_stock: { label: '库存不足', type: 'warning' },
  expiring: { label: '即将过期', type: 'warning' },
  expired: { label: '已过期', type: 'danger' },
  empty: { label: '已空库', type: 'info' }
}

function getStatusLabel(status) {
  return statusMap[status]?.label || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getBatchList({
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined
    })
    tableData.value = res.data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function fetchReagents() {
  try {
    const res = await getReagentList({ status: 'active' })
    reagentList.value = res.data || []
  } catch (e) {
    console.error(e)
  }
}

function handleSearch() {
  fetchList()
}

function resetSearch() {
  searchForm.keyword = ''
  searchForm.status = ''
  fetchList()
}

function viewDetail(id) {
  router.push(`/batches/${id}`)
}

function goToScan(qrCode) {
  router.push({ path: '/scan', query: { code: qrCode } })
}

function openCreateDialog() {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  Object.assign(formData, row)
  dialogVisible.value = true
}

function resetForm() {
  formData.id = ''
  formData.reagentId = ''
  formData.batchNo = ''
  formData.manufacturer = ''
  formData.productionDate = ''
  formData.expiryDate = ''
  formData.totalQuantity = 1
  formData.storageLocation = ''
  formRef.value?.resetFields()
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateBatch(formData.id, {
        manufacturer: formData.manufacturer,
        productionDate: formData.productionDate,
        expiryDate: formData.expiryDate,
        storageLocation: formData.storageLocation
      })
      ElMessage.success('更新成功')
    } else {
      await createBatch({ ...formData })
      ElMessage.success('入库成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchList()
  fetchReagents()
})
</script>

<style scoped>
.search-card {
  margin-bottom: 16px;
}

.reagent-name {
  font-weight: 500;
}

.stock-text {
  text-align: center;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
