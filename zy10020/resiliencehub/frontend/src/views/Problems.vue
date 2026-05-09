<template>
  <div class="problems">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>问题筛选</span>
          <el-button type="primary" size="small" @click="loadProblems">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
      </template>
      <el-form :inline="true">
        <el-form-item label="问题类型">
          <el-select v-model="filterType" placeholder="全部类型" clearable>
            <el-option 
              v-for="type in problemTypes" 
              :key="type.value" 
              :label="type.label" 
              :value="type.value" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="严重程度">
          <el-select v-model="filterSeverity" placeholder="全部级别" clearable>
            <el-option label="低 (LOW)" value="LOW" />
            <el-option label="中 (MEDIUM)" value="MEDIUM" />
            <el-option label="高 (HIGH)" value="HIGH" />
            <el-option label="严重 (CRITICAL)" value="CRITICAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="显示数量">
          <el-input-number v-model="limit" :min="10" :max="500" :step="10" />
        </el-form-item>
        <el-form-item>
          <el-button type="danger" @click="clearOldProblems">
            <el-icon><Delete /></el-icon> 清除24小时前的问题
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <span>问题事件列表</span>
      </template>
      <el-table :data="filteredProblems" v-if="filteredProblems.length > 0">
        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="严重程度" width="120">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="small">
              {{ row.severity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="180" />
        <el-table-column prop="service" label="服务" width="150" />
        <el-table-column prop="endpoint" label="端点" width="200" />
        <el-table-column prop="description" label="描述" min-width="250" />
        <el-table-column label="Trace ID" width="180">
          <template #default="{ row }">
            <el-tag type="info" size="small" effect="plain">{{ row.traceId }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="showDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无问题事件" />
    </el-card>
    
    <el-dialog 
      v-model="detailDialogVisible" 
      title="问题详情"
      width="600px"
    >
      <el-descriptions :column="1" border v-if="currentProblem">
        <el-descriptions-item label="问题 ID">{{ currentProblem.id }}</el-descriptions-item>
        <el-descriptions-item label="时间">
          {{ formatTime(currentProblem.timestamp) }}
        </el-descriptions-item>
        <el-descriptions-item label="严重程度">
          <el-tag :type="getSeverityType(currentProblem.severity)">
            {{ currentProblem.severity }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="类型">{{ currentProblem.type }}</el-descriptions-item>
        <el-descriptions-item label="服务">{{ currentProblem.service || '-' }}</el-descriptions-item>
        <el-descriptions-item label="端点">{{ currentProblem.endpoint || '-' }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ currentProblem.description }}</el-descriptions-item>
        <el-descriptions-item label="Trace ID">{{ currentProblem.traceId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="元数据" v-if="currentProblem.metadata">
          <pre>{{ JSON.stringify(currentProblem.metadata, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const problems = ref([])
const filterType = ref('')
const filterSeverity = ref('')
const limit = ref(100)
const detailDialogVisible = ref(false)
const currentProblem = ref(null)

const problemTypes = [
  { label: '限流触发', value: 'RATE_LIMIT' },
  { label: '熔断开启', value: 'CIRCUIT_BREAKER' },
  { label: '重试耗尽', value: 'RETRY_EXHAUSTED' },
  { label: '请求超时', value: 'TIMEOUT' },
  { label: '模拟超时', value: 'INJECTED_TIMEOUT' },
  { label: '模拟断网', value: 'INJECTED_NETWORK_ERROR' },
  { label: '重复请求', value: 'DUPLICATE_REQUEST' },
  { label: '高并发限制', value: 'HIGH_CONCURRENCY' },
  { label: '重复消息', value: 'DUPLICATE_MESSAGE' },
  { label: '消息重试', value: 'MESSAGE_RETRY' },
  { label: '未知错误', value: 'UNEXPECTED_ERROR' }
]

const filteredProblems = computed(() => {
  return problems.value.filter(p => {
    if (filterType.value && p.type !== filterType.value) return false
    if (filterSeverity.value && p.severity !== filterSeverity.value) return false
    return true
  })
})

const loadProblems = async () => {
  try {
    const res = await axios.get('/api/v1/report/problems', { params: { limit: limit.value } })
    problems.value = res.data.data || []
  } catch (error) {
    console.error('Failed to load problems:', error)
  }
}

const clearOldProblems = async () => {
  try {
    await axios.delete('/api/v1/report/problems/old/24')
    ElMessage.success('已清除24小时前的问题')
    loadProblems()
  } catch (error) {
    ElMessage.error('清除失败')
  }
}

const showDetail = (problem) => {
  currentProblem.value = problem
  detailDialogVisible.value = true
}

const getSeverityType = (severity) => {
  const types = {
    CRITICAL: 'danger',
    HIGH: 'warning',
    MEDIUM: 'warning',
    LOW: 'info'
  }
  return types[severity] || 'info'
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  loadProblems()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

pre {
  margin: 0;
  font-size: 12px;
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  max-height: 200px;
}
</style>
