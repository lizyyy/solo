<template>
  <div class="task-list-container">
    <el-card class="header-card">
      <div class="header-content">
        <h1>
          <el-icon><Picture /></el-icon>
          图片转码任务控制台
        </h1>
        <el-button type="primary" @click="goToCreate">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </div>
    </el-card>

    <el-card class="filter-card">
      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="排队中" value="queued" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="filters.search"
            placeholder="搜索任务ID、文件名、错误信息"
            clearable
            style="width: 300px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadTasks">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" @click="showExportDialog">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="tasks" v-loading="loading" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="request_id" label="任务ID" width="180" show-overflow-tooltip />
        <el-table-column prop="original_image_name" label="原图名称" width="180" show-overflow-tooltip />
        <el-table-column label="原图尺寸" width="120">
          <template #default="{ row }">
            {{ row.original_width }} x {{ row.original_height }}
          </template>
        </el-table-column>
        <el-table-column label="目标尺寸" width="120">
          <template #default="{ row }">
            {{ row.target_width }} x {{ row.target_height }}
          </template>
        </el-table-column>
        <el-table-column label="水印" width="100">
          <template #default="{ row }">
            <el-tag :type="row.watermark_confirmed ? 'success' : 'warning'" size="small">
              {{ row.watermark_confirmed ? '已确认' : '待确认' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="retry_count" label="重试" width="80" />
        <el-table-column prop="queue_position" label="队列位置" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="goToDetail(row.id)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button
              v-if="!row.watermark_confirmed && row.watermark_config"
              type="success"
              size="small"
              link
              @click="handleConfirmWatermark(row.id)"
            >
              <el-icon><Check /></el-icon>
              确认水印
            </el-button>
            <el-button
              v-if="row.status === 'failed' && row.retry_count < row.max_retries"
              type="warning"
              size="small"
              link
              @click="handleRetry(row.id)"
            >
              <el-icon><RefreshRight /></el-icon>
              重试
            </el-button>
            <el-button
              type="primary"
              size="small"
              link
              @click="handleShowVersions(row.id)"
            >
              <el-icon><DocumentCopy /></el-icon>
              版本
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="filters.page"
        v-model:page-size="filters.page_size"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadTasks"
        @current-change="loadTasks"
        class="pagination"
      />
    </el-card>

    <el-dialog v-model="exportDialogVisible" title="导出任务数据" width="500px">
      <el-form :model="exportFilters" label-width="80px">
        <el-form-item label="状态">
          <el-select v-model="exportFilters.status" placeholder="全部" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="排队中" value="queued" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="exportFilters.start_date"
            type="datetime"
            placeholder="选择开始日期"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="exportFilters.end_date"
            type="datetime"
            placeholder="选择结束日期"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleExport">导出</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="versionsDialogVisible" title="版本历史" width="800px">
      <el-table :data="versions" stripe border>
        <el-table-column prop="version" label="版本号" width="100" />
        <el-table-column prop="request_id" label="任务ID" width="180" />
        <el-table-column prop="original_image_name" label="原图名称" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.id !== currentTaskId"
              type="warning"
              size="small"
              link
              @click="handleRollback(currentTaskId, row.version)"
            >
              回滚到此版本
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Picture, Plus, Search, Download, View, Check, RefreshRight, DocumentCopy
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  getTasks, confirmWatermark, retryTask, getTaskVersions, rollbackTask, exportTasks, downloadExport
} from '@/api/task'

const router = useRouter()
const tasks = ref([])
const versions = ref([])
const total = ref(0)
const loading = ref(false)
const exportDialogVisible = ref(false)
const versionsDialogVisible = ref(false)
const currentTaskId = ref(null)

const filters = reactive({
  status: '',
  search: '',
  page: 1,
  page_size: 20
})

const exportFilters = reactive({
  status: '',
  start_date: '',
  end_date: '',
  created_by: ''
})

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await getTasks(filters)
    tasks.value = res.tasks
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.status = ''
  filters.search = ''
  filters.page = 1
  loadTasks()
}

const goToCreate = () => {
  router.push('/create')
}

const goToDetail = (id) => {
  router.push(`/task/${id}`)
}

const handleConfirmWatermark = async (id) => {
  try {
    await ElMessageBox.confirm('确认水印配置正确？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await confirmWatermark(id)
    ElMessage.success('水印确认成功')
    loadTasks()
  } catch {
  }
}

const handleRetry = async (id) => {
  try {
    await ElMessageBox.confirm('确定要重试此任务？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await retryTask(id)
    ElMessage.success('重试成功')
    loadTasks()
  } catch {
  }
}

const handleShowVersions = async (id) => {
  currentTaskId.value = id
  versionsDialogVisible.value = true
  try {
    versions.value = await getTaskVersions(id)
  } catch {
  }
}

const handleRollback = async (taskId, targetVersion) => {
  try {
    await ElMessageBox.confirm(`确定要回滚到版本 ${targetVersion}？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await rollbackTask(taskId, targetVersion)
    ElMessage.success('回滚成功')
    versionsDialogVisible.value = false
    loadTasks()
  } catch {
  }
}

const showExportDialog = () => {
  exportDialogVisible.value = true
}

const handleExport = async () => {
  try {
    const res = await exportTasks(exportFilters)
    ElMessage.success('导出成功，开始下载')
    downloadExport(res.file_name)
    exportDialogVisible.value = false
  } catch {
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    queued: '',
    processing: 'primary',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    queued: '排队中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.task-list-container {
  padding: 20px;
  max-width: 1800px;
  margin: 0 auto;
}

.header-card {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 24px;
  color: #303133;
  margin: 0;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.table-card {
  min-height: 600px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
