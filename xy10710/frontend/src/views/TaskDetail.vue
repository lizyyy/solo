<template>
  <div class="task-detail-container">
    <el-card class="header-card">
      <div class="header-content">
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h1>任务详情 - {{ task?.request_id }}</h1>
        <div class="action-buttons">
          <el-button
            v-if="task && !task.watermark_confirmed && task.watermark_config"
            type="success"
            @click="handleConfirmWatermark"
          >
            <el-icon><Check /></el-icon>
            确认水印
          </el-button>
          <el-button
            v-if="task && task.status === 'failed' && task.retry_count < task.max_retries"
            type="warning"
            @click="handleRetry"
          >
            <el-icon><RefreshRight /></el-icon>
            重试任务
          </el-button>
          <el-button type="primary" @click="handleShowVersions">
            <el-icon><DocumentCopy /></el-icon>
            版本历史
          </el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card title="原图信息" class="info-card">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="文件名">
              {{ task?.original_image_name || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="URL">
              <el-link v-if="task?.original_image_url" type="primary" :href="task.original_image_url" target="_blank">
                查看原图
              </el-link>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="尺寸">
              {{ task?.original_width }} x {{ task?.original_height }}
            </el-descriptions-item>
            <el-descriptions-item label="格式">
              {{ task?.original_format || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card title="目标规格" class="info-card">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="目标尺寸">
              {{ task?.target_width }} x {{ task?.target_height }}
            </el-descriptions-item>
            <el-descriptions-item label="目标格式">
              {{ task?.target_format || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="质量">
              {{ task?.target_quality }}
            </el-descriptions-item>
            <el-descriptions-item label="产物URL">
              <el-link v-if="task?.output_url" type="primary" :href="task.output_url" target="_blank">
                下载产物
              </el-link>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card title="水印配置" class="info-card">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="状态">
              <el-tag :type="task?.watermark_confirmed ? 'success' : 'warning'">
                {{ task?.watermark_confirmed ? '已确认' : '待确认' }}
              </el-tag>
            </el-descriptions-item>
            <template v-if="task?.watermark_config">
              <el-descriptions-item label="启用水印">
                {{ task.watermark_config.enabled ? '是' : '否' }}
              </el-descriptions-item>
              <el-descriptions-item label="水印文字">
                {{ task.watermark_config.text || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="位置">
                {{ getWatermarkPositionText(task.watermark_config.position) }}
              </el-descriptions-item>
              <el-descriptions-item label="透明度">
                {{ task.watermark_config.opacity }}
              </el-descriptions-item>
            </template>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card title="任务状态" class="info-card">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="当前状态">
              <el-tag :type="getStatusType(task?.status)" size="large">
                {{ getStatusText(task?.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="队列位置">
              {{ task?.queue_position || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="重试次数">
              {{ task?.retry_count }} / {{ task?.max_retries }}
            </el-descriptions-item>
            <el-descriptions-item label="创建人">
              {{ task?.created_by || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="审批人">
              {{ task?.approved_by || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ formatDate(task?.created_at) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDate(task?.completed_at) || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="版本">
              {{ task?.version }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card title="错误日志" style="margin-top: 20px" v-if="errors.length > 0">
      <el-timeline>
        <el-timeline-item
          v-for="error in errors"
          :key="error.id"
          :timestamp="formatDate(error.created_at)"
          type="danger"
        >
          <el-card shadow="never">
            <h4>重试第 {{ error.retry_attempt }} 次</h4>
            <p style="color: #f56c6c; margin-top: 10px">{{ error.error_message }}</p>
            <el-collapse v-if="error.error_stack" style="margin-top: 10px">
              <el-collapse-item title="查看详细堆栈">
                <pre style="background: #f5f7fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px">
{{ error.error_stack }}
                </pre>
              </el-collapse-item>
            </el-collapse>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>

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
              v-if="row.id !== taskId"
              type="warning"
              size="small"
              link
              @click="handleRollback(row.version)"
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, Check, RefreshRight, DocumentCopy
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  getTaskById, confirmWatermark, retryTask, getTaskVersions, rollbackTask, getTaskErrors
} from '@/api/task'

const route = useRoute()
const router = useRouter()
const taskId = route.params.id
const task = ref(null)
const versions = ref([])
const errors = ref([])
const versionsDialogVisible = ref(false)

const loadTask = async () => {
  task.value = await getTaskById(taskId)
}

const loadErrors = async () => {
  errors.value = await getTaskErrors(taskId)
}

const goBack = () => {
  router.push('/')
}

const handleConfirmWatermark = async () => {
  try {
    await ElMessageBox.confirm('确认水印配置正确？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await confirmWatermark(taskId)
    ElMessage.success('水印确认成功')
    loadTask()
  } catch {
  }
}

const handleRetry = async () => {
  try {
    await ElMessageBox.confirm('确定要重试此任务？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await retryTask(taskId)
    ElMessage.success('重试成功')
    loadTask()
    loadErrors()
  } catch {
  }
}

const handleShowVersions = async () => {
  versionsDialogVisible.value = true
  try {
    versions.value = await getTaskVersions(taskId)
  } catch {
  }
}

const handleRollback = async (targetVersion) => {
  try {
    await ElMessageBox.confirm(`确定要回滚到版本 ${targetVersion}？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await rollbackTask(taskId, targetVersion)
    ElMessage.success('回滚成功')
    versionsDialogVisible.value = false
    loadTask()
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

const getWatermarkPositionText = (position) => {
  const map = {
    top_left: '左上角',
    top_right: '右上角',
    bottom_left: '左下角',
    bottom_right: '右下角',
    center: '居中'
  }
  return map[position] || position
}

const formatDate = (date) => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadTask()
  loadErrors()
})
</script>

<style scoped>
.task-detail-container {
  padding: 20px;
  max-width: 1400px;
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
  font-size: 20px;
  color: #303133;
  margin: 0;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.info-card {
  min-height: 300px;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
