<template>
  <div>
    <h2 class="page-title">仪表盘</h2>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats?.summary.releaseBatches || 0 }}</div>
          <div class="stat-label">发布批次</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats?.summary.hitChains || 0 }}</div>
          <div class="stat-label">边缘日志</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats?.summary.anomalyUsers || 0 }}</div>
          <div class="stat-label">异常用户</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats?.summary.debugTasks || 0 }}</div>
          <div class="stat-label">排查任务</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value" :class="{ 'risk-critical': stats?.summary.risks > 0 }">
            {{ stats?.summary.risks || 0 }}
          </div>
          <div class="stat-label">检测风险</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card">
          <div class="stat-value" style="color: #67c23a;">
            {{ systemStatus }}
          </div>
          <div class="stat-label">系统状态</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近风险</span>
              <el-button type="primary" size="small" @click="$router.push('/tasks')">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="stats?.recentRisks || []" v-loading="loading">
            <el-table-column prop="severity" label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getRiskTagType(row.severity)">
                  {{ getSeverityLabel(row.severity) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="风险描述" min-width="250" />
            <el-table-column prop="type" label="类型" width="180" />
            <el-table-column prop="createdAt" label="时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span>快速操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/import')" style="width: 100%; margin-bottom: 10px;">
              <el-icon><Upload /></el-icon>
              导入数据
            </el-button>
            <el-button type="success" @click="$router.push('/simulation')" style="width: 100%; margin-bottom: 10px;">
              <el-icon><Cpu /></el-icon>
              模拟排查
            </el-button>
            <el-button type="warning" @click="$router.push('/batches')" style="width: 100%; margin-bottom: 10px;">
              <el-icon><Box /></el-icon>
              查看发布批次
            </el-button>
            <el-button type="info" @click="$router.push('/risks')" style="width: 100%;">
              <el-icon><Warning /></el-icon>
              风险检测
            </el-button>
          </div>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <span>风险类型说明</span>
          </template>
          <div class="risk-types">
            <div class="risk-type-item">
              <el-tag type="danger" effect="dark">CRITICAL</el-tag>
              <span>严重：需要立即处理，可能导致白屏</span>
            </div>
            <div class="risk-type-item">
              <el-tag type="warning" effect="dark">HIGH</el-tag>
              <span>高危：建议尽快处理</span>
            </div>
            <div class="risk-type-item">
              <el-tag type="warning">MEDIUM</el-tag>
              <span>中等：需要关注</span>
            </div>
            <div class="risk-type-item">
              <el-tag type="info">LOW</el-tag>
              <span>低危：优化建议</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { queryApi, healthApi } from '../api'
import dayjs from 'dayjs'

const loading = ref(false)
const stats = ref<any>(null)
const systemStatus = ref('检测中...')

const loadData = async () => {
  loading.value = true
  try {
    const [statsRes, healthRes] = await Promise.all([
      queryApi.getStatistics(),
      healthApi.check()
    ])

    if (statsRes.data.success) {
      stats.value = statsRes.data.data
    }

    systemStatus.value = healthRes.data.success ? '正常运行' : '异常'
  } catch (error: any) {
    ElMessage.error('加载数据失败: ' + (error.message || '未知错误'))
    systemStatus.value = '连接失败'
  } finally {
    loading.value = false
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

const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #303133;
}

.quick-actions {
  display: flex;
  flex-direction: column;
}

.risk-types {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-type-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
