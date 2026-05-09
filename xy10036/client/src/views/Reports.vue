<template>
  <div>
    <div class="page-header">
      <h2>报表导出</h2>
    </div>

    <div class="table-container">
      <el-card shadow="hover" style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span>借用记录报表</span>
            <el-button type="primary" :loading="exporting" @click="handleExport">
              <el-icon><Download /></el-icon>
              导出 Excel
            </el-button>
          </div>
        </template>

        <div class="filter-bar">
          <div class="filter-item">
            <label>开始时间：</label>
            <el-date-picker
              v-model="filters.startDate"
              type="date"
              placeholder="选择开始日期"
              style="width: 200px"
              value-format="YYYY-MM-DD"
            />
          </div>
          <div class="filter-item">
            <label>结束时间：</label>
            <el-date-picker
              v-model="filters.endDate"
              type="date"
              placeholder="选择结束日期"
              style="width: 200px"
              value-format="YYYY-MM-DD"
            />
          </div>
          <div class="filter-item">
            <label>状态：</label>
            <el-select v-model="filters.status" placeholder="全部" clearable style="width: 140px">
              <el-option label="借用中" value="borrowed" />
              <el-option label="已归还" value="returned" />
              <el-option label="逾期" value="overdue" />
            </el-select>
          </div>
          <el-button type="primary" @click="loadPreview">
            <el-icon><Search /></el-icon>
            预览
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </el-card>

      <el-card shadow="hover">
        <template #header>
          <div class="card-header">
            <span>数据预览</span>
            <el-tag type="info">共 {{ previewTotal }} 条记录</el-tag>
          </div>
        </template>

        <el-table :data="previewData" v-loading="loading" stripe style="width: 100%">
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
        </el-table>
      </el-card>

      <el-card shadow="hover" style="margin-top: 20px">
        <template #header>
          <div class="card-header">
            <span>统计信息</span>
          </div>
        </template>

        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-card">
              <div class="stat-value">{{ statistics.total }}</div>
              <div class="stat-label">总借用次数</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card">
              <div class="stat-value borrowed">{{ statistics.borrowed }}</div>
              <div class="stat-label">借用中</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card">
              <div class="stat-value returned">{{ statistics.returned }}</div>
              <div class="stat-label">已归还</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card">
              <div class="stat-value overdue">{{ statistics.overdue }}</div>
              <div class="stat-label">逾期</div>
            </div>
          </el-col>
        </el-row>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import api from '../utils/api'
import type { BorrowRecord, BorrowStatus } from '../../../shared/types'

const loading = ref(false)
const exporting = ref(false)
const previewData = ref<BorrowRecord[]>([])
const previewTotal = ref(0)

const filters = reactive({
  startDate: '',
  endDate: '',
  status: ''
})

const statistics = reactive({
  total: 0,
  borrowed: 0,
  returned: 0,
  overdue: 0
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
  filters.startDate = ''
  filters.endDate = ''
  filters.status = ''
  loadPreview()
}

function calculateStatistics(records: BorrowRecord[]): void {
  statistics.total = records.length
  statistics.borrowed = records.filter(r => r.status === 'borrowed').length
  statistics.returned = records.filter(r => r.status === 'returned').length
  statistics.overdue = records.filter(r => r.status === 'overdue').length
}

async function loadPreview(): Promise<void> {
  loading.value = true
  try {
    const params: Record<string, any> = {}
    
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate
    if (filters.status) params.status = filters.status

    const records = await api.get<BorrowRecord[]>('/borrow/report', params)
    
    previewData.value = records
    previewTotal.value = records.length
    calculateStatistics(records)
  } catch (error: any) {
    ElMessage.error(error.message || '加载报表数据失败')
  } finally {
    loading.value = false
  }
}

function exportToExcel(): void {
  if (previewData.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  const exportData = previewData.value.map(record => ({
    '设备编号': record.deviceCode,
    '设备名称': record.deviceName,
    '借用人': record.userName,
    '借用用途': record.purpose,
    '借用时间': formatTime(record.borrowTime),
    '预计归还时间': formatTime(record.expectedReturnTime),
    '实际归还时间': record.actualReturnTime ? formatTime(record.actualReturnTime) : '-',
    '状态': getStatusText(record.status),
    '备注': record.notes || ''
  }))

  const worksheet = XLSX.utils.json_to_sheet(exportData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '借用记录')

  const colWidths = [
    { wch: 15 },
    { wch: 20 },
    { wch: 12 },
    { wch: 30 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 10 },
    { wch: 30 }
  ]
  worksheet['!cols'] = colWidths

  const timestamp = dayjs().format('YYYYMMDD_HHmmss')
  XLSX.writeFile(workbook, `借用记录报表_${timestamp}.xlsx`)
}

async function handleExport(): Promise<void> {
  if (previewData.value.length === 0) {
    exporting.value = true
    await loadPreview()
    exporting.value = false
  }
  
  exportToExcel()
  ElMessage.success('报表导出成功')
}

onMounted(() => {
  loadPreview()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
}

.stat-value.borrowed {
  color: #e6a23c;
}

.stat-value.returned {
  color: #409eff;
}

.stat-value.overdue {
  color: #f56c6c;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}
</style>
