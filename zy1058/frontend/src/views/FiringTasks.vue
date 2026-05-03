<template>
  <div class="firing-tasks">
    <div class="page-header">
      <h2>烧窑任务</h2>
      <el-button type="primary" @click="$router.push('/workbench')">
        <el-icon><Plus /></el-icon>
        新建任务（去工作台）
      </el-button>
    </div>

    <el-card class="card-container">
      <div class="filter-section">
        <el-form :inline="true" :model="filters">
          <el-form-item label="状态">
            <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px">
              <el-option label="计划中" value="planning" />
              <el-option label="装窑中" value="loading" />
              <el-option label="烧成中" value="firing" />
              <el-option label="冷却中" value="cooling" />
              <el-option label="已完成" value="completed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
          </el-form-item>
          <el-form-item label="窑炉">
            <el-select v-model="filters.kiln_id" placeholder="全部窑炉" clearable style="width: 150px">
              <el-option v-for="k in kilns" :key="k.id" :label="k.name" :value="k.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="时间">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 260px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadTasks">搜索</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table :data="tasks" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="任务名称" min-width="200">
          <template #default="scope">
            <div class="task-name-cell">
              <strong>{{ scope.row.name }}</strong>
              <div v-if="scope.row.notes" class="notes-text">{{ scope.row.notes }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="kiln_name" label="窑炉" width="120" />
        <el-table-column prop="curve_name" label="烧成曲线" width="140">
          <template #default="scope">
            <span v-if="scope.row.curve_name">{{ scope.row.curve_name }}</span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="artwork_count" label="作品数" width="80" align="center">
          <template #default="scope">
            <el-tag size="small" type="info">{{ scope.row.artwork_count }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="计划时间" width="160">
          <template #default="scope">
            <span v-if="scope.row.scheduled_start">
              {{ formatDate(scope.row.scheduled_start) }}
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" link @click="goToWorkbench(scope.row)">
              <el-icon><Edit /></el-icon>
              排窑
            </el-button>
            <el-button type="primary" size="small" link @click="viewDetail(scope.row)">
              <el-icon><View /></el-icon>
              详情
            </el-button>
            <el-button type="primary" size="small" link @click="exportReport(scope.row, 'markdown')">
              <el-icon><Document /></el-icon>
              导出MD
            </el-button>
            <el-button type="primary" size="small" link @click="exportReport(scope.row, 'html')">
              <el-icon><Picture /></el-icon>
              导出HTML
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              link 
              @click="cancelTask(scope.row)"
              :disabled="scope.row.status !== 'planning' && scope.row.status !== 'loading'"
            >
              <el-icon><Delete /></el-icon>
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadTasks"
          @current-change="loadTasks"
        />
      </div>
    </el-card>

    <el-dialog v-model="showDetail" title="任务详情" width="800px">
      <div v-if="currentTask">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务名称">{{ currentTask.name }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentTask.status)">
              {{ getStatusLabel(currentTask.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="窑炉">{{ currentTask.kiln_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="烧成曲线">{{ currentTask.curve_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="计划开始时间">
            {{ formatDate(currentTask.scheduled_start) }}
          </el-descriptions-item>
          <el-descriptions-item label="作品数">
            <el-tag type="info">{{ currentTask.artwork_count }} 件</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentTask.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentTask.notes || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div class="task-artworks" v-if="taskArtworks.length > 0">
          <h4 style="margin: 20px 0 12px 0;">作品列表 ({{ taskArtworks.length }} 件)</h4>
          <el-table :data="taskArtworks" size="small" style="width: 100%">
            <el-table-column prop="name" label="作品名称" />
            <el-table-column prop="customer_name" label="客户" width="100" />
            <el-table-column prop="clay_name" label="泥料" width="100" />
            <el-table-column prop="glaze_name" label="釉料" width="100" />
            <el-table-column prop="delivery_date" label="交付日期" width="120" />
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getArtworkStatusType(scope.row.status)" size="small">
                  {{ getArtworkStatusLabel(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="status-actions" v-if="availableNextStatuses.length > 0">
          <h4 style="margin: 20px 0 12px 0;">状态操作</h4>
          <div class="action-buttons">
            <el-button 
              v-for="nextStatus in availableNextStatuses" 
              :key="nextStatus"
              :type="getStatusButtonType(nextStatus)"
              size="small"
              @click="changeTaskStatus(nextStatus)"
            >
              标记为 {{ getStatusLabel(nextStatus) }}
            </el-button>
          </div>
        </div>

        <div class="history-section" v-if="taskHistory.length > 0">
          <h4 style="margin: 20px 0 12px 0;">状态历史</h4>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in taskHistory"
              :key="index"
              :type="getArtworkStatusType(item.to_status)"
              :timestamp="formatDate(item.timestamp)"
              placement="top"
            >
              <div class="timeline-content">
                <span v-if="item.from_status_label">
                  {{ item.from_status_label }} → 
                </span>
                <strong>{{ item.to_status_label }}</strong>
                <span v-if="item.notes" class="timeline-note">（{{ item.notes }}）</span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Edit, View, Document, Picture, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { firingTasksApi } from '../api/firingTasks'
import { kilnsApi } from '../api/kilns'

const router = useRouter()

const loading = ref(false)
const tasks = ref([])
const kilns = ref([])

const filters = reactive({
  status: '',
  kiln_id: null,
  dateRange: []
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const showDetail = ref(false)
const currentTask = ref(null)
const taskArtworks = ref([])
const taskHistory = ref([])

const TASK_STATUS_FLOW = {
  planning: { label: '计划中', next: ['loading', 'cancelled'] },
  loading: { label: '装窑中', next: ['firing', 'planning', 'cancelled'] },
  firing: { label: '烧成中', next: ['cooling'] },
  cooling: { label: '冷却中', next: ['completed'] },
  completed: { label: '已完成', next: [] },
  cancelled: { label: '已取消', next: [] }
}

const ARTWORK_STATUS_TYPES = {
  pending: { label: '待排', type: 'info' },
  in_kiln: { label: '已入窑', type: 'primary' },
  firing: { label: '烧成中', type: 'warning' },
  out_kiln: { label: '已出窑', type: 'success' },
  delivered: { label: '已交付', type: '' },
  failed: { label: '烧制失败', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' }
}

const availableNextStatuses = computed(() => {
  if (!currentTask.value) return []
  const flow = TASK_STATUS_FLOW[currentTask.value.status]
  return flow ? flow.next : []
})

const getStatusType = (status) => {
  const types = {
    planning: 'info',
    loading: 'primary',
    firing: 'warning',
    cooling: '',
    completed: 'success',
    cancelled: 'info'
  }
  return types[status] || ''
}

const getStatusLabel = (status) => {
  return TASK_STATUS_FLOW[status]?.label || status
}

const getStatusButtonType = (status) => {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'firing') return 'warning'
  return 'primary'
}

const getArtworkStatusType = (status) => {
  return ARTWORK_STATUS_TYPES[status]?.type || ''
}

const getArtworkStatusLabel = (status) => {
  return ARTWORK_STATUS_TYPES[status]?.label || status
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const loadTasks = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.kiln_id) params.kiln_id = filters.kiln_id
    
    const res = await firingTasksApi.getAll(params)
    tasks.value = res.data
    pagination.total = res.data.length
  } catch (error) {
    ElMessage.error('加载任务列表失败')
  } finally {
    loading.value = false
  }
}

const loadKilns = async () => {
  try {
    const res = await kilnsApi.getAll()
    kilns.value = res.data
  } catch (error) {
    console.error('加载窑炉失败:', error)
  }
}

const resetFilters = () => {
  filters.status = ''
  filters.kiln_id = null
  filters.dateRange = []
  loadTasks()
}

const goToWorkbench = (task) => {
  router.push({ path: '/workbench', query: { taskId: task.id } })
}

const viewDetail = async (task) => {
  currentTask.value = task
  showDetail.value = true
  
  try {
    const [detailRes, artworksRes, historyRes] = await Promise.all([
      firingTasksApi.getById(task.id),
      firingTasksApi.getArtworks(task.id),
      firingTasksApi.getHistory(task.id)
    ])
    currentTask.value = detailRes.data
    taskArtworks.value = artworksRes.data
    taskHistory.value = historyRes.data
  } catch (error) {
    console.error('加载详情失败:', error)
  }
}

const exportReport = async (task, format) => {
  try {
    const res = await firingTasksApi.exportReport(task.id, format)
    const blob = new Blob([res.data], { 
      type: format === 'markdown' ? 'text/markdown' : 'text/html' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `firing-task-${task.id}.${format === 'markdown' ? 'md' : 'html'}`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const cancelTask = async (task) => {
  try {
    await ElMessageBox.confirm(`确定要取消任务"${task.name}"吗？`, '确认取消', {
      type: 'warning'
    })
    await firingTasksApi.updateStatus(task.id, 'cancelled')
    ElMessage.success('任务已取消')
    loadTasks()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '取消失败')
    }
  }
}

const changeTaskStatus = async (toStatus) => {
  try {
    await ElMessageBox.confirm(`确定要将任务状态改为"${getStatusLabel(toStatus)}"吗？`, '确认状态变更', {
      type: 'info'
    })
    await firingTasksApi.updateStatus(currentTask.value.id, toStatus)
    ElMessage.success('状态更新成功')
    
    const [detailRes, artworksRes, historyRes] = await Promise.all([
      firingTasksApi.getById(currentTask.value.id),
      firingTasksApi.getArtworks(currentTask.value.id),
      firingTasksApi.getHistory(currentTask.value.id)
    ])
    currentTask.value = detailRes.data
    taskArtworks.value = artworksRes.data
    taskHistory.value = historyRes.data
    loadTasks()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '状态更新失败')
    }
  }
}

onMounted(() => {
  loadTasks()
  loadKilns()
})
</script>

<style scoped>
.firing-tasks {
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.filter-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 6px;
}

.task-name-cell {
  line-height: 1.5;
}

.notes-text {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.text-gray {
  color: #909399;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.timeline-content {
  font-size: 14px;
}

.timeline-note {
  color: #909399;
  font-size: 12px;
}
</style>
