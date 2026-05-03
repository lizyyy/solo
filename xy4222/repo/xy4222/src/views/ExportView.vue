<template>
  <div class="export-view">
    <!-- 顶部导航 -->
    <div class="view-header">
      <div class="header-left">
        <button class="btn btn-secondary" @click="goBack">
          ← 返回
        </button>
        <h2 class="view-title">导出报告</h2>
      </div>
    </div>

    <!-- 导出内容区 -->
    <div class="export-content">
      <!-- 项目概览 -->
      <div class="section overview-section">
        <h3 class="section-title">📊 项目概览</h3>
        <div class="overview-cards">
          <div class="stat-card">
            <div class="stat-icon">📷</div>
            <div class="stat-info">
              <div class="stat-value">{{ currentProject?.images.length || 0 }}</div>
              <div class="stat-label">图片数量</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">✏️</div>
            <div class="stat-info">
              <div class="stat-value">{{ totalAnnotations }}</div>
              <div class="stat-label">批注数量</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-info">
              <div class="stat-value">{{ highRiskCount }}</div>
              <div class="stat-label">高/极高风险</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 风险等级分布 -->
      <div class="section risk-section">
        <h3 class="section-title">🎯 风险等级分布</h3>
        <div class="risk-bars">
          <div 
            v-for="(count, level) in riskDistribution" 
            :key="level"
            class="risk-bar-row"
          >
            <div class="risk-label">
              <span class="risk-badge" :class="`risk-${level}`">
                {{ getRiskLabel(level) }}
              </span>
            </div>
            <div class="bar-container">
              <div 
                class="bar-fill" 
                :class="`bar-${level}`"
                :style="{ width: `${getBarWidth(count)}%` }"
              ></div>
              <span class="bar-count">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 导出选项 -->
      <div class="section export-section">
        <h3 class="section-title">📥 导出选项</h3>
        
        <div class="export-options">
          <!-- Markdown 报告 -->
          <div class="export-card">
            <div class="card-header">
              <span class="card-icon">📄</span>
              <div class="card-info">
                <h4 class="card-title">Markdown 报告</h4>
                <p class="card-desc">导出包含缩略图、批注编号、风险等级和处理建议的完整报告</p>
              </div>
            </div>
            <div class="card-features">
              <span class="feature-tag">✓ 项目信息</span>
              <span class="feature-tag">✓ 批注统计</span>
              <span class="feature-tag">✓ 详细批注列表</span>
              <span class="feature-tag">✓ 风险等级说明</span>
            </div>
            <div class="card-actions">
              <button 
                class="btn btn-primary" 
                @click="exportMarkdown"
                :disabled="exportStore.isExporting"
              >
                <span v-if="exportStore.isExporting">导出中...</span>
                <span v-else>导出 Markdown</span>
              </button>
            </div>
          </div>

          <!-- JSON 归档 -->
          <div class="export-card">
            <div class="card-header">
              <span class="card-icon">📦</span>
              <div class="card-info">
                <h4 class="card-title">JSON 归档包</h4>
                <p class="card-desc">导出完整的项目数据，可用于备份或导入到其他系统</p>
              </div>
            </div>
            <div class="card-features">
              <span class="feature-tag">✓ 项目元数据</span>
              <span class="feature-tag">✓ 所有图片信息</span>
              <span class="feature-tag">✓ 完整批注数据</span>
              <span class="feature-tag">✓ 统计信息</span>
            </div>
            <div class="card-actions">
              <button 
                class="btn btn-success" 
                @click="exportJSON"
                :disabled="exportStore.isExporting"
              >
                <span v-if="exportStore.isExporting">导出中...</span>
                <span v-else>导出 JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="exportStore.isExporting" class="section progress-section">
        <h3 class="section-title">⏳ 导出进度</h3>
        <div class="progress-container">
          <div 
            class="progress-bar" 
            :style="{ width: `${exportStore.exportProgress}%` }"
          ></div>
        </div>
        <p class="progress-text">{{ exportStore.exportProgress }}% 完成</p>
      </div>

      <!-- 错误提示 -->
      <div v-if="exportStore.exportError" class="error-message">
        ⚠️ 导出失败: {{ exportStore.exportError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCurrentProjectStore, useAnnotationsStore, useExportStore } from '../stores'
import { RiskLevelLabels, RiskLevelOrder } from '../models/RiskLevel'

const route = useRoute()
const router = useRouter()
const currentProjectStore = useCurrentProjectStore()
const annotationsStore = useAnnotationsStore()
const exportStore = useExportStore()

// 计算属性
const currentProject = computed(() => currentProjectStore.currentProject)
const allAnnotations = computed(() => annotationsStore.allProjectAnnotations)

const totalAnnotations = computed(() => allAnnotations.value.length)

const highRiskCount = computed(() => {
  return allAnnotations.value.filter(a => 
    a.riskLevel === 'high' || a.riskLevel === 'critical'
  ).length
})

const riskDistribution = computed(() => {
  const dist = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  }
  allAnnotations.value.forEach(a => {
    if (dist[a.riskLevel] !== undefined) {
      dist[a.riskLevel]++
    }
  })
  return dist
})

