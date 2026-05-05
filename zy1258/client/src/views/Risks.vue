<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">风险检测</h2>
      <div>
        <el-select
          v-model="selectedBatch"
          placeholder="选择版本"
          clearable
          style="width: 250px; margin-right: 10px;"
        >
          <el-option
            v-for="batch in batches"
            :key="batch.id"
            :label="`v${batch.version} (${batch.resourceCount} 资源, ${batch.hitChainCount} 日志)`"
            :value="batch.id"
          />
        </el-select>
        <el-button type="primary" :disabled="!selectedBatch" @click="detectRisks">
          <el-icon><Search /></el-icon>
          执行检测
        </el-button>
      </div>
    </div>

    <el-card v-if="risks.length > 0">
      <template #header>
        <div class="card-header">
          <span>检测结果</span>
          <div class="risk-summary">
            <el-tag v-if="criticalCount > 0" type="danger" effect="dark">
              严重: {{ criticalCount }}
            </el-tag>
            <el-tag v-if="highCount > 0" type="warning" effect="dark">
              高危: {{ highCount }}
            </el-tag>
            <el-tag v-if="mediumCount > 0" type="warning">
              中等: {{ mediumCount }}
            </el-tag>
            <el-tag v-if="lowCount > 0" type="info">
              低危: {{ lowCount }}
            </el-tag>
          </div>
        </div>
      </template>

      <el-timeline>
        <el-timeline-item
          v-for="risk in risks"
          :key="risk.id"
          :type="getTimelineType(risk.severity)"
          :timestamp="formatTime(risk.createdAt)"
          placement="top"
        >
          <el-card shadow="hover">
            <template #header>
              <div class="risk-card-header">
                <div>
                  <el-tag :type="getRiskTagType(risk.severity)" size="large">
                    {{ getSeverityLabel(risk.severity) }}
                  </el-tag>
                  <span class="risk-type">{{ risk.type }}</span>
                </div>
                <span class="risk-title">{{ risk.title }}</span>
              </div>
            </template>

            <p class="risk-description">{{ risk.description }}</p>

            <el-descriptions :column="1" border size="small" style="margin-top: 15px;">
              <el-descriptions-item v-if="risk.affectedUrls?.length > 0" label="受影响 URL">
                <ul class="url-list">
                  <li v-for="(url, index) in risk.affectedUrls.slice(0, 10)" :key="index">
                    <span class="mono">{{ url }}</span>
                  </li>
                  <li v-if="risk.affectedUrls.length > 10">
                    ... 还有 {{ risk.affectedUrls.length - 10 }} 个 URL
                  </li>
                </ul>
              </el-descriptions-item>
              <el-descriptions-item label="证据">
                <pre class="evidence">{{ JSON.stringify(risk.evidence, null, 2) }}</pre>
              </el-descriptions-item>
              <el-descriptions-item v-if="risk.suggestion" label="建议">
                <div class="suggestion">{{ risk.suggestion }}</div>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <el-empty v-else description="选择一个版本并点击执行检测，或查看排查任务">
      <el-button type="primary" @click="$router.push('/tasks')">查看排查任务</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { queryApi } from '../api'
import dayjs from 'dayjs'

const router = useRouter()

const batches = ref<any[]>([])
const selectedBatch = ref<string>('')
const risks = ref<any[]>([])

const criticalCount = computed(() => risks.value.filter(r => r.severity === 'critical').length)
const highCount = computed(() => risks.value.filter(r => r.severity === 'high').length)
const mediumCount = computed(() => risks.value.filter(r => r.severity === 'medium').length)
const lowCount = computed(() => risks.value.filter(r => r.severity === 'low').length)

const loadBatches = async () => {
  try {
    const res = await queryApi.getReleaseBatches()
    if (res.data.success) {
      batches.value = res.data.data
    }
  } catch (error) {
    console.error('Failed to load batches:', error)
  }
}

const detectRisks = async () => {
  if (!selectedBatch.value) return

  try {
    await ElMessageBox.confirm(
      '确定要执行风险检测吗？这将分析该版本的所有日志和资源。',
      '确认执行',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const res = await queryApi.detectRisks(selectedBatch.value)
    if (res.data.success) {
      risks.value = res.data.data.risks
      ElMessage.success(`检测完成，共检测到 ${res.data.data.riskCount} 个风险`)
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('检测失败: ' + (error.message || '未知错误'))
    }
  }
}

const getTimelineType = (severity: string) => {
  const types: Record<string, string> = {
    critical: 'danger',
    high: 'warning',
    medium: 'warning',
    low: 'primary'
  }
  return types[severity] || 'info'
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

const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadBatches()
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

.risk-summary {
  display: flex;
  gap: 8px;
}

.risk-card-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.risk-type {
  margin-left: 10px;
  color: #909399;
  font-size: 14px;
}

.risk-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.risk-description {
  color: #606266;
  line-height: 1.6;
}

.url-list {
  margin: 0;
  padding-left: 20px;
}

.url-list li {
  margin-bottom: 5px;
}

.mono {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
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
