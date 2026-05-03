<template>
  <div class="kiln-workbench">
    <div class="workbench-header">
      <div class="header-left">
        <h2>排窑工作台</h2>
        <el-tag type="info">将待排作品分配到烧窑任务中，系统会自动检查兼容性风险</el-tag>
      </div>
      <div class="header-right">
        <el-select v-model="selectedTaskId" placeholder="选择烧窑任务" style="width: 280px" @change="loadTaskData">
          <el-option v-for="task in tasks" :key="task.id" :label="task.name" :value="task.id" />
        </el-select>
        <el-button type="primary" @click="showCreateTask = true">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="card-container left-panel">
          <template #header>
            <div class="panel-header">
              <span>待排作品</span>
              <el-tag :type="pendingArtworks.length > 0 ? 'primary' : 'info'">{{ pendingArtworks.length }} 件</el-tag>
            </div>
          </template>
          
          <div class="filter-bar">
            <el-input v-model="searchKeyword" placeholder="搜索作品名称、客户" clearable style="width: 200px">
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-select v-model="filterDelivery" placeholder="交付日期" clearable style="width: 140px">
              <el-option label="全部" value="" />
              <el-option label="3天内" value="urgent" />
              <el-option label="7天内" value="soon" />
            </el-select>
            <el-button type="primary" link @click="loadPendingArtworks">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>

          <div class="artwork-list" v-loading="loading.pending">
            <div v-for="artwork in filteredArtworks" :key="artwork.id" 
                 class="artwork-item"
                 :class="{ selected: selectedArtworks.includes(artwork.id) }"
                 @click="toggleSelectArtwork(artwork.id)">
              <div class="artwork-info">
                <div class="artwork-name">{{ artwork.name }}</div>
                <div class="artwork-meta">
                  <el-tag size="small" type="info">{{ artwork.clay_name || '未知泥料' }}</el-tag>
                  <el-tag size="small">{{ artwork.glaze_name || '未知釉料' }}</el-tag>
                  <span v-if="artwork.width && artwork.height && artwork.depth" class="size">
                    {{ artwork.width }}×{{ artwork.height }}×{{ artwork.depth }}cm
                  </span>
                </div>
              </div>
              <div class="artwork-status">
                <div v-if="artwork.delivery_date" :class="getDeliveryClass(artwork.delivery_date)">
                  <el-icon><Timer /></el-icon>
                  {{ artwork.delivery_date }}
                </div>
                <el-button type="primary" size="small" @click.stop="addSingleArtwork(artwork)" :disabled="!selectedTaskId">
                  <el-icon><Right /></el-icon>
                  加入
                </el-button>
              </div>
            </div>
            <div v-if="filteredArtworks.length === 0" class="empty-state">
              <el-empty description="暂无待排作品" />
            </div>
          </div>

          <div class="batch-actions" v-if="selectedArtworks.length > 0">
            <span>已选择 {{ selectedArtworks.length }} 件作品</span>
            <el-button type="primary" size="small" @click="batchAddToTask" :disabled="!selectedTaskId">
              批量加入任务
            </el-button>
            <el-button type="default" size="small" @click="selectedArtworks = []">
              取消选择
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="card-container right-panel">
          <template #header>
            <div class="panel-header" v-if="currentTask">
              <div class="task-info">
                <span class="task-name">{{ currentTask.name }}</span>
                <el-tag :type="getTaskStatusType(currentTask.status)">
                  {{ getTaskStatusLabel(currentTask.status) }}
                </el-tag>
              </div>
              <div class="task-actions">
                <el-button type="primary" link @click="validateTask" :loading="loading.validation">
                  <el-icon><Warning /></el-icon>
                  风险检查
                </el-button>
                <el-button type="primary" link @click="exportReport('markdown')">
                  <el-icon><Document /></el-icon>
                  Markdown
                </el-button>
                <el-button type="primary" link @click="exportReport('html')">
                  <el-icon><Picture /></el-icon>
                  HTML
                </el-button>
              </div>
            </div>
            <div v-else class="panel-header">
              <span>请先选择或创建烧窑任务</span>
            </div>
          </template>

          <div v-if="!currentTask" class="no-task-state">
            <el-empty description="请在上方选择或创建烧窑任务" />
          </div>

          <div v-else>
            <div class="task-detail-summary">
              <div class="summary-item">
                <span class="label">窑炉:</span>
                <span class="value">{{ currentTask.kiln_name || '未指定' }}</span>
              </div>
              <div class="summary-item">
                <span class="label">烧成曲线:</span>
                <span class="value">{{ currentTask.curve_name || '未指定' }}</span>
              </div>
              <div class="summary-item">
                <span class="label">作品数:</span>
                <span class="value">{{ taskArtworks.length }} 件</span>
              </div>
            </div>

            <div v-if="validationResult" class="validation-section">
              <div class="section-title">
                <el-icon><Warning /></el-icon>
                风险检查结果
              </div>
              
              <div v-if="validationResult.risks && validationResult.risks.length > 0">
                <div class="risk-group-title error">
                  <el-icon><CircleCloseFilled /></el-icon>
                  严重风险 ({{ validationResult.risks.length }})
                </div>
                <div v-for="(risk, index) in validationResult.risks" :key="`risk-${index}`" class="risk-item error">
                  <div class="risk-artwork">{{ risk.artwork?.name || '未知作品' }}</div>
                  <div class="risk-message">{{ risk.message }}</div>
                </div>
              </div>

              <div v-if="validationResult.warnings && validationResult.warnings.length > 0">
                <div class="risk-group-title warning">
                  <el-icon><WarningFilled /></el-icon>
                  警告 ({{ validationResult.warnings.length }})
                </div>
                <div v-for="(risk, index) in validationResult.warnings" :key="`warning-${index}`" class="risk-item warning">
                  <div class="risk-artwork">{{ risk.artwork?.name || '未知作品' }}</div>
                  <div class="risk-message">{{ risk.message }}</div>
                </div>
              </div>

              <div v-if="validationResult.info && validationResult.info.length > 0">
                <div class="risk-group-title info">
                  <el-icon><InfoFilled /></el-icon>
                  提示信息 ({{ validationResult.info.length }})
                </div>
                <div v-for="(risk, index) in validationResult.info" :key="`info-${index}`" class="risk-item info">
                  <div class="risk-artwork">{{ risk.artwork?.name || '未知作品' }}</div>
                  <div class="risk-message">{{ risk.message }}</div>
                </div>
              </div>

              <div v-if="validationResult.valid && validationResult.risks?.length === 0 && validationResult.warnings?.length === 0" class="validation-success">
                <el-icon><CircleCheckFilled /></el-icon>
                所有检查通过，无风险
              </div>
            </div>

            <div class="section-title">
              <el-icon><List /></el-icon>
              本次烧窑作品
              <el-tag size="small" type="info">{{ taskArtworks.length }} 件</el-tag>
            </div>

            <div class="task-artwork-list" v-loading="loading.taskArtworks">
              <div v-for="artwork in taskArtworks" :key="artwork.id" class="task-artwork-item">
                <div class="artwork-basic">
                  <div class="artwork-name">{{ artwork.name }}</div>
                  <div class="artwork-customer">{{ artwork.customer_name || '-' }}</div>
                </div>
                <div class="artwork-materials">
                  <span class="material">{{ artwork.clay_name || '-' }}</span>
                  <span class="material">{{ artwork.glaze_name || '-' }}</span>
                </div>
                <div class="artwork-actions">
                  <el-button type="danger" size="small" link @click="removeArtwork(artwork)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
              <div v-if="taskArtworks.length === 0" class="empty-state">
                <el-empty description="暂无作品，请从左侧添加" :image-size="80" />
              </div>
            </div>

            <div class="section-title" v-if="taskArtworks.length > 0">
              <el-icon><Clock /></el-icon>
              状态时间线
            </div>
            <div class="timeline-section" v-if="taskHistory.length > 0">
              <el-timeline>
                <el-timeline-item
                  v-for="(item, index) in taskHistory"
                  :key="index"
                  :type="getTimelineType(item.to_status)"
                  :timestamp="formatTimestamp(item.timestamp)"
                  placement="top"
                >
                  <div class="timeline-content">
                    <strong>{{ item.artwork_name }}</strong>: 
                    {{ item.from_status_label ? item.from_status_label + ' → ' : '' }}
                    {{ item.to_status_label }}
                    <span v-if="item.notes" class="timeline-note">（{{ item.notes }}）</span>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showCreateTask" title="新建烧窑任务" width="500px">
      <el-form :model="newTaskForm" label-width="100px">
        <el-form-item label="任务名称" required>
          <el-input v-model="newTaskForm.name" placeholder="如：2026-05-03 釉烧 06号锥" />
        </el-form-item>
        <el-form-item label="窑炉">
          <el-select v-model="newTaskForm.kiln_id" placeholder="选择窑炉" style="width: 100%">
            <el-option v-for="k in kilns" :key="k.id" :label="k.name" :value="k.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="烧成曲线">
          <el-select v-model="newTaskForm.firing_curve_id" placeholder="选择烧成曲线" style="width: 100%">
            <el-option v-for="c in firingCurves" :key="c.id" :label="`${c.name} (${c.type} - ${c.cone})`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划开始">
          <el-date-picker
            v-model="newTaskForm.scheduled_start"
            type="datetime"
            placeholder="选择日期时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newTaskForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateTask = false">取消</el-button>
        <el-button type="primary" @click="createTask" :loading="loading.create">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { 
  Plus, Search, Refresh, Right, Timer, Warning, 
  Document, Picture, List, Clock, Delete,
  CircleCloseFilled, WarningFilled, InfoFilled, CircleCheckFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { artworksApi } from '../api/artworks'
import { firingTasksApi } from '../api/firingTasks'
import { kilnsApi, firingCurvesApi } from '../api/kilns'

const loading = reactive({
  pending: false,
  taskArtworks: false,
  validation: false,
  create: false
})

const tasks = ref([])
const kilns = ref([])
const firingCurves = ref([])
const selectedTaskId = ref(null)
const currentTask = ref(null)
const pendingArtworks = ref([])
const taskArtworks = ref([])
const taskHistory = ref([])
const validationResult = ref(null)

const searchKeyword = ref('')
const filterDelivery = ref('')
const selectedArtworks = ref([])

const showCreateTask = ref(false)
const newTaskForm = reactive({
  name: '',
  kiln_id: null,
  firing_curve_id: null,
  scheduled_start: null,
  notes: ''
})

const filteredArtworks = computed(() => {
  let result = pendingArtworks.value
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(a => 
      a.name?.toLowerCase().includes(keyword) ||
      a.customer_name?.toLowerCase().includes(keyword)
    )
  }
  
  if (filterDelivery.value) {
    const today = new Date()
    result = result.filter(a => {
      if (!a.delivery_date) return false
      const diff = Math.ceil((new Date(a.delivery_date) - today) / (1000 * 60 * 60 * 24))
      if (filterDelivery.value === 'urgent') return diff <= 3
      if (filterDelivery.value === 'soon') return diff <= 7
      return true
    })
  }
  
  return result
})

