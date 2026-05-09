<template>
  <div>
    <div class="page-header">
      <h2>借用记录</h2>
    </div>

    <div class="table-container">
      <div class="filter-bar">
        <div class="filter-item">
          <label>状态：</label>
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 140px" @change="loadRecords(1)">
            <el-option label="借用中" value="borrowed" />
            <el-option label="已归还" value="returned" />
            <el-option label="逾期" value="overdue" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>开始时间：</label>
          <el-date-picker
            v-model="filters.startTime"
            type="datetime"
            placeholder="选择开始时间"
            style="width: 200px"
            @change="loadRecords(1)"
          />
        </div>
        <div class="filter-item">
          <label>结束时间：</label>
          <el-date-picker
            v-model="filters.endTime"
            type="datetime"
            placeholder="选择结束时间"
            style="width: 200px"
            @change="loadRecords(1)"
          />
        </div>
        <el-button type="primary" @click="loadRecords(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table :data="records" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="deviceCode" label="设备编号" width="120" />
        <el-table-column prop="deviceName" label="设备名称" min-width="150" />
        <el-table-column prop="userName" label="借用人" width="120" />
        <el-table-column prop="purpose" label="用途" min-width="200" show-overflow-tooltip />
        <el-table-column label="借用时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.borrowTime) }}
          </template>
        </el-table-column>
        <el-table-column label="预计归还" width="170">
          <template #default="{ row }">
            {{ formatTime(row.expectedReturnTime) }}
          </template>
        </el-table-column>
        <el-table-column label="实际归还" width="170">
          <template #default="{ row }">
            {{ row.actualReturnTime ? formatTime(row.actualReturnTime) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="['status-tag', `status-${row.status}`]">
              {{ getStatusText(row.status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'borrowed'"
              type="warning"
              size="small"
              @click="openReturnDialog(row)"
            >
              归还
            </el-button>
            <el-button size="small" @click="openDetailDialog(row)">
              详情
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
          @size-change="loadRecords(1)"
          @current-change="loadRecords"
        />
      </div>
    </div>

    <el-dialog
      v-model="detailDialogVisible"
      title="借用记录详情"
      width="600px"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item label="设备编号">{{ currentRecord?.deviceCode }}</el-descriptions-item>
        <el-descriptions-item label="设备名称">{{ currentRecord?.deviceName }}</el-descriptions-item>
        <el-descriptions-item label="借用人">{{ currentRecord?.userName }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <span :class="['status-tag', `status-${currentRecord?.status}`]">
            {{ currentRecord ? getStatusText(currentRecord.status) : '' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="借用用途" :span="2">
          {{ currentRecord?.purpose }}
        </el-descriptions-item>
        <el-descriptions-item label="借用时间">
          {{ currentRecord ? formatTime(currentRecord.borrowTime) : '' }}
        </el-descriptions-item>
        <el-descriptions-item label="预计归还">
          {{ currentRecord ? formatTime(currentRecord.expectedReturnTime) : '' }}
        </el-descriptions-item>
        <el-descriptions-item label="实际归还">
          {{ currentRecord?.actualReturnTime ? formatTime(currentRecord.actualReturnTime) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="版本号">{{ currentRecord?.version }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ currentRecord?.notes || '-' }}
        </el-descriptions-item>
      </el-descriptions>
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
        <el-form-item label="借用人">
          <el-input v-model="returnForm.userName" disabled />
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
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import api from '../utils/api'
import type { BorrowRecord, BorrowStatus } from '../../../shared/types'

const loading = ref(false)
const records = ref<BorrowRecord[]>([])

const filters = reactive({
  status: '',
  startTime: null,
  endTime: null
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const detailDialogVisible = ref(false)
const currentRecord = ref<BorrowRecord | null>(null)

const returnDialogVisible = ref(false)
const returning = ref(false)
const returnForm = reactive({
  borrowRecordId: '',
  deviceName: '',
  userName: '',
  version: 0,
  notes: ''
})

function getStatusText(status: BorrowStatus): string {
  const map: Record<BorrowStatus, string> = {
    pending: '待审批',
    borrowed: '借用中',
    returned: '已归还',
    overdue: '逾期'
  }
  return map[status] || status
}

function formatTime(time: string): string {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

function resetFilters(): void {
  filters.status = ''
  filters.startTime = null
  filters.endTime = null
  loadRecords(1)
}

async function loadRecords(page: number = pagination.page): Promise<void> {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page,
      pageSize: pagination.pageSize
    }
    
    if (filters.status) params.status = filters.status
    if (filters.startTime) params.startTime = dayjs(filters.startTime).toISOString()
    if (filters.endTime) params.endTime = dayjs(filters.endTime).toISOString()

    const result = await api.get('/borrow', params)
    
    records.value = result.items
    pagination.total = result.total
    pagination.page = result.page
  } catch (error: any) {
    ElMessage.error(error.message || '加载借用记录失败')
  } finally {
    loading.value = false
  }
}

function openDetailDialog(record: BorrowRecord): void {
  currentRecord.value = record
  detailDialogVisible.value = true
}

function openReturnDialog(record: BorrowRecord): void {
  returnForm.borrowRecordId = record.id
  returnForm.deviceName = record.deviceName
  returnForm.userName = record.userName
  returnForm.version = record.version
  returnForm.notes = ''
  returnDialogVisible.value = true
}

async function handleReturn(): Promise<void> {
  returning.value = true
  try {
    await api.post('/borrow/return', {
      borrowRecordId: returnForm.borrowRecordId,
      notes: returnForm.notes,
      version: returnForm.version
    })
    ElMessage.success('归还成功')
    returnDialogVisible.value = false
    await loadRecords()
  } catch (error: any) {
    if (error.code === 'OPTIMISTIC_LOCK_ERROR') {
      ElMessage.error('数据已被其他操作修改，请刷新后重试')
    } else if (error.code === 'CONFLICT') {
      ElMessage.error('借用记录状态已改变，请刷新后重试')
    } else {
      ElMessage.error(error.message || '归还失败')
    }
  } finally {
    returning.value = false
  }
}

onMounted(() => {
  loadRecords()
})
</script>
