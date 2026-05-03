<template>
  <div class="compare-view">
    <!-- 顶部导航 -->
    <div class="view-header">
      <div class="header-left">
        <button class="btn btn-secondary" @click="goBack">
          ← 返回
        </button>
        <h2 class="view-title">修复前后对比</h2>
      </div>
      <div class="header-right">
        <div class="filter-controls">
          <label class="filter-label">选择部位:</label>
          <select v-model="selectedPart" class="form-select" @change="filterPairs">
            <option value="">全部部位</option>
            <option v-for="part in availableParts" :key="part" :value="part">
              {{ part }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- 对比内容区 -->
    <div class="compare-content">
      <div v-if="filteredPairs.length === 0" class="empty-state">
        <div class="empty-icon">↔️</div>
        <h3>暂无对比数据</h3>
        <p class="text-muted">请确保项目中包含"修复前"和"修复后"阶段的图片</p>
      </div>

      <div v-else class="pairs-container">
        <div 
          v-for="(pair, pairIndex) in filteredPairs" 
          :key="pairIndex"
          class="compare-pair"
        >
          <div class="pair-header">
            <h3 class="part-title">
              部位: {{ pair.part || '未分类' }}
              <span v-if="pair.before && pair.after" class="pair-status matched">
                ✓ 已匹配
              </span>
              <span v-else class="pair-status unmatched">
                ⚠ 部分匹配
              </span>
            </h3>
          </div>

          <div class="pair-content">
            <!-- 修复前 -->
            <div class="compare-side before-side">
              <div class="side-header">
                <span class="stage-badge before">修复前</span>
                <span v-if="pair.before" class="image-name">{{ pair.before.fileName }}</span>
              </div>
              
              <div class="side-content">
                <div v-if="pair.before" class="image-display">
                  <div class="image-placeholder">
                    <div class="placeholder-info">
                      <div class="placeholder-title">修复前 - {{ pair.before.part }}</div>
                      <div class="placeholder-meta">{{ pair.before.description || '无描述' }}</div>
                    </div>
                    
                    <!-- 批注框 -->
                    <div 
                      v-for="(annotation, idx) in pair.annotations.before" 
                      :key="annotation.id"
                      class="annotation-marker"
                      :style="{
                        left: `${annotation.position.x}px`,
                        top: `${annotation.position.y}px`,
                        width: `${annotation.position.width}px`,
                        height: `${annotation.position.height}px`
                      }"
                      :class="`type-${annotation.type}`"
                    >
                      <span class="marker-number">{{ idx + 1 }}</span>
                    </div>
                  </div>
                  
                  <!-- 批注列表 -->
                  <div v-if="pair.annotations.before.length > 0" class="annotations-list">
                    <h4 class="list-title">批注 ({{ pair.annotations.before.length }})</h4>
                    <div 
                      v-for="(annotation, idx) in pair.annotations.before" 
                      :key="annotation.id"
                      class="annotation-item"
                    >
                      <div class="item-header">
                        <span class="annotation-number">#{{ idx + 1 }}</span>
                        <span class="annotation-type">{{ getTypeLabel(annotation.type) }}</span>
                        <span class="risk-badge" :class="`risk-${annotation.riskLevel}`">
                          {{ getRiskLabel(annotation.riskLevel) }}
                        </span>
                      </div>
                      <p v-if="annotation.comment" class="annotation-comment">
                        {{ annotation.comment }}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div v-else class="no-image">
                  <p>暂无修复前图片</p>
                </div>
              </div>
            </div>

            <!-- 分割线 -->
            <div class="compare-divider">
              <div class="divider-line"></div>
              <div class="divider-label">VS</div>
              <div class="divider-line"></div>
            </div>

            <!-- 修复后 -->
            <div class="compare-side after-side">
              <div class="side-header">
                <span class="stage-badge after">修复后</span>
                <span v-if="pair.after" class="image-name">{{ pair.after.fileName }}</span>
              </div>
              
              <div class="side-content">
                <div v-if="pair.after" class="image-display">
                  <div class="image-placeholder after-placeholder">
                    <div class="placeholder-info">
                      <div class="placeholder-title">修复后 - {{ pair.after.part }}</div>
                      <div class="placeholder-meta">{{ pair.after.description || '无描述' }}</div>
                    </div>
                    
                    <!-- 批注框 -->
                    <div 
                      v-for="(annotation, idx) in pair.annotations.after" 
                      :key="annotation.id"
                      class="annotation-marker"
                      :style="{
                        left: `${annotation.position.x}px`,
                        top: `${annotation.position.y}px`,
                        width: `${annotation.position.width}px`,
                        height: `${annotation.position.height}px`
                      }"
                      :class="`type-${annotation.type}`"
                    >
                      <span class="marker-number">{{ idx + 1 }}</span>
                    </div>
                  </div>
                  
                  <!-- 批注列表 -->
                  <div v-if="pair.annotations.after.length > 0" class="annotations-list">
                    <h4 class="list-title">批注 ({{ pair.annotations.after.length }})</h4>
                    <div 
                      v-for="(annotation, idx) in pair.annotations.after" 
                      :key="annotation.id"
                      class="annotation-item"
                    >
                      <div class="item-header">
                        <span class="annotation-number">#{{ idx + 1 }}</span>
                        <span class="annotation-type">{{ getTypeLabel(annotation.type) }}</span>
                        <span class="risk-badge" :class="`risk-${annotation.riskLevel}`">
                          {{ getRiskLabel(annotation.riskLevel) }}
                        </span>
                      </div>
                      <p v-if="annotation.comment" class="annotation-comment">
                        {{ annotation.comment }}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div v-else class="no-image">
                  <p>暂无修复后图片</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCurrentProjectStore } from '../stores'
