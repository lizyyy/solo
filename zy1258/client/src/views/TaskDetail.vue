<template>
  <div>
    <div class="page-header">
      <div>
        <el-button type="text" @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <h2 class="page-title">排查任务详情</h2>
      </div>
      <div>
        <el-button type="success" @click="exportMarkdown">
          <el-icon><Download /></el-icon>
          导出 Markdown
        </el-button>
        <el-button type="primary" @click="exportJson">
          <el-icon><Download /></el-icon>
          导出 JSON
        </el-button>
      </div>
    </div>

    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>{{ task?.name }}</span>
          <el-tag :type="getStatusTag(task?.status)">
            {{ task?.status }}
          </el-tag>
        </div>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="任务ID">
          <span class="mono">{{ task?.id }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="任务类型">
          <el-tag :type="getTypeTag(task?.type)">{{ getTypeLabel(task?.type) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatTime(task?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="开始时间">
          {{ task?.startedAt ? formatTime(task.startedAt) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="完成时间">
          {{ task?.completedAt ? formatTime(task.completedAt) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="关联版本">
          <template v-if="task?.releaseBatches?.length > 0">
            <el-tag
              v-for="batch in task.releaseBatches"
              :key="batch.id"
              type="primary"
              style="margin: 2px;"
            >
              v{{ batch.version }}
            </el-tag>
          </template>
          <span v-else style="color: #909399;">无</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="task?.conclusion" style="margin-top: 20px;">
      <template #header>
        <div class="conclusion-header">
          <el-icon :size="24" :color="getConclusionColor(task.conclusion)">
            <WarningFilled v-if="task.conclusion.includes('严重') || task.conclusion.includes('高紧急')" />
            <InfoFilled v-else />
          </el-icon>
          <span>执行结论</span>
        </div>
      </template>
      <div class="conclusion-content" v-html="conclusionHtml" />
    </el-card>

    <el-tabs v-model="activeTab" style="margin-top: 20px;">
      <el-tab-pane label="检测到的风险" name="risks">
        <el-card>
          <el-table :data="task?.risks || []" stripe empty-text="暂无风险">
            <el-table-column prop="severity" label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getRiskTagType(row.severity)">
                  {{ getSeverityLabel(row.severity) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="250" />
            <el-table-column prop="title" label="标题" min-width="200" />
            <el-table-column prop="description" label="描述" min-width="300" />
            <el-table-column prop="createdAt" label="检测时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="showRiskDetail(row)">
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="执行快照" name="snapshot">
        <el-card>
          <template v-if="task?.snapshot">
            <pre class="snapshot">{{ JSON.stringify(task.snapshot, null, 2) }}</pre>
          </template>
          <el-empty v-else description="暂无快照数据" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="riskDialogVisible" title="风险详情" width="700px">
      <el-descriptions :column="1" border v-if="selectedRisk">
        <el-descriptions-item label="级别">
          <el-tag :type="getRiskTagType(selectedRisk.severity)" size="large">
            {{ getSeverityLabel(selectedRisk.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="类型">{{ selectedRisk.type }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ selectedRisk.title }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ selectedRisk.description }}</el-descriptions-item>
        <el-descriptions-item v-if="selectedRisk.affectedUrls?.length > 0" label="受影响 URL">
          <ul style="margin: 0; padding-left: 20px;">
            <li v-for="(url, index) in selectedRisk.affectedUrls" :key="index">
              <span class="mono">{{ url }}</span>
            </li>
          </ul>
        </el-descriptions-item>
        <el-descriptions-item label="证据">
          <pre class="evidence">{{ JSON.stringify(selectedRisk.evidence, null, 2) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item v-if="selectedRisk.suggestion" label="建议">
          <div class="suggestion">{{ selectedRisk.suggestion }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { queryApi } from '../api'
import { marked } from 'marked'
import dayjs from 'dayjs'

const route = useRoute()
const taskId = route.params.id as string

const loading = ref(false)
const task = ref<any>(null)
const activeTab = ref('risks')

const riskDialogVisible = ref(false)
const selectedRisk = ref<any>(null)

const conclusionHtml = computed(() => {
  if (!task.value?.conclusion) return ''
  return marked.parse(task.value.conclusion)
})

const loadTask = async () => {
  loading.value = true
  try {
    const res = await queryApi.getDebugTask(taskId)
    if (res.data.success) {
      task.value = res.data.data
    }
  } catch (error: any) {
    ElMessage.error('加载失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const showRiskDetail = (risk: any) => {
  selectedRisk.value = risk
  riskDialogVisible.value = true
}

const exportMarkdown = () => {
  window.open(queryApi.exportMarkdown(taskId), '_blank')
}

const exportJson = () => {
  window.open(queryApi.exportJson(taskId), '_blank')
}

const getStatusTag = (status: string) => {
  const tags: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return tags[status] || 'info'
}

const getTypeTag = (type: string) => {
  const types: Record<string, string> = {
    canary: 'primary',
    rollback: 'warning',
    sw_residue: 'danger',
    purge_miss: 'info',
    risk_detection: 'success'
  }
  return types[type] || 'info'
}

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    canary: '灰度发布模拟',
    rollback: '回滚模拟',
    sw_residue: 'SW残留模拟',
    purge_miss: 'Purge漏节点',
    risk_detection: '风险检测'
  }
  return labels[type] || type
}

const getRiskTagType = (severity: string) => {
  const types: Record<string, string> = {
    critical: 'danger',
    high: 'warning',
    medium: 'warning',
    low: 'info'
  }
  return types[severity] || 'info'
}

const getSeverityLabel = (severity: string) => {
  const labels: Record<string, string> = {
    critical: '严重',
    high: '高危',
    medium: '中等',
    low: '低危'
  }
  return labels[severity] || severity
}

const getConclusionColor = (conclusion: string) => {
  if (conclusion?.includes('严重') || conclusion?.includes('高紧急')) {
    return '#f56c6c'
  }
  return '#e6a23c'
}

const formatTime = (time: string) => {
  return time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
}

onMounted(() => {
  loadTask()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin: 0;
}

.mono {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
}

.conclusion-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: bold;
}

.conclusion-content {
  line-height: 1.8;
  color: #606266;
}

.conclusion-content :deep(h2) {
  font-size: 16px;
  margin: 20px 0 10px;
  color: #303133;
}

.conclusion-content :deep(ul) {
  margin: 10px 0;
  padding-left: 20px;
}

.conclusion-content :deep(li) {
  margin: 5px 0;
}

.conclusion-content :deep(code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}

.snapshot {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  font-size: 13px;
  max-height: 500px;
  overflow: auto;
  margin: 0;
}

.evidence {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 200px;
  overflow: auto;
  margin: 0;
}

.suggestion {
  background: #fdf6ec;
  border-left: 4px solid #e6a23c;
  padding: 10px 15px;
  color: #e6a23c;
  line-height: 1.6;
}
</style>