// 方法
function getRiskLabel(level) {
  return RiskLevelLabels[level] || level
}

function getBarWidth(count) {
  if (totalAnnotations.value === 0) return 0
  return Math.round((count / totalAnnotations.value) * 100)
}

function goBack() {
  const projectId = route.params.id
  router.push(`/project/${projectId}`)
}

async function exportMarkdown() {
  const result = await exportStore.exportMarkdownReport()
  if (result) {
    alert(`Markdown 报告已导出!\n路径: ${result.filePath}`)
  }
}

async function exportJSON() {
  const result = await exportStore.exportJSONArchive()
  if (result) {
    alert(`JSON 归档包已导出!\n路径: ${result.filePath}`)
  }
}

// 初始化
onMounted(() => {
  const projectId = route.params.id
  if (projectId) {
    currentProjectStore.setCurrentProject(projectId)
  }
})
</script>

<style scoped>
.export-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.view-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.export-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: #333;
}

/* 概览卡片 */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
}

.stat-icon {
  font-size: 2rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1890ff;
  line-height: 1;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  margin-top: 4px;
}

/* 风险分布 */
.risk-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-bar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.risk-label {
  width: 100px;
  flex-shrink: 0;
}

.risk-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.risk-badge.risk-low {
  background: #f6ffed;
  color: #52c41a;
}

.risk-badge.risk-medium {
  background: #fffbe6;
  color: #faad14;
}

.risk-badge.risk-high {
  background: #fff2e8;
  color: #fa8c16;
}

.risk-badge.risk-critical {
  background: #fff2f0;
  color: #ff4d4f;
}

.bar-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fafafa;
  border-radius: 4px;
  padding: 4px;
  min-height: 32px;
}

.bar-fill {
  height: 24px;
  border-radius: 4px;
  min-width: 0;
  transition: width 0.3s ease;
}

.bar-fill.bar-low {
  background: linear-gradient(90deg, #52c41a, #73d13d);
}

.bar-fill.bar-medium {
  background: linear-gradient(90deg, #faad14, #ffc53d);
}

.bar-fill.bar-high {
  background: linear-gradient(90deg, #fa8c16, #ffa940);
}

.bar-fill.bar-critical {
  background: linear-gradient(90deg, #ff4d4f, #ff7875);
}

.bar-count {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
  min-width: 30px;
  text-align: right;
}

/* 导出选项 */
.export-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.export-card {
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.2s;
}

.export-card:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.card-icon {
  font-size: 2.5rem;
}

.card-info {
  flex: 1;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 6px 0;
  color: #333;
}

.card-desc {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
  line-height: 1.5;
}

.card-features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.feature-tag {
  font-size: 0.8rem;
  padding: 4px 8px;
  background: #f0f7ff;
  color: #1890ff;
  border-radius: 4px;
}

.card-actions {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

/* 进度条 */
.progress-section {
  text-align: center;
}

.progress-container {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 12px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #722ed1);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 8px;
  font-size: 0.9rem;
  color: #666;
}

/* 错误消息 */
.error-message {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  padding: 16px 20px;
  color: #ff4d4f;
  margin-bottom: 24px;
}

/* 响应式 */
@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .export-options {
    grid-template-columns: 1fr;
  }
  
  .risk-bar-row {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .risk-label {
    width: auto;
  }
  
  .bar-container {
    width: 100%;
  }
}
</style>