import { generateCompareLayout } from '../utils/collageGenerator'
import { AnnotationTypeLabels } from '../models/AnnotationType'
import { RiskLevelLabels } from '../models/RiskLevel'

const route = useRoute()
const router = useRouter()
const currentProjectStore = useCurrentProjectStore()

const selectedPart = ref('')
const compareLayout = ref(null)

// 计算属性
const currentProject = computed(() => currentProjectStore.currentProject)
const availableParts = computed(() => currentProjectStore.uniqueParts)

const filteredPairs = computed(() => {
  if (!compareLayout.value) return []
  
  if (selectedPart.value) {
    return compareLayout.value.pairs.filter(p => p.part === selectedPart.value)
  }
  return compareLayout.value.pairs
})

// 初始化
onMounted(() => {
  const projectId = route.params.id
  if (projectId) {
    currentProjectStore.setCurrentProject(projectId)
    generateLayout()
  }
})

// 生成对比布局
function generateLayout() {
  if (!currentProject.value) return
  compareLayout.value = generateCompareLayout(currentProject.value)
}

// 过滤配对
function filterPairs() {
  // 计算属性会自动处理
}

// 返回
function goBack() {
  const projectId = route.params.id
  router.push(`/project/${projectId}`)
}

// 获取标签
function getTypeLabel(type) {
  return AnnotationTypeLabels[type] || type
}

function getRiskLabel(riskLevel) {
  return RiskLevelLabels[riskLevel] || riskLevel
}
</script>

<style scoped>
.compare-view {
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

.header-right {
  display: flex;
  align-items: center;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 0.9rem;
  color: #666;
}

.compare-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #999;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 1.25rem;
  color: #333;
  margin-bottom: 8px;
}

.pairs-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.compare-pair {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.pair-header {
  padding: 16px 24px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

.part-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.pair-status {
  font-size: 0.85rem;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 4px;
}

.pair-status.matched {
  background: #f6ffed;
  color: #52c41a;
}

.pair-status.unmatched {
  background: #fffbe6;
  color: #faad14;
}

.pair-content {
  display: flex;
  align-items: stretch;
  padding: 24px;
  gap: 24px;
}

.compare-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.compare-side.before-side {
  border-color: #ff8c42;
}

.compare-side.after-side {
  border-color: #52c41a;
}

.side-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

.stage-badge {
  font-size: 0.9rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;
}

.stage-badge.before {
  background: #fff2e8;
  color: #fa8c16;
}

.stage-badge.after {
  background: #f6ffed;
  color: #52c41a;
}

.image-name {
  font-size: 0.85rem;
  color: #666;
}

.side-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.image-display {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.image-placeholder {
  width: 100%;
  height: 300px;
  background: linear-gradient(135deg, #ff8c42 0%, #ff6b6b 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-placeholder.after-placeholder {
  background: linear-gradient(135deg, #52c41a 0%, #4ecdc4 100%);
}

.placeholder-info {
  color: white;
  text-align: center;
}

.placeholder-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.placeholder-meta {
  font-size: 0.9rem;
  opacity: 0.9;
}

.annotation-marker {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  pointer-events: none;
}

.marker-number {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 20px;
  height: 20px;
  background: #1890ff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #999;
  background: #fafafa;
}

.annotations-list {
  padding: 16px;
  background: #fafafa;
  border-top: 1px solid #e8e8e8;
}

.list-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #333;
}

.annotation-item {
  padding: 12px;
  background: white;
  border-radius: 6px;
  margin-bottom: 8px;
}

.annotation-item:last-child {
  margin-bottom: 0;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.annotation-number {
  font-weight: 600;
  color: #1890ff;
}

.annotation-type {
  font-size: 0.85rem;
  color: #666;
}

.risk-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
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

.annotation-comment {
  font-size: 0.85rem;
  color: #666;
  line-height: 1.5;
  margin: 0;
}

.compare-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
}

.divider-line {
  flex: 1;
  width: 2px;
  background: #e8e8e8;
}

.divider-label {
  padding: 8px 16px;
  background: #1890ff;
  color: white;
  font-weight: 600;
  border-radius: 20px;
  margin: 8px 0;
}
</style>
