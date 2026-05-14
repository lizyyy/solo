<template>
  <div class="detection-page">
    <h2 class="page-title">漏报检测</h2>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="待确认" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已解决" value="resolved" />
            <el-option label="已忽略" value="dismissed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadDetections">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="detections" stripe v-loading="loading">
        <el-table-column prop="trackingPoint.name" label="埋点名称" width="160" />
        <el-table-column prop="trackingCode" label="埋点编码" width="200" />
        <el-table-column prop="trackingPoint.page" label="所属页面" width="140" />
        <el-table-column prop="session.version" label="版本" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="漏报原因" show-overflow-tooltip />
        <el-table-column prop="detectedAt" label="检测时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.detectedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" type="primary" link size="small" @click="handleConfirm(row.id)">确认漏报</el-button>
            <el-button v-if="row.status === 'confirmed'" type="success" link size="small" @click="handleResolve(row.id)">标记解决</el-button>
            <el-button v-if="row.status !== 'resolved'" type="info" link size="small" @click="handleDismiss(row.id)">忽略</el-button>
            <el-dropdown v-if="row.reviewLogs && row.reviewLogs.length > 0" @command="(cmd) => console.log(cmd)">
              <el-button type="primary" link size="small">复盘日志</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="(log, idx) in row.reviewLogs" :key="idx">
                    <div class="log-item">
                      <div class="log-action">{{ log.action }}</div>
                      <div class="log-reason">{{ log.reason }}</div>
                      <div class="log-meta">{{ log.operator }} · {{ formatDate(log.createdAt) }}</div>
                    </div>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadDetections"
        @current-change="loadDetections"
        class="pagination"
      />
    </el-card>

    <el-dialog v-model="resolveDialogVisible" title="处理漏报" width="600">
      <el-form :model="resolveForm" label-width="100px">
        <el-form-item label="漏报原因">
          <el-input v-model="resolveForm.reason" type="textarea" :rows="3" placeholder="请描述漏报原因" />
        </el-form-item>
        <el-form-item label="解决方案">
          <el-input v-model="resolveForm.resolution" type="textarea" :rows="3" placeholder="请描述解决方案" />
        </el-form-item>
        <el-form-item label="修正步骤">
          <div v-for="(step, idx) in resolveForm.correctionPath" :key="idx" class="step-item">
            <el-input v-model="step.description" placeholder="步骤描述" style="flex: 1" />
            <el-button type="danger" link @click="removeStep(idx)">删除</el-button>
          </div>
          <el-button type="primary" link size="small" @click="addStep">+ 添加步骤</el-button>
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="resolveForm.operator" placeholder="请输入处理人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResolve">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { detectionAPI } from '@/api'

const loading = ref(false)
const detections = ref([])
const resolveDialogVisible = ref(false)
const currentDetectionId = ref(null)
const filters = reactive({ status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const resolveForm = reactive({
  reason: '',
  resolution: '',
  correctionPath: [],
  operator: ''
})

const loadDetections = async () => {
  loading.value = true
  try {
    const res = await detectionAPI.getDetections({
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filters
    })
    detections.value = res.data.data
    pagination.total = res.data.total
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.status = ''
  loadDetections()
}

const handleConfirm = async (id) => {
  try {
    await ElMessageBox.prompt('请描述漏报原因', '确认漏报', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPlaceholder: '漏报原因描述'
    }).then(async ({ value }) => {
      await detectionAPI.confirm(id, { reason: value, operator: '当前用户' })
      ElMessage.success('已确认漏报')
      loadDetections()
    })
  } catch {}
}

const handleResolve = (id) => {
  currentDetectionId.value = id
  resolveForm.reason = ''
  resolveForm.resolution = ''
  resolveForm.correctionPath = [{ description: '' }]
  resolveForm.operator = ''
  resolveDialogVisible.value = true
}

const submitResolve = async () => {
  if (!resolveForm.reason) {
    ElMessage.warning('请填写漏报原因')
    return
  }
  await detectionAPI.resolve(currentDetectionId.value, resolveForm)
  ElMessage.success('已标记为已解决')
  resolveDialogVisible.value = false
  loadDetections()
}

const handleDismiss = async (id) => {
  try {
    await ElMessageBox.prompt('请说明忽略原因', '忽略漏报', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPlaceholder: '原因描述'
    }).then(async ({ value }) => {
      await detectionAPI.dismiss(id, { reason: value, operator: '当前用户' })
      ElMessage.success('已忽略')
      loadDetections()
    })
  } catch {}
}

const addStep = () => {
  resolveForm.correctionPath.push({ description: '' })
}

const removeStep = (idx) => {
  resolveForm.correctionPath.splice(idx, 1)
}

const getStatusType = (status) => {
  const map = { pending: 'warning', confirmed: 'danger', resolved: 'success', dismissed: 'info' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待确认', confirmed: '已确认', resolved: '已解决', dismissed: '已忽略' }
  return map[status] || status
}

const formatDate = (date) => new Date(date).toLocaleString('zh-CN')

onMounted(loadDetections)
</script>

<style scoped>
.detection-page { padding: 0; }
.page-title { font-size: 24px; color: #303133; margin-bottom: 24px; }
.filter-card { margin-bottom: 24px; border-radius: 12px; }
.filter-form { margin: 0; }
.table-card { border-radius: 12px; }
.pagination { margin-top: 24px; text-align: right; }
.step-item { display: flex; gap: 8px; margin-bottom: 8px; }
.log-item { padding: 8px 0; min-width: 300px; }
.log-action { font-weight: 600; font-size: 13px; }
.log-reason { font-size: 12px; color: #606266; margin: 4px 0; }
.log-meta { font-size: 11px; color: #909399; }
</style>
