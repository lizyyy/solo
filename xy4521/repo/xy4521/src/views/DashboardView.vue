<template>
  <div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 24px;">
      <div class="stat-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #909399; font-size: 14px;">总盲样数</span>
          <el-icon :size="28" style="color: #409eff;"><Box /></el-icon>
        </div>
        <div class="stat-number" style="color: #409eff;">{{ samples.length }}</div>
        <div class="stat-label">条茶样记录</div>
      </div>

      <div class="stat-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #909399; font-size: 14px;">高风险项</span>
          <el-icon :size="28" style="color: #f56c6c;"><Warning /></el-icon>
        </div>
        <div class="stat-number" style="color: #f56c6c;">{{ highRiskCount }}</div>
        <div class="stat-label">需要立即处理</div>
      </div>

      <div class="stat-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #909399; font-size: 14px;">中风险项</span>
          <el-icon :size="28" style="color: #e6a23c;"><InfoFilled /></el-icon>
        </div>
        <div class="stat-number" style="color: #e6a23c;">{{ mediumRiskCount }}</div>
        <div class="stat-label">需要关注</div>
      </div>

      <div class="stat-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #909399; font-size: 14px;">已完成复核</span>
          <el-icon :size="28" style="color: #67c23a;"><CircleCheck /></el-icon>
        </div>
        <div class="stat-number" style="color: #67c23a;">{{ completedCount }} / {{ samples.length }}</div>
        <div class="stat-label">完成率: {{ completionRate }}%</div>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">风险分布概览</span>
            </div>
          </template>
          <div v-if="risks.length > 0">
            <div v-for="risk in risks.slice(0, 5)" :key="risk.id" class="blind-sample-card"
                 :style="{ borderLeftColor: getRiskColor(risk.level) }">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div>
                  <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">{{ risk.title }}</h4>
                  <p style="color: #606266; font-size: 13px;">{{ risk.description }}</p>
                </div>
                <el-tag :type="getRiskTagType(risk.level)" size="small">
                  {{ getRiskLevelText(risk.level) }}
                </el-tag>
              </div>
              <div style="background: #fafafa; padding: 10px 14px; border-radius: 4px;">
                <div style="font-size: 13px; color: #606266; margin-bottom: 6px;">风险证据:</div>
                <ul style="margin: 0; padding-left: 18px;">
                  <li v-for="(evidence, idx) in risk.evidence.slice(0, 3)" :key="idx"
                      style="font-size: 12px; color: #303133; margin: 4px 0;">
                    {{ evidence }}
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="risks.length > 5" style="text-align: center; margin-top: 16px;">
              <el-text type="info">还有 {{ risks.length - 5 }} 项风险，请前往"风险检测"页面查看详情</el-text>
            </div>
          </div>
          <div v-else class="empty-state">
            <el-icon class="empty-icon"><CircleCheck /></el-icon>
            <div class="empty-text">暂无风险项</div>
            <div class="empty-hint">导入数据后系统将自动检测风险</div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover" style="margin-bottom: 20px;">
          <template #header>
            <div class="card-header">
              <span class="card-title">审评进度</span>
            </div>
          </template>
          <div style="text-align: center; padding: 20px 0;">
            <el-progress 
              type="dashboard" 
              :percentage="completionRate"
              :color="completionRate >= 80 ? '#67c23a' : completionRate >= 50 ? '#e6a23c' : '#f56c6c'"
              :width="150"
            />
            <div style="margin-top: 16px;">
              <div style="display: flex; justify-content: space-around; margin-top: 16px;">
                <div>
                  <div style="font-size: 24px; font-weight: 600; color: #f56c6c;">{{ pendingCount }}</div>
                  <div style="font-size: 12px; color: #909399;">待复核</div>
                </div>
                <div>
                  <div style="font-size: 24px; font-weight: 600; color: #409eff;">{{ reviewingCount }}</div>
                  <div style="font-size: 12px; color: #909399;">复核中</div>
                </div>
                <div>
                  <div style="font-size: 24px; font-weight: 600; color: #67c23a;">{{ completedCount }}</div>
                  <div style="font-size: 12px; color: #909399;">已完成</div>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="card-title">快速操作</span>
            </div>
          </template>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <el-button type="primary" plain @click="$emit('navigate', 'import')">
              <el-icon style="margin-right: 8px;"><Upload /></el-icon>
              导入数据
            </el-button>
            <el-button type="warning" plain @click="$emit('navigate', 'risks')">
              <el-icon style="margin-right: 8px;"><Warning /></el-icon>
              查看风险
            </el-button>
            <el-button type="success" plain @click="$emit('navigate', 'samples')">
              <el-icon style="margin-right: 8px;"><List /></el-icon>
              浏览盲样
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getRiskLevelText, RISK_LEVELS } from '../utils/riskDetector'

const props = defineProps({
  samples: {
    type: Array,
    default: () => []
  },
  risks: {
    type: Array,
    default: () => []
  },
  reviewStatus: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['navigate'])

const highRiskCount = computed(() => 
  props.risks.filter(r => r.level === RISK_LEVELS.HIGH).length
)

const mediumRiskCount = computed(() => 
  props.risks.filter(r => r.level === RISK_LEVELS.MEDIUM).length
)

const pendingCount = computed(() => {
  let count = 0
  props.samples.forEach(sample => {
    const status = props.reviewStatus[sample.id]
    if (!status || status.status === 'pending') {
      count++
    }
  })
  return count
})

const reviewingCount = computed(() => {
  let count = 0
  props.samples.forEach(sample => {
    const status = props.reviewStatus[sample.id]
    if (status && status.status === 'reviewing') {
      count++
    }
  })
  return count
})

const completedCount = computed(() => {
  let count = 0
  props.samples.forEach(sample => {
    const status = props.reviewStatus[sample.id]
    if (status && status.status === 'completed') {
      count++
    }
  })
  return count
})

const completionRate = computed(() => {
  if (props.samples.length === 0) return 0
  return Math.round((completedCount.value / props.samples.length) * 100)
})

const getRiskColor = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH:
      return '#f56c6c'
    case RISK_LEVELS.MEDIUM:
      return '#e6a23c'
    case RISK_LEVELS.LOW:
      return '#67c23a'
    default:
      return '#909399'
  }
}

const getRiskTagType = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH:
      return 'danger'
    case RISK_LEVELS.MEDIUM:
      return 'warning'
    case RISK_LEVELS.LOW:
      return 'success'
    default:
      return 'info'
  }
}
</script>