const getDeliveryClass = (date) => {
  if (!date) return ''
  const today = new Date()
  const diff = Math.ceil((new Date(date) - today) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'delivery-expired'
  if (diff <= 3) return 'delivery-urgent'
  if (diff <= 7) return 'delivery-soon'
  return ''
}

const getTaskStatusType = (status) => {
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

const getTaskStatusLabel = (status) => {
  const labels = {
    planning: '计划中',
    loading: '装窑中',
    firing: '烧成中',
    cooling: '冷却中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return labels[status] || status
}

const getTimelineType = (status) => {
  const types = {
    pending: 'info',
    in_kiln: 'primary',
    firing: 'warning',
    out_kiln: 'success',
    delivered: '',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || ''
}

const formatTimestamp = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-CN')
}

const loadTasks = async () => {
  try {
    const res = await firingTasksApi.getAll()
    tasks.value = res.data
  } catch (error) {
    ElMessage.error('加载烧窑任务失败')
  }
}

const loadPendingArtworks = async () => {
  loading.pending = true
  try {
    const res = await artworksApi.getAll({ status: 'pending' })
    pendingArtworks.value = res.data
  } catch (error) {
    ElMessage.error('加载待排作品失败')
  } finally {
    loading.pending = false
  }
}

const loadTaskData = async () => {
  if (!selectedTaskId.value) {
    currentTask.value = null
    taskArtworks.value = []
    taskHistory.value = []
    validationResult.value = null
    return
  }
  
  try {
    const [taskRes, artworksRes, historyRes] = await Promise.all([
      firingTasksApi.getById(selectedTaskId.value),
      firingTasksApi.getArtworks(selectedTaskId.value),
      firingTasksApi.getHistory(selectedTaskId.value)
    ])
    currentTask.value = taskRes.data
    taskArtworks.value = artworksRes.data
    taskHistory.value = historyRes.data
    validationResult.value = null
  } catch (error) {
    ElMessage.error('加载任务数据失败')
  }
}

const loadKilnsAndCurves = async () => {
  try {
    const [kilnsRes, curvesRes] = await Promise.all([
      kilnsApi.getAll(),
      firingCurvesApi.getAll()
    ])
    kilns.value = kilnsRes.data
    firingCurves.value = curvesRes.data
  } catch (error) {
    console.error('加载窑炉和曲线失败:', error)
  }
}

const toggleSelectArtwork = (id) => {
  const index = selectedArtworks.value.indexOf(id)
  if (index > -1) {
    selectedArtworks.value.splice(index, 1)
  } else {
    selectedArtworks.value.push(id)
  }
}

const addSingleArtwork = async (artwork) => {
  if (!selectedTaskId.value) {
    ElMessage.warning('请先选择烧窑任务')
    return
  }
  
  try {
    await firingTasksApi.addArtwork(selectedTaskId.value, { artwork_id: artwork.id })
    ElMessage.success('作品已添加到任务')
    await Promise.all([loadPendingArtworks(), loadTaskData()])
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '添加失败')
  }
}

const batchAddToTask = async () => {
  if (!selectedTaskId.value) {
    ElMessage.warning('请先选择烧窑任务')
    return
  }
  
  for (const id of selectedArtworks.value) {
    const artwork = pendingArtworks.value.find(a => a.id === id)
    if (artwork) {
      try {
        await firingTasksApi.addArtwork(selectedTaskId.value, { artwork_id: id })
      } catch (error) {
        ElMessage.error(`${artwork.name}: ${error.response?.data?.error || '添加失败'}`)
      }
    }
  }
  
  selectedArtworks.value = []
  await Promise.all([loadPendingArtworks(), loadTaskData()])
  ElMessage.success('批量添加完成')
}

const removeArtwork = async (artwork) => {
  try {
    await firingTasksApi.removeArtwork(selectedTaskId.value, artwork.id)
    ElMessage.success('作品已从任务中移除')
    await Promise.all([loadPendingArtworks(), loadTaskData()])
  } catch (error) {
    ElMessage.error('移除失败')
  }
}

const validateTask = async () => {
  if (!selectedTaskId.value) return
  
  loading.validation = true
  try {
    const res = await firingTasksApi.validate(selectedTaskId.value)
    validationResult.value = res.data
  } catch (error) {
    ElMessage.error('风险检查失败')
  } finally {
    loading.validation = false
  }
}

const exportReport = async (format) => {
  if (!selectedTaskId.value) {
    ElMessage.warning('请先选择烧窑任务')
    return
  }
  
  try {
    const res = await firingTasksApi.exportReport(selectedTaskId.value, format)
    const blob = new Blob([res.data], { 
      type: format === 'markdown' ? 'text/markdown' : 'text/html' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `firing-task-${selectedTaskId.value}.${format === 'markdown' ? 'md' : 'html'}`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const createTask = async () => {
  if (!newTaskForm.name) {
    ElMessage.warning('请输入任务名称')
    return
  }
  
  loading.create = true
  try {
    const res = await firingTasksApi.create({
      ...newTaskForm,
      scheduled_start: newTaskForm.scheduled_start?.toISOString()
    })
    ElMessage.success('任务创建成功')
    showCreateTask.value = false
    await loadTasks()
    selectedTaskId.value = res.data.id
    await loadTaskData()
    
    newTaskForm.name = ''
    newTaskForm.kiln_id = null
    newTaskForm.firing_curve_id = null
    newTaskForm.scheduled_start = null
    newTaskForm.notes = ''
  } catch (error) {
    ElMessage.error('创建失败')
  } finally {
    loading.create = false
  }
}

onMounted(() => {
  loadTasks()
  loadPendingArtworks()
  loadKilnsAndCurves()
})
</script>

<style scoped>
.kiln-workbench {
  min-height: 100%;
}

.workbench-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
}

.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #EBEEF5;
}

.artwork-list {
  max-height: calc(100vh - 380px);
  overflow-y: auto;
}

.artwork-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid #EBEEF5;
  cursor: pointer;
  transition: all 0.2s;
}

.artwork-item:hover {
  border-color: #409EFF;
  background: #f5f7fa;
}

.artwork-item.selected {
  border-color: #409EFF;
  background: #ecf5ff;
}

.artwork-info {
  flex: 1;
}

.artwork-name {
  font-weight: 500;
  margin-bottom: 6px;
}

.artwork-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.artwork-meta .size {
  font-size: 12px;
  color: #909399;
}

.artwork-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.artwork-status div {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.delivery-expired { color: #F56C6C; font-weight: 600; }
.delivery-urgent { color: #E6A23C; font-weight: 600; }
.delivery-soon { color: #E6A23C; }

.batch-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-top: 16px;
}

.task-detail-summary {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  gap: 8px;
}

.summary-item .label {
  color: #909399;
}

.summary-item .value {
  font-weight: 500;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin: 20px 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #EBEEF5;
}

.task-artwork-list {
  max-height: 200px;
  overflow-y: auto;
}

.task-artwork-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 6px;
  background: #fafafa;
}

.task-artwork-item:hover {
  background: #f5f7fa;
}

.artwork-basic .artwork-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.artwork-basic .artwork-customer {
  font-size: 12px;
  color: #909399;
}

.artwork-materials {
  display: flex;
  gap: 8px;
}

.artwork-materials .material {
  font-size: 12px;
  padding: 2px 8px;
  background: #e4e7ed;
  border-radius: 4px;
}

.validation-section {
  margin-bottom: 16px;
}

.risk-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin: 12px 0 8px 0;
}

.risk-group-title.error { color: #F56C6C; }
.risk-group-title.warning { color: #E6A23C; }
.risk-group-title.info { color: #909399; }

.risk-item {
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 6px;
}

.risk-item.error { background: #fef0f0; border-left: 3px solid #F56C6C; }
.risk-item.warning { background: #fdf6ec; border-left: 3px solid #E6A23C; }
.risk-item.info { background: #f4f4f5; border-left: 3px solid #909399; }

.risk-artwork {
  font-weight: 500;
  margin-bottom: 2px;
}

.risk-message {
  font-size: 13px;
  color: #606266;
}

.validation-success {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f0f9eb;
  border-left: 3px solid #67C23A;
  border-radius: 4px;
  color: #67C23A;
  font-weight: 500;
}

.timeline-section {
  max-height: 200px;
  overflow-y: auto;
}

.timeline-content {
  font-size: 13px;
}

.timeline-note {
  color: #909399;
}

.empty-state {
  padding: 20px;
}

.no-task-state {
  padding: 40px 0;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-name {
  font-size: 16px;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.left-panel, .right-panel {
  min-height: calc(100vh - 200px);
}

.left-panel :deep(.el-card__body),
.right-panel :deep(.el-card__body) {
  padding: 16px;
}
</style>
