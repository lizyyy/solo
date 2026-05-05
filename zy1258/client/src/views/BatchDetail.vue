<template>
  <div>
    <div class="page-header">
      <div>
        <el-button type="text" @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <h2 class="page-title">版本详情</h2>
      </div>
      <el-button type="warning" @click="detectRisks">
        <el-icon><Search /></el-icon>
        执行风险检测
      </el-button>
    </div>

    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>基本信息</span>
          <el-tag :type="batch?.status === 'active' ? 'success' : 'info'">
            {{ batch?.status }}
          </el-tag>
        </div>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="版本号">
          <el-tag type="primary" size="large">{{ batch?.version }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="提交哈希">
          <span class="mono">{{ batch?.commitHash }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatTime(batch?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="3">
          {{ batch?.description || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-tabs v-model="activeTab" style="margin-top: 20px;">
      <el-tab-pane label="资源列表" name="resources">
        <el-card>
          <el-table :data="batch?.resources || []" stripe>
            <el-table-column prop="path" label="路径" min-width="300">
              <template #default="{ row }">
                <span class="mono">{{ row.path }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="getTypeTag(row.type)">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="hash" label="Hash" width="150">
              <template #default="{ row }">
                <span class="mono">{{ row.hash?.slice(0, 10) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="contentLength" label="大小" width="120">
              <template #default="{ row }">
                {{ formatSize(row.contentLength) }}
              </template>
            </el-table-column>
            <el-table-column prop="etag" label="ETag" width="180">
              <template #default="{ row }">
                <span class="mono">{{ row.etag }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="边缘日志" name="hitChains">
        <el-card>
          <el-table :data="batch?.hitChains || []" stripe max-height="500">
            <el-table-column prop="requestId" label="请求ID" width="250">
              <template #default="{ row }">
                <span class="mono">{{ row.requestId?.slice(0, 20) }}...</span>
              </template>
            </el-table-column>
            <el-table-column prop="url" label="URL" min-width="200">
              <template #default="{ row }">
                <span class="mono">{{ row.url }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="statusCode" label="状态码" width="80">
              <template #default="{ row }">
                <el-tag :type="row.statusCode >= 400 ? 'danger' : 'success'">
                  {{ row.statusCode }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="cacheStatus" label="缓存状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getCacheTagType(row.cacheStatus)">
                  {{ row.cacheStatus }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="age" label="Age" width="80">
              <template #default="{ row }">
                {{ row.age ? formatAge(row.age) : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="edgeNodeId" label="边缘节点" width="120" />
            <el-table-column prop="requestTime" label="请求时间" width="150">
              <template #default="{ row }">
                {{ formatTime(row.requestTime) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="异常用户" name="anomalyUsers">
        <el-card>
          <el-table :data="batch?.anomalyUsers || []" stripe empty-text="暂无异常用户">
            <el-table-column prop="sessionId" label="会话ID" width="200">
              <template #default="{ row }">
                <span class="mono">{{ row.sessionId?.slice(0, 16) }}...</span>
              </template>
            </el-table-column>
            <el-table-column prop="errorType" label="错误类型" width="150">
              <template #default="{ row }">
                <el-tag type="danger">{{ row.errorType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="errorMessage" label="错误信息" min-width="300" />
            <el-table-column prop="clientIp" label="客户端IP" width="130" />
            <el-table-column prop="firstSeen" label="首次出现" width="150">
              <template #default="{ row }">
                {{ formatTime(row.firstSeen) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="Purge 记录" name="purgeEvents">
        <el-card>
          <el-table :data="batch?.purgeEvents || []" stripe empty-text="暂无 Purge 记录">
            <el-table-column prop="purgeId" label="Purge ID" width="200">
              <template #default="{ row }">
                <span class="mono">{{ row.purgeId?.slice(0, 20) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="action" label="操作" width="100">
              <template #default="{ row }">
                <el-tag>{{ row.action }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="urls" label="影响URL" min-width="200">
              <template #default="{ row }">
                <div v-if="row.urls && Array.isArray(row.urls)">
                  <div v-for="(url, index) in row.urls.slice(0, 3)" :key="index" class="url-item">
                    <span class="mono">{{ url }}</span>
                  </div>
                  <el-tag v-if="row.urls.length > 3" type="info" size="small">
                    还有 {{ row.urls.length - 3 }} 个 URL
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="skippedNodes" label="跳过节点" width="150">
              <template #default="{ row }">
                <template v-if="row.skippedNodes && row.skippedNodes.length > 0">
                  <el-tag type="danger" v-for="node in row.skippedNodes" :key="node" size="small" style="margin: 2px;">
                    {{ node }}
                  </el-tag>
                </template>
                <span v-else style="color: #909399;">无</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="150">
              <template #default="{ row }">
                {{ formatTime(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { queryApi } from '../api'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const batchId = route.params.id as string

const loading = ref(false)
const batch = ref<any>(null)
const activeTab = ref('resources')

const loadBatch = async () => {
  loading.value = true
  try {
    const res = await queryApi.getReleaseBatch(batchId)
    if (res.data.success) {
      batch.value = res.data.data
    }
  } catch (error: any) {
    ElMessage.error('加载失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const detectRisks = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要对该版本执行风险检测吗？这将分析所有相关日志和资源。',
      '风险检测确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const res = await queryApi.detectRisks(batchId)
    if (res.data.success) {
      ElMessage.success(`风险检测完成，共检测到 ${res.data.data.riskCount} 个风险`)
      router.push(`/tasks/${res.data.data.taskId}`)
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('风险检测失败: ' + (error.message || '未知错误'))
    }
  }
}

const getTypeTag = (type: string) => {
  const types: Record<string, string> = {
    html: 'primary',
    javascript: 'success',
    css: 'warning',
    image: 'info'
  }
  return types[type] || 'info'
}

const getCacheTagType = (status: string) => {
  const types: Record<string, string> = {
    HIT: 'success',
    MISS: 'info',
    STALE: 'warning',
    EXPIRED: 'danger'
  }
  return types[status] || 'info'
}

const formatTime = (time: string) => {
  return time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
}

const formatSize = (bytes: number) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const formatAge = (seconds: number) => {
  if (seconds < 60) return seconds + 's'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm'
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h'
  return Math.floor(seconds / 86400) + 'd'
}

onMounted(() => {
  loadBatch()
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

.url-item {
  margin-bottom: 4px;
}
</style>
