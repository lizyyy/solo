<template>
  <div class="report">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>系统健康状态</span>
          </template>
          <div v-if="reportData.analysis" class="health-status">
            <el-progress 
              type="dashboard" 
            :percentage="reportData.analysis.healthScore || 0" 
            :color="getHealthColor(reportData.analysis.healthScore)"
            :width="150"
            :stroke-width="15"
            />
            <div class="health-text">
              <el-tag :type="getHealthTagType(reportData.analysis.healthStatus)" size="large">
                {{ getHealthStatusText(reportData.analysis.healthStatus) }}
              </el-tag>
            </div>
          </div>
          <el-empty v-else description="暂无数据" />
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>问题统计</span>
          </template>
          <div v-if="reportData.statistics" class="stats">
            <div class="stat-item">
              <div class="stat-big">{{ reportData.statistics.totalProblems || 0 }}</div>
              <div class="stat-label">总问题数</div>
            </div>
            <el-divider direction="vertical" />
            <div class="stat-item">
              <div class="stat-types">
                <div v-for="(count, type) in reportData.statistics.problemsByType" :key="type">
                  <span class="type-name">{{ type }}:</span>
                  <span class="type-count">{{ count }}</span>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无数据" />
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>导出报告</span>
          </template>
          <el-alert 
            type="info" 
            :closable="false"
            title="点击下方按钮导出完整的问题分析报告"
            style="margin-bottom: 15px;"
          />
          <el-button type="primary" style="width: 100%;" @click="exportReport" :loading="exporting">
            <el-icon><Download /></el-icon> 导出 Markdown 报告
          </el-button>
          <el-button type="success" style="width: 100%; margin-top: 10px;" @click="loadReport" :loading="loading">
            <el-icon><Refresh /></el-icon> 刷新数据
          </el-button>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>建议措施</span>
            </div>
          </template>
          <el-timeline v-if="reportData.recommendations && reportData.recommendations.length > 0">
            <el-timeline-item
              v-for="(rec, index) in reportData.recommendations"
              :key="index"
              :type="getRecommendationType(index)"
              :timestamp="`建议 ${index + 1}`"
            >
              <el-card shadow="never">
                {{ rec }}
              </el-card>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="系统运行正常，暂无建议" />
        </el-card>
      </el-col>
    </el-row>
    
    <el-row style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>主要问题</span>
            </div>
          </template>
          <el-alert
            v-for="(issue, index) in reportData.analysis?.topIssues || []"
            :key="index"
            :title="issue"
            type="warning"
            :closable="false"
            style="margin-bottom: 10px;"
          >
          </el-alert>
          <el-empty v-if="!reportData.analysis?.topIssues || reportData.analysis.topIssues.length === 0" description="系统运行良好" />
        </el-card>
      </el-col>
    </el-row>
    
    <el-row style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>熔断器状态汇总</span>
              <el-tag :type="Object.keys(reportData.circuitBreakers || {}).length > 0 ? 'info' : 'success'">
                {{ Object.keys(reportData.circuitBreakers || {}).length }} 个熔断器
              </el-tag>
            </div>
          </template>
          <el-table :data="circuitBreakerList" v-if="circuitBreakerList.length > 0">
            <el-table-column prop="name" label="服务名称" width="200" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getStateType(row.state)">
                  {{ row.state }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="totalCalls" label="总请求" width="100" />
            <el-table-column label="失败率">
              <template #default="{ row }">
                <el-progress 
                  :percentage="row.failureRate" 
                  :stroke-width="12"
                  :color="row.failureRate > 50 ? '#f56c6c' : row.failureRate > 30 ? '#e6a23c' : '#67c23a'"
                />
              </template>
            </el-table-column>
            <el-table-column label="慢调用率">
              <template #default="{ row }">
                <el-progress 
                  :percentage="row.slowCallRate" 
                  :stroke-width="12"
                  :color="row.slowCallRate > 50 ? '#f56c6c' : row.slowCallRate > 30 ? '#e6a23c' : '#67c23a'"
                />
              </template>
            </el-table-column>
            <el-table-column label="平均响应时间" width="150">
              <template #default="{ row }">
                {{ row.averageResponseTime?.toFixed(2) || 0 }} ms
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无熔断器配置" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const reportData = ref({})
const loading = ref(false)
const exporting = ref(false)

const circuitBreakerList = computed(() => {
  return Object.entries(reportData.value.circuitBreakers || {}).map(
    ([name, data]) => ({ name, ...data })
})

const loadReport = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/v1/report')
    reportData.value = res.data.data || {}
    ElMessage.success('报告数据已更新')
  } catch (error) {
    ElMessage.error('加载报告失败')
  } finally {
    loading.value = false
  }
}

const exportReport = async () => {
  exporting.value = true
  try {
    const res = await axios.get('/api/v1/report/export', {
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `resilience_report_${Date.now()}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('报告导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const getHealthColor = (score) => {
  if (score >= 80) return '#67c23a'
  if (score >= 60) return '#e6a23c'
  if (score >= 30) return '#f56c6c'
  return '#f56c6c'
}

const getHealthTagType = (status) => {
  const types = {
    HEALTHY: 'success',
    WARNING: 'warning',
    DEGRADED: 'danger',
    CRITICAL: 'danger'
  }
  return types[status] || 'info'
}

const getHealthStatusText = (status) => {
  const texts = {
    HEALTHY: '健康',
    WARNING: '警告',
    DEGRADED: '降级',
    CRITICAL: '严重'
  }
  return texts[status] || '未知'
}

const getRecommendationType = (index) => {
  return index === 0 ? 'danger' : index === 1 ? 'warning' : 'info'
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

onMounted(() => {
  loadReport()
})
</script>

<style scoped>
.health-status {
  text-align: center;
  padding: 20px 0;
}

.health-text {
  margin-top: 20px;
}

.stats {
  padding: 15px 0;
}

.stat-item {
  text-align: center;
}

.stat-big {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
}

.stat-label {
  color: #909399;
  font-size: 14px;
  margin-top: 5px;
}

.stat-types {
  text-align: left;
  padding-left: 20px;
}

.type-name {
  color: #606266;
  margin-right: 5px;
}

.type-count {
  color: #f56c6c;
  font-weight: bold;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
