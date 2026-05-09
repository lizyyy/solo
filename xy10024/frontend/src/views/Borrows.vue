<template>
  <div>
    <div class="page-header">
      <div class="filter-bar" style="width: 100%;">
        <el-select v-model="filters.status" placeholder="借用状态" clearable style="width: 150px;" @change="loadBorrows">
          <el-option label="全部" value="" />
          <el-option label="借用中" value="borrowed" />
          <el-option label="已归还" value="returned" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 280px;"
        />
        <el-button type="primary" @click="loadBorrows">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-dropdown @command="handleExport">
          <el-button type="success">
            <el-icon><Download /></el-icon>
            导出报告
            <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
              <el-dropdown-item command="markdown">导出 Markdown</el-dropdown-item>
              <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-card>
      <el-table :data="borrows" v-loading="loading" stripe @row-dblclick="viewRecordHistory">
        <el-table-column prop="id" label="记录ID" width="220">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.id.substring(0, 12) }}...</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="device_id" label="设备ID" width="220">
          <template #default="{ row }">
            <el-tag size="small">{{ row.device_id.substring(0, 12) }}...</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="borrower_id" label="借用人ID" width="220">
          <template #default="{ row }">
            <el-tag size="small" type="success">{{ row.borrower_id.substring(0, 12) }}...</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="purpose" label="用途" show-overflow-tooltip />
        <el-table-column prop="borrow_date" label="借用时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.borrow_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="expected_return_date" label="预计归还" width="170">
          <template #default="{ row }">
            {{ row.expected_return_date ? formatDate(row.expected_return_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="actual_return_date" label="实际归还" width="170">
          <template #default="{ row }">
            {{ row.actual_return_date ? formatDate(row.actual_return_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="warning"
              link
              size="small"
              :disabled="row.status !== 'borrowed'"
              @click="returnDevice(row)"
            >
              归还
            </el-button>
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
        @size-change="loadBorrows"
        @current-change="loadBorrows"
      />
    </el-card>

    <el-dialog v-model="returnDialogVisible" title="归还设备" width="400px">
      <el-form :model="returnForm" label-width="80px">
        <el-form-item label="归还备注">
          <el-input
            v-model="returnForm.notes"
            type="textarea"
            :rows="3"
            placeholder="请填写归还时的设备状况说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="returning" @click="confirmReturn">
          确认归还
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getBorrowRecords, returnDevice as apiReturnDevice, exportReport } from '@/api/borrows'
import dayjs from 'dayjs'

const router = useRouter()

const loading = ref(false)
const borrows = ref([])
const dateRange = ref([])
const filters = reactive({
  status: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const returnDialogVisible = ref(false)
const selectedRecord = ref(null)
const returning = ref(false)
const returnForm = reactive({
  notes: ''
})

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function getStatusType(status) {
  const types = {
    borrowed: 'warning',
    returned: 'success',
    overdue: 'danger'
  }
  return types[status] || 'info'
}

function getStatusText(status) {
  const texts = {
    borrowed: '借用中',
    returned: '已归还',
    overdue: '已逾期'
  }
  return texts[status] || status
}

async function loadBorrows() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.pageSize,
      ...filters
    }

    const res = await getBorrowRecords(params)
    borrows.value = res.records || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('Failed to load borrow records:', error)
  } finally {
    loading.value = false
  }
}

function returnDevice(row) {
  selectedRecord.value = row
  returnForm.notes = ''
  returnDialogVisible.value = true
}

async function confirmReturn() {
  try {
    returning.value = true
    await apiReturnDevice(selectedRecord.value.id, {
      notes: returnForm.notes
    })
    ElMessage.success('归还成功')
    returnDialogVisible.value = false
    loadBorrows()
  } catch (error) {
    console.error('Failed to return device:', error)
  } finally {
    returning.value = false
  }
}

async function handleExport(format) {
  try {
    const params = {
      format,
      status: filters.status
    }

    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }

    const blob = await exportReport(params)

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    const extensions = {
      excel: 'xlsx',
      markdown: 'md',
      pdf: 'pdf'
    }

    link.download = `borrow_report_${dayjs().format('YYYYMMDD')}.${extensions[format]}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    ElMessage.success('导出成功')
  } catch (error) {
    console.error('Failed to export report:', error)
    ElMessage.error('导出失败')
  }
}

function viewRecordHistory(row) {
  router.push(`/events/borrow/${row.id}`)
}

onMounted(() => {
  loadBorrows()
})
</script>
