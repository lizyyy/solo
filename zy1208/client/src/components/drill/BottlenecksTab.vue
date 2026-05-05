<template>
  <div class="bottlenecks-tab">
    <el-alert
      v-if="!analysis || !analysis.bottlenecks?.length"
      title="暂无瓶颈数据"
      type="info"
      show-icon
    >
      <template #default>
        <p>请先运行性能分析</p>
      </template>
    </el-alert>

    <div v-else class="bottlenecks-content">
      <el-card class="summary-card">
        <template #header>
          <div class="card-header">
            <span>瓶颈统计</span>
          </div>
        </template>
        
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-item critical">
              <div class="stat-value">{{ criticalCount }}</div>
              <div class="stat-label">严重问题</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item high">
              <div class="stat-value">{{ highCount }}</div>
              <div class="stat-label">高优先级</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item medium">
              <div class="stat-value">{{ mediumCount }}</div>
              <div class="stat-label">中优先级</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item low">
              <div class="stat-value">{{ lowCount }}</div>
              <div class="stat-label">低优先级</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <el-card class="list-card">
        <template #header>
          <div class="card-header">
            <span>瓶颈问题列表（按严重程度排序）</span>
            <el-select v-model="filterSeverity" placeholder="筛选严重程度" clearable style="width: 150px;">
              <el-option label="全部" value="" />
              <el-option label="严重" value="critical" />
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
          </div>
        </template>

        <el-timeline>
          <el-timeline-item
            v-for="(item, index) in filteredBottlenecks"
            :key="index"
            :type="getTimelineType(item.severity)"
            :timestamp="getTimestamp(item)"
            placement="top"
          >
            <el-card :class="['bottleneck-card', `severity-${item.severity}`]">
              <template #header>
                <div class="card-header">
                  <div class="title-section">
                    <el-icon :size="20" :class="`icon-${item.severity}`">
                      <component :is="getIcon(item.severity)" />
                    </el-icon>
                    <span class="category">{{ item.category }}</span>
                    <el-tag :type="getSeverityType(item.severity)" size="small">
                      {{ getSeverityText(item.severity) }}
                    </el-tag>
                  </div>
                  <div class="impact-score">
                    <span>影响分数: </span>
                    <el-progress 
                      :percentage="(item.impactScore || 0) * 10" 
                      :stroke-width="10"
                      :color="getProgressColor(item.impactScore || 0)"
                      style="width: 100px;"
                    />
                  </div>
                </div>
              </template>
              
              <div class="bottleneck-content">
                <div class="section">
                  <div class="section-title">
                    <el-icon><Warning /></el-icon>
                    <span>问题描述</span>
                  </div>
                  <p class="section-content">{{ item.description || '暂无详细描述' }}</p>
                </div>
                
                <div class="section" v-if="item.suggestion">
                  <div class="section-title">
                    <el-icon><Tips /></el-icon>
                    <span>优化建议</span>
                  </div>
                  <p class="section-content suggestion">{{ item.suggestion }}</p>
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>

        <el-empty v-if="filteredBottlenecks.length === 0" description="暂无符合条件的瓶颈问题" />
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { analysisApi } from '@/api'

const route = useRoute()

const analysis = ref(null)
const filterSeverity = ref('')

const criticalCount = computed(() => {
  return analysis.value?.bottlenecks?.filter(b => b.severity === 'critical').length || 0
})

const highCount = computed(() => {
  return analysis.value?.bottlenecks?.filter(b => b.severity === 'high').length || 0
})

const mediumCount = computed(() => {
  return analysis.value?.bottlenecks?.filter(b => b.severity === 'medium').length || 0
})

const lowCount = computed(() => {
  return analysis.value?.bottlenecks?.filter(b => b.severity === 'low').length || 0
})

const filteredBottlenecks = computed(() => {
  let bottlenecks = analysis.value?.bottlenecks || []
  
  if (filterSeverity.value) {
    bottlenecks = bottlenecks.filter(b => b.severity === filterSeverity.value)
  }
  
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return [...bottlenecks].sort((a, b) => {
    const severityDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3)
    if (severityDiff !== 0) return severityDiff
    return (b.impactScore || 0) - (a.impactScore || 0)
  })
})

const getTimelineType = (severity) => {
  const map = {
    critical: 'danger',
    high: 'warning',
    medium: '',
    low: 'info'
  }
  return map[severity] || ''
}

const getSeverityType = (severity) => {
  const map = {
    critical: 'danger',
    high: 'warning',
    medium: 'warning',
    low: 'info'
  }
  return map[severity] || 'info'
}

const getSeverityText = (severity) => {
  const map = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低'
  }
  return map[severity] || severity
}

const getIcon = (severity) => {
  const map = {
    critical: 'CircleCloseFilled',
    high: 'WarningFilled',
    medium: 'InfoFilled',
    low: 'QuestionFilled'
  }
  return map[severity] || 'InfoFilled'
}

const getProgressColor = (score) => {
  if (score >= 8) return '#f56c6c'
  if (score >= 6) return '#e6a23c'
  return '#409eff'
}

const getTimestamp = (item) => {
  const order = filteredBottlenecks.value.findIndex(b => b === item) + 1
  return `问题 #${order}`
}

const fetchAnalysis = async () => {
  try {
    const drillId = route.params.id
    const response = await analysisApi.get(drillId)
    analysis.value = response.data
  } catch (error) {
    console.log('暂无分析结果')
  }
}

onMounted(() => {
  fetchAnalysis()
})
</script>

<style scoped>
.bottlenecks-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bottlenecks-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.summary-card, .list-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-item {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
}

.stat-item.critical {
  background: #fef0f0;
}

.stat-item.high {
  background: #fdf6ec;
}

.stat-item.medium {
  background: #fdf6ec;
}

.stat-item.low {
  background: #f4f4f5;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
}

.stat-item.critical .stat-value {
  color: #f56c6c;
}

.stat-item.high .stat-value {
  color: #e6a23c;
}

.stat-item.medium .stat-value {
  color: #e6a23c;
}

.stat-item.low .stat-value {
  color: #909399;
}

.stat-label {
  font-size: 14px;
  color: #606266;
  margin-top: 8px;
}

.bottleneck-card {
  margin-bottom: 16px;
  border-left: 4px solid #dcdfe6;
}

.bottleneck-card.severity-critical {
  border-left-color: #f56c6c;
}

.bottleneck-card.severity-high {
  border-left-color: #e6a23c;
}

.bottleneck-card.severity-medium {
  border-left-color: #e6a23c;
}

.bottleneck-card.severity-low {
  border-left-color: #909399;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.impact-score {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #909399;
}

.icon-critical {
  color: #f56c6c;
}

.icon-high {
  color: #e6a23c;
}

.icon-medium {
  color: #e6a23c;
}

.icon-low {
  color: #909399;
}

.bottleneck-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.section-content {
  margin: 0;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
}

.section-content.suggestion {
  background: #ecf5ff;
  color: #409eff;
}
</style>
