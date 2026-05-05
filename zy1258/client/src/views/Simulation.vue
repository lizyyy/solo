<template>
  <div>
    <h2 class="page-title">模拟排查</h2>
    <p class="subtitle">模拟常见的缓存混版场景，验证风险检测能力</p>

    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover" @click="activeSim = 'canary'" :class="{ 'card-active': activeSim === 'canary' }">
          <div class="sim-card">
            <el-icon size="36" :color="activeSim === 'canary' ? '#409eff' : '#909399'">
              <TrendCharts />
            </el-icon>
            <h3>灰度发布模拟</h3>
            <p>模拟部分用户使用新版本，部分使用旧版本的场景</p>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" @click="activeSim = 'rollback'" :class="{ 'card-active': activeSim === 'rollback' }">
          <div class="sim-card">
            <el-icon size="36" :color="activeSim === 'rollback' ? '#409eff' : '#909399'">
              <RefreshLeft />
            </el-icon>
            <h3>回滚访问模拟</h3>
            <p>模拟回滚后浏览器仍缓存新版本资源的场景</p>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" @click="activeSim = 'sw'" :class="{ 'card-active': activeSim === 'sw' }">
          <div class="sim-card">
            <el-icon size="36" :color="activeSim === 'sw' ? '#409eff' : '#909399'">
              <Monitor />
            </el-icon>
            <h3>SW 残留模拟</h3>
            <p>模拟 Service Worker 缓存旧版本资源的场景</p>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" @click="activeSim = 'purge'" :class="{ 'card-active': activeSim === 'purge' }">
          <div class="sim-card">
            <el-icon size="36" :color="activeSim === 'purge' ? '#409eff' : '#909399'">
              <Delete />
            </el-icon>
            <h3>Purge 漏节点模拟</h3>
            <p>模拟部分边缘节点未被 purge 的场景</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="activeSim === 'canary'" style="margin-top: 20px;">
      <template #header>
        <span>灰度发布配置</span>
      </template>
      <el-form :model="canaryForm" label-width="150px">
        <el-form-item label="旧版本批次">
          <el-select v-model="canaryForm.oldBatchId" placeholder="选择旧版本" style="width: 100%;">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="`v${batch.version}`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="新版本批次">
          <el-select v-model="canaryForm.newBatchId" placeholder="选择新版本" style="width: 100%;">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="`v${batch.version}`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="灰度比例">
          <el-slider
            v-model="canaryForm.parameters.canaryPercentage"
            :min="0"
            :max="100"
            :show-input="true"
            :input-size="small"
          />
          <div style="margin-top: 10px; color: #909399;">
            当前配置：{{ canaryForm.parameters.canaryPercentage }}% 用户使用新版本
          </div>
        </el-form-item>
        <el-form-item label="边缘节点">
          <el-select
            v-model="canaryForm.parameters.affectedEdgeNodes"
            multiple
            placeholder="选择受影响的边缘节点"
            style="width: 100%;"
          >
            <el-option label="香港 (node-hkg-001)" value="node-hkg-001" />
            <el-option label="新加坡 (node-sgp-001)" value="node-sgp-001" />
            <el-option label="东京 (node-tok-001)" value="node-tok-001" />
            <el-option label="纽约 (node-nyc-001)" value="node-nyc-001" />
          </el-select>
        </el-form-item>
        <el-form-item label="模拟时长（分钟）">
          <el-input-number
            v-model="canaryForm.parameters.durationMinutes"
            :min="1"
            :max="1440"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="running" @click="runCanarySimulation">
            运行模拟
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="activeSim === 'rollback'" style="margin-top: 20px;">
      <template #header>
        <span>回滚访问配置</span>
      </template>
      <el-form :model="rollbackForm" label-width="180px">
        <el-form-item label="新版本批次（要回滚的版本）">
          <el-select v-model="rollbackForm.newBatchId" placeholder="选择新版本" style="width: 100%;">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="`v${batch.version}`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="旧版本批次（回滚目标）">
          <el-select v-model="rollbackForm.oldBatchId" placeholder="选择旧版本" style="width: 100%;">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="`v${batch.version}`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="回滚时间">
          <el-date-picker
            v-model="rollbackForm.parameters.rollbackTime"
            type="datetime"
            placeholder="选择回滚时间"
            style="width: 100%;"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="回滚后缺失的资源">
          <el-select
            v-model="rollbackForm.parameters.missingResources"
            multiple
            filterable
            allow-create
            placeholder="输入缺失的资源路径（可多选）"
            style="width: 100%;"
          >
            <el-option label="/assets/style.xxx.css" value="/assets/style" />
            <el-option label="/assets/chunk-xxx.js" value="/assets/chunk" />
          </el-select>
        </el-form-item>
        <el-form-item label="浏览器缓存时长（秒）">
          <el-input-number
            v-model="rollbackForm.parameters.browserCacheDuration"
            :min="0"
            :max="864000"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="running" @click="runRollbackSimulation">
            运行模拟
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="activeSim === 'sw'" style="margin-top: 20px;">
      <template #header>
        <span>Service Worker 残留配置</span>
      </template>
      <el-form :model="swForm" label-width="150px">
        <el-form-item label="旧版本批次">
          <el-select v-model="swForm.oldBatchId" placeholder="选择旧版本" style="width: 100%;">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="`v${batch.version}`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="新版本批次">
          <el-select v-model="swForm.newBatchId" placeholder="选择新版本" style="width: 100%;">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="`v${batch.version}`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="SW 版本">
          <el-input v-model="swForm.parameters.swVersion" placeholder="如：1.0.0" />
        </el-form-item>
        <el-form-item label="SW 缓存的 URL">
          <el-select
            v-model="swForm.parameters.cachedUrls"
            multiple
            filterable
            allow-create
            placeholder="选择或输入缓存的 URL"
            style="width: 100%;"
          >
            <el-option label="/index.html" value="/index.html" />
            <el-option label="/assets/index.js" value="/assets/index" />
            <el-option label="/assets/style.css" value="/assets/style" />
          </el-select>
        </el-form-item>
        <el-form-item label="SW 更新频率">
          <el-slider
            v-model="swForm.parameters.updateFrequency"
            :min="0"
            :max="1"
            :step="0.1"
            :show-input="true"
          />
          <div style="margin-top: 10px; color: #909399;">
            值越高，SW 越频繁检查更新；值越低，越容易残留旧缓存
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="running" @click="runSWSimulation">
            运行模拟
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="activeSim === 'purge'" style="margin-top: 20px;">
      <template #header>
        <span>Purge 漏节点配置</span>
      </template>
      <el-form :model="purgeForm" label-width="150px">
        <el-form-item label="目标批次">
          <el-select v-model="purgeForm.batchId" placeholder="选择目标版本" style="width: 100%;">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="`v${batch.version}`"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Purge 的 URL">
          <el-select
            v-model="purgeForm.parameters.purgeUrls"
            multiple
            filterable
            allow-create
            placeholder="选择要 purge 的 URL"
            style="width: 100%;"
          >
            <el-option label="/index.html" value="/index.html" />
            <el-option label="/assets/*" value="/assets/*" />
            <el-option label="/static/*" value="/static/*" />
          </el-select>
        </el-form-item>
        <el-form-item label="跳过的边缘节点">
          <el-select
            v-model="purgeForm.parameters.skippedEdgeNodes"
            multiple
            placeholder="选择跳过的节点（这些节点不会被 purge）"
            style="width: 100%;"
          >
            <el-option label="香港 (node-hkg-001)" value="node-hkg-001" />
            <el-option label="新加坡 (node-sgp-001)" value="node-sgp-001" />
            <el-option label="东京 (node-tok-001)" value="node-tok-001" />
            <el-option label="纽约 (node-nyc-001)" value="node-nyc-001" />
          </el-select>
        </el-form-item>
        <el-form-item label="遗漏的 URL">
          <el-select
            v-model="purgeForm.parameters.missedUrls"
            multiple
            filterable
            allow-create
            placeholder="输入遗漏的 URL（未被 purge）"
            style="width: 100%;"
          >
            <el-option label="/assets/important.js" value="/assets/important" />
            <el-option label="/config.json" value="/config" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="running" @click="runPurgeSimulation">
            运行模拟
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="simulationResult" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>模拟结果</span>
          <el-button type="primary" size="small" @click="goToTask">
            查看完整报告
          </el-button>
        </div>
      </template>
      <el-descriptions :column="2" border style="margin-bottom: 20px;">
        <el-descriptions-item label="任务ID">
          <span class="mono">{{ simulationResult.taskId }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="生成的请求数">
          {{ simulationResult.hitChainCount }}
        </el-descriptions-item>
        <el-descriptions-item label="检测到的风险数">
          <el-tag :type="simulationResult.riskCount > 0 ? 'danger' : 'success'">
            {{ simulationResult.riskCount }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="任务链接">
          <el-button type="text" @click="goToTask">查看详情 →</el-button>
        </el-descriptions-item>
      </el-descriptions>

      <h4 style="margin-bottom: 15px;">结论</h4>
      <el-text v-html="conclusionHtml" />

      <h4 style="margin: 20px 0 15px;">检测到的风险</h4>
      <el-table :data="simulationResult.risks || []" stripe>
        <el-table-column prop="severity" label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="getRiskTagType(row.severity)">
              {{ getSeverityLabel(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="200" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="description" label="描述" min-width="300" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { queryApi, simulationApi } from '../api'
import { marked } from 'marked'

const router = useRouter()

const batches = ref<any[]>([])
const activeSim = ref('canary')
const running = ref(false)
const simulationResult = ref<any>(null)

const canaryForm = ref({
  oldBatchId: '',
  newBatchId: '',
  parameters: {
    canaryPercentage: 30,
    affectedEdgeNodes: ['node-hkg-001', 'node-sgp-001'],
    durationMinutes: 60
  }
})

const rollbackForm = ref({
  newBatchId: '',
  oldBatchId: '',
  parameters: {
    rollbackTime: new Date().toISOString().slice(0, 19),
    missingResources: ['/assets/style'],
    browserCacheDuration: 86400
  }
})

const swForm = ref({
  oldBatchId: '',
  newBatchId: '',
  parameters: {
    swVersion: '1.0.0',
    cachedUrls: ['/index.html', '/assets/index'],
    updateFrequency: 0.3
  }
})

const purgeForm = ref({
  batchId: '',
  parameters: {
    purgeUrls: ['/index.html', '/assets/*'],
    skippedEdgeNodes: ['node-tok-001'],
    missedUrls: ['/assets/important']
  }
})

const conclusionHtml = computed(() => {
  if (!simulationResult.value?.conclusion) return ''
  return marked.parse(simulationResult.value.conclusion)
})

const loadBatches = async () => {
  try {
    const res = await queryApi.getReleaseBatches()
    if (res.data.success) {
      batches.value = res.data.data
      if (batches.value.length >= 2) {
        canaryForm.value.oldBatchId = batches.value[1].id
        canaryForm.value.newBatchId = batches.value[0].id
        rollbackForm.value.newBatchId = batches.value[0].id
        rollbackForm.value.oldBatchId = batches.value[1].id
        swForm.value.oldBatchId = batches.value[1].id
        swForm.value.newBatchId = batches.value[0].id
        purgeForm.value.batchId = batches.value[0].id
      }
    }
  } catch (error) {
    console.error('Failed to load batches:', error)
  }
}

const runCanarySimulation = async () => {
  if (!canaryForm.value.oldBatchId || !canaryForm.value.newBatchId) {
    ElMessage.warning('请选择旧版本和新版本批次')
    return
  }
  running.value = true
  try {
    const res = await simulationApi.simulateCanary({
      oldBatchId: canaryForm.value.oldBatchId,
      newBatchId: canaryForm.value.newBatchId,
      parameters: canaryForm.value.parameters
    })
    if (res.data.success) {
      simulationResult.value = res.data.data
      ElMessage.success('模拟完成，查看结果')
    }
  } catch (error: any) {
    ElMessage.error('模拟失败: ' + (error.response?.data?.error || error.message))
  } finally {
    running.value = false
  }
}

const runRollbackSimulation = async () => {
  if (!rollbackForm.value.newBatchId || !rollbackForm.value.oldBatchId) {
    ElMessage.warning('请选择新版本和旧版本批次')
    return
  }
  running.value = true
  try {
    const res = await simulationApi.simulateRollback({
      newBatchId: rollbackForm.value.newBatchId,
      oldBatchId: rollbackForm.value.oldBatchId,
      parameters: rollbackForm.value.parameters
    })
    if (res.data.success) {
      simulationResult.value = res.data.data
      ElMessage.success('模拟完成，查看结果')
    }
  } catch (error: any) {
    ElMessage.error('模拟失败: ' + (error.response?.data?.error || error.message))
  } finally {
    running.value = false
  }
}

const runSWSimulation = async () => {
  if (!swForm.value.oldBatchId || !swForm.value.newBatchId) {
    ElMessage.warning('请选择旧版本和新版本批次')
    return
  }
  running.value = true
  try {
    const res = await simulationApi.simulateSWResidue({
      oldBatchId: swForm.value.oldBatchId,
      newBatchId: swForm.value.newBatchId,
      parameters: swForm.value.parameters
    })
    if (res.data.success) {
      simulationResult.value = res.data.data
      ElMessage.success('模拟完成，查看结果')
    }
  } catch (error: any) {
    ElMessage.error('模拟失败: ' + (error.response?.data?.error || error.message))
  } finally {
    running.value = false
  }
}

const runPurgeSimulation = async () => {
  if (!purgeForm.value.batchId) {
    ElMessage.warning('请选择目标批次')
    return
  }
  running.value = true
  try {
    const res = await simulationApi.simulatePurgeMiss({
      batchId: purgeForm.value.batchId,
      parameters: purgeForm.value.parameters
    })
    if (res.data.success) {
      simulationResult.value = res.data.data
      ElMessage.success('模拟完成，查看结果')
    }
  } catch (error: any) {
    ElMessage.error('模拟失败: ' + (error.response?.data?.error || error.message))
  } finally {
    running.value = false
  }
}

const goToTask = () => {
  if (simulationResult.value?.taskId) {
    router.push(`/tasks/${simulationResult.value.taskId}`)
  }
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

onMounted(() => {
  loadBatches()
})
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #303133;
}

.subtitle {
  color: #909399;
  margin-bottom: 20px;
}

.sim-card {
  text-align: center;
  cursor: pointer;
}

.sim-card h3 {
  margin: 15px 0 10px;
  font-size: 16px;
}

.sim-card p {
  color: #909399;
  font-size: 13px;
  line-height: 1.5;
}

.card-active {
  border-color: #409eff;
  box-shadow: 0 2px 12px 0 rgba(64, 158, 255, 0.3);
}

.mono {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
}
</style>
