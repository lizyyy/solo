<template>
  <div>
    <div class="page-header">
      <h2>设备管理</h2>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        添加设备
      </el-button>
    </div>

    <div class="table-container">
      <div class="filter-bar">
        <div class="filter-item">
          <label>状态：</label>
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 140px" @change="loadDevices(1)">
            <el-option label="可用" value="available" />
            <el-option label="借出" value="borrowed" />
            <el-option label="维护中" value="maintenance" />
            <el-option label="停用" value="retired" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>搜索：</label>
          <el-input
            v-model="filters.search"
            placeholder="搜索设备名称、编号、序列号"
            style="width: 250px"
            clearable
            @keyup.enter="loadDevices(1)"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="loadDevices(1)">搜索</el-button>
        </div>
      </div>

      <el-table :data="devices" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="code" label="设备编号" width="120" />
        <el-table-column prop="name" label="设备名称" min-width="150" />
        <el-table-column prop="type" label="设备类型" width="120" />
        <el-table-column prop="model" label="型号" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="['status-tag', `status-${row.status}`]">
              {{ getStatusText(row.status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="当前借用人" width="120">
          <template #default="{ row }">
            {{ row.currentBorrowerName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'available'"
              type="primary"
              size="small"
              @click="openBorrowDialog(row)"
              :loading="borrowingDeviceId === row.id"
            >
              借用
            </el-button>
            <el-button
              v-else-if="row.status === 'borrowed'"
              type="warning"
              size="small"
              @click="openReturnDialog(row)"
            >
              归还
            </el-button>
            <el-button size="small" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button
              v-if="row.status !== 'borrowed'"
              type="danger"
              size="small"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadDevices(1)"
          @current-change="loadDevices"
        />
      </div>
    </div>

    <el-dialog
      v-model="deviceDialogVisible"
      :title="isEdit ? '编辑设备' : '添加设备'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="deviceForm" label-width="100px">
        <el-form-item label="设备编号" required>
          <el-input v-model="deviceForm.code" placeholder="请输入设备编号" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="设备名称" required>
          <el-input v-model="deviceForm.name" placeholder="请输入设备名称" />
        </el-form-item>
        <el-form-item label="设备类型" required>
          <el-select v-model="deviceForm.type" placeholder="请选择设备类型" style="width: 100%">
            <el-option label="投影仪" value="投影仪" />
            <el-option label="笔记本电脑" value="笔记本电脑" />
            <el-option label="相机" value="相机" />
            <el-option label="存储设备" value="存储设备" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="deviceForm.model" placeholder="请输入型号" />
        </el-form-item>
        <el-form-item label="序列号">
          <el-input v-model="deviceForm.serialNumber" placeholder="请输入序列号" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="deviceForm.description" type="textarea" rows="3" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deviceDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleDeviceSubmit">
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="borrowDialogVisible"
      title="借用设备"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="borrowForm" label-width="120px">
        <el-form-item label="设备名称">
          <el-input v-model="borrowForm.deviceName" disabled />
        </el-form-item>
        <el-form-item label="设备编号">
          <el-input v-model="borrowForm.deviceCode" disabled />
        </el-form-item>
        <el-form-item label="借用用途" required>
          <el-input
            v-model="borrowForm.purpose"
            type="textarea"
            rows="3"
            placeholder="请输入借用用途"
          />
        </el-form-item>
        <el-form-item label="预计归还时间" required>
          <el-date-picker
            v-model="borrowForm.expectedReturnTime"
            type="datetime"
            placeholder="选择预计归还时间"
            style="width: 100%"
            :disabled-date="disabledReturnDate"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="borrowDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="borrowing" @click="handleBorrow">
            确认借用
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="returnDialogVisible"
      title="归还设备"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="returnForm" label-width="120px">
        <el-form-item label="设备名称">
          <el-input v-model="returnForm.deviceName" disabled />
        </el-form-item>
        <el-form-item label="当前借用人">
          <el-input v-model="returnForm.borrowerName" disabled />
        </el-form-item>
        <el-form-item label="借用时间">
          <el-input v-model="returnForm.borrowTime" disabled />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="returnForm.notes"
            type="textarea"
            rows="3"
            placeholder="请输入归还备注（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="returnDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="returning" @click="handleReturn">
            确认归还
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import api from '../utils/api'
import type { Device, DeviceStatus } from '../../../shared/types'

const loading = ref(false)
const devices = ref<Device[]>([])
const borrowingDeviceId = ref<string | null>(null)

const filters = reactive({
  status: '',
  search: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const deviceDialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const deviceForm = reactive({
  id: '',
  code: '',
  name: '',
  type: '',
  model: '',
  serialNumber: '',
  description: ''
})

const borrowDialogVisible = ref(false)
const borrowing = ref(false)
const borrowForm = reactive({
  deviceId: '',
  deviceName: '',
  deviceCode: '',
  purpose: '',
  expectedReturnTime: ''
})

const returnDialogVisible = ref(false)
const returning = ref(false)
const returnForm = reactive({
  deviceId: '',
  deviceName: '',
  borrowerName: '',
  borrowTime: '',
  borrowRecordId: '',
  notes: ''
})

function getStatusText(status: DeviceStatus): string {
  const map: Record<DeviceStatus, string> = {
    available: '可用',
    borrowed: '借出',
    maintenance: '维护中',
    retired: '停用'
  }
  return map[status] || status
}

function disabledReturnDate(date: Date): boolean {
  return date.getTime() < Date.now()
}

async function loadDevices(page: number = pagination.page): Promise<void> {
  loading.value = true
  try {
    const result = await api.get('/devices', {
      page,
      pageSize: pagination.pageSize,
      ...(filters.status && { status: filters.status }),
      ...(filters.search && { search: filters.search })
    })
    
    devices.value = result.items
    pagination.total = result.total
    pagination.page = result.page
  } catch (error: any) {
    ElMessage.error(error.message || '加载设备列表失败')
  } finally {
    loading.value = false
  }
}

function openCreateDialog(): void {
  isEdit.value = false
  deviceForm.id = ''
  deviceForm.code = ''
  deviceForm.name = ''
  deviceForm.type = ''
  deviceForm.model = ''
  deviceForm.serialNumber = ''
  deviceForm.description = ''
  deviceDialogVisible.value = true
}

function openEditDialog(device: Device): void {
  isEdit.value = true
  deviceForm.id = device.id
  deviceForm.code = device.code
  deviceForm.name = device.name
  deviceForm.type = device.type
  deviceForm.model = device.model || ''
  deviceForm.serialNumber = device.serialNumber || ''
  deviceForm.description = device.description || ''
  deviceDialogVisible.value = true
}

async function handleDeviceSubmit(): Promise<void> {
  if (!deviceForm.code.trim()) {
    ElMessage.warning('请输入设备编号')
    return
  }
  if (!deviceForm.name.trim()) {
    ElMessage.warning('请输入设备名称')
    return
  }
  if (!deviceForm.type) {
    ElMessage.warning('请选择设备类型')
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await api.put(`/devices/${deviceForm.id}`, {
        name: deviceForm.name,
        type: deviceForm.type,
        model: deviceForm.model,
        serialNumber: deviceForm.serialNumber,
        description: deviceForm.description
      })
      ElMessage.success('设备更新成功')
    } else {
      await api.post('/devices', {
        code: deviceForm.code,
        name: deviceForm.name,
        type: deviceForm.type,
        model: deviceForm.model,
        serialNumber: deviceForm.serialNumber,
        description: deviceForm.description
      })
      ElMessage.success('设备添加成功')
    }
    deviceDialogVisible.value = false
    await loadDevices()
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(device: Device): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除设备"${device.name}"吗？`,
      '确认删除',
      { type: 'warning' }
    )

    await api.delete(`/devices/${device.id}`)
    ElMessage.success('设备删除成功')
    await loadDevices()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

function openBorrowDialog(device: Device): void {
  borrowForm.deviceId = device.id
  borrowForm.deviceName = device.name
  borrowForm.deviceCode = device.code
  borrowForm.purpose = ''
  borrowForm.expectedReturnTime = ''
  borrowDialogVisible.value = true
}

async function handleBorrow(): Promise<void> {
  if (!borrowForm.purpose.trim()) {
    ElMessage.warning('请输入借用用途')
    return
  }
  if (!borrowForm.expectedReturnTime) {
    ElMessage.warning('请选择预计归还时间')
    return
  }

  borrowingDeviceId.value = borrowForm.deviceId
  borrowing.value = true
  try {
    await api.post('/borrow/borrow', {
      deviceId: borrowForm.deviceId,
      purpose: borrowForm.purpose,
      expectedReturnTime: dayjs(borrowForm.expectedReturnTime).toISOString()
    })
    ElMessage.success('借用成功')
    borrowDialogVisible.value = false
    await loadDevices()
  } catch (error: any) {
    if (error.code === 'CONFLICT') {
      ElMessage.error(error.message || '设备可能已被其他人借用，请刷新后重试')
    } else {
      ElMessage.error(error.message || '借用失败')
    }
  } finally {
    borrowing.value = false
    borrowingDeviceId.value = null
  }
}

function openReturnDialog(device: Device): void {
  returnForm.deviceId = device.id
  returnForm.deviceName = device.name
  returnForm.borrowerName = device.currentBorrowerName || '-'
  returnForm.borrowTime = '-'
  returnForm.borrowRecordId = ''
  returnForm.notes = ''
  
  loadBorrowRecord(device.id)
  returnDialogVisible.value = true
}

async function loadBorrowRecord(deviceId: string): Promise<void> {
  try {
    const records = await api.get('/borrow', {
      deviceId,
      status: 'borrowed',
      page: 1,
      pageSize: 1
    })
    
    if (records.items && records.items.length > 0) {
      const record = records.items[0]
      returnForm.borrowTime = dayjs(record.borrowTime).format('YYYY-MM-DD HH:mm:ss')
      returnForm.borrowRecordId = record.id
    }
  } catch (error) {
    console.error('加载借用记录失败', error)
  }
}

async function handleReturn(): Promise<void> {
  if (!returnForm.borrowRecordId) {
    ElMessage.error('未找到有效的借用记录')
    return
  }

  returning.value = true
  try {
    await api.post('/borrow/return', {
      borrowRecordId: returnForm.borrowRecordId,
      notes: returnForm.notes
    })
    ElMessage.success('归还成功')
    returnDialogVisible.value = false
    await loadDevices()
  } catch (error: any) {
    if (error.code === 'CONFLICT') {
      ElMessage.error('借用记录状态已改变，请刷新后重试')
    } else if (error.code === 'OPTIMISTIC_LOCK_ERROR') {
      ElMessage.error('数据已被其他操作修改，请刷新后重试')
    } else {
      ElMessage.error(error.message || '归还失败')
    }
  } finally {
    returning.value = false
  }
}

onMounted(() => {
  loadDevices()
})
</script>
