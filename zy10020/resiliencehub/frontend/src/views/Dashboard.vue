<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon success"><CircleCheck /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ overview.circuitBreakerCount || 0 }}</div>
              <div class="stat-label">熔断器数量</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon warning"><Warning /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ overview.activeFaultConfigs || 0 }}</div>
              <div class="stat-label">活跃故障配置</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon danger"><CircleClose /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ openCircuitBreakers }}</div>
              <div class="stat-label">熔断中的服务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon info"><Clock /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ healthScore }}%</div>
              <div class="stat-label">系统健康度</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>熔断器状态</span>
              <el-button type="primary" size="small" @click="loadData">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
          </template>
          <el-table :data="circuitBreakerList" v-if="circuitBreakerList.length > 0">
            <el-table-column prop="name" label="服务名称" width="180" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getStateType(row.state)">
                  {{ row.state }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="totalCalls" label="总请求" width="100" />
            <el-table-column prop="successCount" label="成功" width="80" />
            <el-table-column prop="failureCount" label="失败" width="80" />
            <el-table-column label="失败率" width="100">
              <template #default="{ row }">
                <el-progress 
                  :percentage="row.failureRate" 
                  :stroke-width="10"
                  :color="row.failureRate > 50 ? '#f56c6c' : row.failureRate > 30 ? '#e6a23c' : '#67c23a'"
                />
              </template>
            </el-table-column>
            <el-table-column label="平均响应时间" width="120">
              <template #default="{ row }">
                {{ row.averageResponseTime?.toFixed(2) || 0 }} ms
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button size="small" type="success" @click="resetCircuitBreaker(row.name)">
                  重置
                </el-button>
                <el-button size="small" type="warning" @click="closeCircuitBreaker(row.name)">
                  关闭
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无熔断器数据" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>最近问题事件</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="problem in recentProblems.slice(0, 5)"
              :key="problem.id"
              :type="getSeverityType(problem.severity)"
              :timestamp="problem.timestamp"
              placement="top"
            >
              <el-card shadow="never" class="problem-card">
                <div class="problem-header">
                  <el-tag :type="getSeverityType(problem.severity)" size="small">
                    {{ problem.severity }}
                  </el-tag>
                  <span class="problem-type">{{ problem.type }}</span>
                </div>
                <div class="problem-desc">{{ problem.description }}</div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="recentProblems.length === 0" description="暂无问题" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const overview = ref({})
const circuitBreakerList = ref([])
const recentProblems = ref([])

const openCircuitBreakers = computed(() => {
  return Object.values(overview.value.circuitBreakers || {}).filter(
    cb => cb.state === 'OPEN'
  ).length
})

const healthScore = computed(() => {
  if (openCircuitBreakers.value === 0) return 100
  return Math.max(0, 100 - openCircuitBreakers.value * 20)
})

const loadData = async () => {
  try {
    const [overviewRes, problemsRes] = await Promise.all([
      axios.get('/api/v1/config/system/overview'),
      axios.get('/api/v1/report/problems?limit=10')
    ])
    
    overview.value = overviewRes.data.data || {}
    circuitBreakerList.value = Object.entries(overview.value.circuitBreakers || {}).map(
      ([name, data]) => ({ name, ...data })
    )
    recentProblems.value = problemsRes.data.data || []
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
}

const resetCircuitBreaker = async (name) => {
  try {
    await axios.post(`/api/v1/config/circuit-breaker/${name}/reset`)
    ElMessage.success(`熔断器 ${name} 已重置`)
    loadData()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const closeCircuitBreaker = async (name) => {
  try {
    await axios.post(`/api/v1/config/circuit-breaker/${name}/close`)
    ElMessage.success(`熔断器 ${name} 已关闭`)
    loadData()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const getStateType = (state) => {
  const types = {
    CLOSED: 'success',
    OPEN: 'danger',
    HALF_OPEN: 'warning',
    DISABLED: 'info',
    FORCED_OPEN: 'danger'
  }
  return types[state] || 'info'
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

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 48px;
}

.stat-icon.success { color: #67c23a; }
.stat-icon.warning { color: #e6a23c; }
.stat-icon.danger { color: #f56c6c; }
.stat-icon.info { color: #409eff; }

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.problem-card {
  margin-bottom: 10px;
}

.problem-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}

.problem-type {
  font-weight: 500;
  color: #303133;
}

.problem-desc {
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
