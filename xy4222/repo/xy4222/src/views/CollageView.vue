<template>
  <div class="collage-view">
    <!-- 顶部导航 -->
    <div class="view-header">
      <div class="header-left">
        <button class="btn btn-secondary" @click="goBack">
          ← 返回
        </button>
        <h2 class="view-title">拼版预览</h2>
      </div>
      <div class="header-right">
        <div class="layout-controls">
          <label class="control-label">分组方式:</label>
          <select v-model="groupBy" class="form-select" @change="regenerateLayout">
            <option value="part">按部位</option>
            <option value="stage">按阶段</option>
            <option value="artifactCode">按器物编号</option>
          </select>
        </div>
        <div class="layout-controls">
          <label class="control-label">列数:</label>
          <select v-model="columns" class="form-select" @change="regenerateLayout">
            <option :value="2">2 列</option>
            <option :value="3">3 列</option>
            <option :value="4">4 列</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="exportCollage">
          📥 导出拼版
        </button>
      </div>
    </div>

    <!-- 拼版内容区 -->
    <div class="collage-content">
      <div v-if="!collageLayout || collageLayout.groups.length === 0" class="empty-state">
        <div class="empty-icon">🖼️</div>
        <h3>暂无拼版数据</h3>
        <p class="text-muted">请确保项目中已添加图片</p>
      </div>

      <div v-else class="collage-container">
        <div 
          v-for="(group, groupIndex) in collageLayout.groups" 
          :key="groupIndex"
          class="collage-group"
        >
          <div class="group-header">
            <h3 class="group-title">{{ group.title }}</h3>
            <span class="group-count">{{ group.images.length }} 张图片</span>
          </div>

          <div 
            class="group-grid"
            :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
          >
            <div 
              v-for="(item, itemIndex) in group.images" 
              :key="itemIndex"
              class="grid-item"
              @click="selectImage(item.image)"
            >
              <div class="item-thumbnail">
                <div class="image-placeholder">
                  <div class="placeholder-info">
                    <div class="placeholder-title">{{ item.image.part || '图片' }}</div>
                    <div class="placeholder-meta">{{ getStageLabel(item.image.stage) }}</div>
                  </div>

                  <!-- 批注标记 -->
                  <div 
                    v-for="(annotation, annIndex) in item.annotations" 
                    :key="annotation.id"
                    class="annotation-preview"
                    :style="{
                      left: `${(annotation.position.x / 800) * 100}%`,
                      top: `${(annotation.position.y / 600) * 100}%`,
                      width: `${(annotation.position.width / 800) * 100}%`,
                      height: `${(annotation.position.height / 600) * 100}%`
                    }"
                    :class="`type-${annotation.type}`"
                  >
                    <span class="preview-number">{{ annIndex + 1 }}</span>
                  </div>
                </div>

                <!-- 批注计数徽章 -->
                <div v-if="item.annotations.length > 0" class="annotation-badge">
                  {{ item.annotations.length }}
                </div>
              </div>

              <div class="item-info">
                <div class="item-name">{{ item.image.fileName }}</div>
                <div class="item-meta">
                  <span class="stage-badge" :class="`stage-${item.image.stage}`">
                    {{ getStageLabel(item.image.stage) }}
                  </span>
                  <span v-if="item.image.artifactCode" class="code-badge">
                    {{ item.image.artifactCode }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div v-if="collageLayout" class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">总图片数:</span>
        <span class="stat-value">{{ collageLayout.groups.reduce((sum, g) => sum + g.images.length, 0) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总批注数:</span>
        <span class="stat-value">{{ totalAnnotations }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">分组数:</span>
        <span class="stat-value">{{ collageLayout.groups.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCurrentProjectStore } from '../stores'
import { generateCollageLayout } from '../utils/collageGenerator'
import { ShootingStageLabels } from '../models/ShootingStage'

const route = useRoute()
const router = useRouter()
const currentProjectStore = useCurrentProjectStore()

const groupBy = ref('part')
const columns = ref(2)
const collageLayout = ref(null)

// 计算属性
const currentProject = computed(() => currentProjectStore.currentProject)

const totalAnnotations = computed(() => {
  if (!collageLayout.value) return 0
  return collageLayout.value.groups.reduce((sum, group) => {
    return sum + group.images.reduce((imgSum, item) => {
      return imgSum + item.annotations.length
    }, 0)
  }, 0)
})

// 初始化
onMounted(() => {
  const projectId = route.params.id
  if (projectId) {
    currentProjectStore.setCurrentProject(projectId)
    regenerateLayout()
  }
})

// 重新生成布局
function regenerateLayout() {
  if (!currentProject.value) return
  
  collageLayout.value = generateCollageLayout(currentProject.value, {
    columns: columns.value,
    groupBy: groupBy.value,
    thumbnailWidth: 200,
    thumbnailHeight: 150
  })
}

// 返回
function goBack() {
  const projectId = route.params.id
  router.push(`/project/${projectId}`)
}

// 选择图片
function selectImage(image) {
  currentProjectStore.selectImage(image.id)
  const projectId = route.params.id
  router.push(`/project/${projectId}`)
}

// 获取阶段标签
function getStageLabel(stage) {
  return ShootingStageLabels[stage] || stage
}

// 导出拼版
function exportCollage() {
  // 在实际项目中，这里会生成图片或 PDF
  alert('拼版导出功能：在实际项目中会生成拼版图片或 PDF 文件。')
}
</script>

<style scoped>
.collage-view {
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
  gap: 20px;
}

.layout-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-label {
  font-size: 0.9rem;
  color: #666;
}

.collage-content {
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

.collage-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.collage-group {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

.group-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.group-count {
  font-size: 0.9rem;
  color: #666;
}

.group-grid {
  display: grid;
  gap: 20px;
  padding: 24px;
}

.grid-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.grid-item:hover {
  transform: translateY(-4px);
}

.item-thumbnail {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f0f0;
  aspect-ratio: 4/3;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-info {
  color: white;
  text-align: center;
}

.placeholder-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.placeholder-meta {
  font-size: 0.8rem;
  opacity: 0.9;
}

.annotation-preview {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  pointer-events: none;
}

.preview-number {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 14px;
  height: 14px;
  background: #1890ff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 600;
}

.annotation-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #1890ff;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  min-width: 20px;
  text-align: center;
}

.item-info {
  padding: 12px 4px;
}

.item-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stage-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.stage-badge.stage-before {
  background: #fff2e8;
  color: #fa8c16;
}

.stage-badge.stage-during {
  background: #fffbe6;
  color: #faad14;
}

.stage-badge.stage-after {
  background: #f6ffed;
  color: #52c41a;
}

.stage-badge.stage-comparison {
  background: #e6f4ff;
  color: #1890ff;
}

.code-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f0f0f0;
  color: #666;
}

/* 批注类型颜色 */
.type-crack {
  border-color: #ff6b6b !important;
}

.type-color_restoration {
  border-color: #4ecdc4 !important;
}

.type-damage {
  border-color: #ff8c42 !important;
}

.type-stain {
  border-color: #a55eea !important;
}

.type-hole {
  border-color: #eb3b5a !important;
}

.type-other {
  border-color: #778ca3 !important;
}

.stats-bar {
  display: flex;
  gap: 32px;
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #e8e8e8;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1890ff;
}
</style>
