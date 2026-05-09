<template>
  <div>
    <div class="page-header">
      <div class="filter-bar" style="width: 100%;">
        <el-select v-model="filters.status" placeholder="设备状态" clearable style="width: 150px;" @change="loadDevices">
          <el-option label="全部" value="" />
          <el-option label="可用" value="available" />
          <el-option label="借用中" value="borrowed" />
        </el-select>
        <el-select v-model="filters.category" placeholder="设备分类" clearable style="width: 150px;" @change="loadDevices">
          <el-option label="全部" value="" />
          <el-option label="笔记本电脑" value="laptop" />
          <el-option label="台式机" value="desktop" />
          <el-option label="显示器" value="monitor" />
          <el-option label="外设" value="peripheral" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-input v-model="searchKeyword" placeholder="搜索设备名称或编号" style="width: 250px;" clearable @clear="loadDevices" @keyup.enter="loadDevices" />
        <el-button type="primary" @click="loadDevices">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button type="success" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新增设备
        </el-button>
      </div>
    </div>

    <el-card>
      <el-table :data="devices" v-loading="loading" stripe @row-dblclick="viewDeviceHistory">
        <el-table-column prop="device_code" label="设备编号" width="150" />
        <el-table-column prop="name" label="设备名称" />
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ getCategoryText(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="位置" width="150" />
        <el-table-column prop="condition" label="状况" width="100">
          <template #default="{ row }">
            <el-tag :type="getConditionType(row.condition)" size="small">
              {{ getConditionText(row.condition) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button type="primary" link size="small" @click="editDevice(row)">
                编辑
              </el-button>
              <el-button
                type="warning"
                link
                size="small"
                :disabled="row.status !== 'available'"
                @click="borrowDevice(row)"
              >
                借用
              </el-button>
              <el-button
                type="danger"
                link
                size="small"
                :disabled="row.status === 'borrowed'"
                @click="deleteDevice(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end;"
        @size-change="loadDevices"
        @current-change="loadDevices"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="设备编号" prop="device_code">
          <el-input v-model="form.device_code" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="设备名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="设备分类" prop="category">
          <el-select v-model="form.category" style="width: 100%;">
            <el-option label="笔记本电脑" value="laptop" />
            <el-option label="台式机" value="desktop" />
            <el-option label="显示器" value="monitor" />
            <el-option label="外设" value="peripheral" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="存放位置">
          <el-input v-model="form.location" />
        </el-form-item>
        <el-form-item label="设备状况" v-if="isEdit">
          <el-select v-model="form.condition" style="width: 100%;">
            <el-option label="全新" value="new" />
            <el-option label="良好" value="good" />
            <el-option label="一般" value="fair" />
            <el-option label="故障" value="broken" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDevice">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="borrowDialogVisible" title="借用设备" width="500px">
      <el-form :model="borrowForm" :rules="borrowRules" ref="borrowFormRef" label-width="100px">
        <el-form-item label="设备名称">
          <el-input v-model="selectedDevice?.name" disabled />
        </el-form-item>
        <el-form-item label="借用用途" prop="purpose">
          <el-input v-model="borrowForm.purpose" type="textarea" :rows="3" placeholder="请填写借用用途" />
        </el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker
            v-model="borrowForm.expected_return_date"
            type="datetime"
            placeholder="选择预计归还时间"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="borrowDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="borrowing" @click="confirmBorrow">
          确认借用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDevices, createDevice, updateDevice, deleteDevice } from '@/api/devices'
import { borrowDevice as apiBorrowDevice } from '@/api/borrows'

const router = useRouter()

const loading = ref(false)
const devices = ref([])
const searchKeyword = ref('')
const filters = reactive({
  status: '',
  category: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({
  id: '',
  device_code: '',
  name: '',
  category: 'other',
  description: '',
  location: '',
  condition: 'good',
  version: 0
})

const borrowDialogVisible = ref(false)
const selectedDevice = ref(null)
const borrowing = ref(false)
const borrowFormRef = ref(null)
const borrowForm = reactive({
  purpose: '',
  expected_return_date: null
})

const formRules = {
  device_code: [{ required: true, message: '请输入设备编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择设备分类', trigger: 'change' }]
}

const borrowRules = {
  purpose: [{ required: true, message: '请填写借用用途', trigger: 'blur' }]
}

const dialogTitle = computed(() => isEdit.value ? '编辑设备' : '新增设备')

function getCategoryText(category) {
  const texts = {
    laptop: '笔记本电脑',
    desktop: '台式机',
    monitor: '显示器',
    peripheral: '外设',
    other: '其他'
  }
  return texts[category] || category
}

function getStatusType(status) {
  const types = {
    available: 'success',
    borrowed: 'warning',
    maintenance: 'info'
  }
  return types[status] || 'info'
}

function getStatusText(status) {
  const texts = {
    available: '可用',
    borrowed: '借用中',
    maintenance: '维护中'
  }
  return texts[status] || status
}

function getConditionType(condition) {
  const types = {
    new: 'success',
    good: 'primary',
    fair: 'warning',
    broken: 'danger'
  }
  return types[condition] || 'info'
}

function getConditionText(condition) {
  const texts = {
    new: '全新',
    good: '良好',
    fair: '一般',
    broken: '故障'
  }
  return texts[condition] || condition
}

async function loadDevices() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.pageSize,
      ...filters
    }

    const res = await getDevices(params)
    devices.value = res.devices || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('Failed to load devices:', error)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  isEdit.value = false
  Object.assign(form, {
    id: '',
    device_code: '',
    name: '',
    category: 'other',
    description: '',
    location: '',
    condition: 'good'
  })
  dialogVisible.value = true
}

function editDevice(row) {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    device_code: row.device_code,
    name: row.name,
    category: row.category,
    description: row.description,
    location: row.location,
    condition: row.condition,
    version: row.version
  })
  dialogVisible.value = true
}

async function saveDevice() {
  try {
    await formRef.value.validate()
    saving.value = true

    if (isEdit.value) {
      await updateDevice(form.id, {
        name: form.name,
        category: form.category,
        description: form.description,
        location: form.location,
        condition: form.condition
      }, form.version)
      ElMessage.success('设备更新成功')
    } else {
      await createDevice({
        device_code: form.device_code,
        name: form.name,
        category: form.category,
        description: form.description,
        location: form.location
      })
      ElMessage.success('设备创建成功')
    }

    dialogVisible.value = false
    loadDevices()
  } catch (error) {
    console.error('Failed to save device:', error)
  } finally {
    saving.value = false
  }
}

async function deleteDevice(row) {
  try {
    await ElMessageBox.confirm('确定要删除该设备吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deleteDevice(row.id)
    ElMessage.success('设备删除成功')
    loadDevices()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete device:', error)
    }
  }
}

function borrowDevice(row) {
  selectedDevice.value = row
  borrowForm.purpose = ''
  borrowForm.expected_return_date = null
  borrowDialogVisible.value = true
}

async function confirmBorrow() {
  try {
    await borrowFormRef.value.validate()
    borrowing.value = true

    await apiBorrowDevice({
      device_id: selectedDevice.value.id,
      purpose: borrowForm.purpose,
      expected_return_date: borrowForm.expected_return_date
    })

    ElMessage.success('借用成功')
    borrowDialogVisible.value = false
    loadDevices()
  } catch (error) {
    console.error('Failed to borrow device:', error)
  } finally {
    borrowing.value = false
  }
}

function viewDeviceHistory(row) {
  router.push(`/events/device/${row.id}`)
}

import { computed } from 'vue'

onMounted(() => {
  loadDevices()
})
</script>
