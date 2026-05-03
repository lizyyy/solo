<template>
  <div class="project-view">
    <!-- 顶部导航栏 -->
    <header class="project-header">
      <div class="header-left">
        <button class="btn btn-secondary" @click="goBack">
          ← 返回
        </button>
        <div class="project-info">
          <h1 class="project-name">{{ currentProject?.name || '未命名项目' }}</h1>
          <span v-if="currentProject?.artifactCode" class="project-code">
            器物编号: {{ currentProject.artifactCode }}
          </span>
        </div>
      </div>
      <div class="header-right">
        <span class="stats-badge">
          📷 {{ imageCount }} 张图片
        </span>
        <span class="stats-badge">
          ✏️ {{ annotationCount }} 个批注
        </span>
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="project-main">
      <!-- 左侧边栏：图片列表 -->
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="section-header">
            <h3>图片列表</h3>
            <button class="btn btn-primary btn-sm" @click="showImportModal = true">
              + 导入图片
            </button>
          </div>
          
          <!-- 筛选器 -->
          <div class="filters">
            <div class="filter-group">
              <label class="filter-label">部位:</label>
              <select v-model="filterPart" class="form-select filter-select" @change="filterImages">
                <option value="">全部</option>
                <option v-for="part in uniqueParts" :key="part" :value="part">
                  {{ part }}
                </option>
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">阶段:</label>
              <select v-model="filterStage" class="form-select filter-select" @change="filterImages">
                <option value="">全部</option>
                <option value="before">修复前</option>
                <option value="during">修复中</option>
                <option value="after">修复后</option>
              </select>
            </div>
          </div>

          <!-- 图片列表 -->
          <div class="image-list">
            <div 
              v-for="image in filteredImages" 
              :key="image.id" 
              class="image-item"
              :class="{ active: selectedImage?.id === image.id }"
              @click="selectImage(image)"
            >
              <div class="image-thumbnail">
                <div class="placeholder-image">
                  {{ image.part || '图片' }}
                </div>
              </div>
              <div class="image-info">
                <div class="image-name">{{ image.fileName }}</div>
                <div class="image-meta">
                  <span class="meta-badge" :class="`stage-${image.stage}`">
                    {{ getStageLabel(image.stage) }}
                  </span>
                  <span v-if="image.hasAnnotations" class="meta-badge has-annotations">
                    {{ image.annotations.length }} 个批注
                  </span>
                </div>
              </div>
            </div>

            <div v-if="filteredImages.length === 0" class="empty-list">
              <p>暂无图片</p>
              <p class="text-muted">点击「导入图片」添加照片</p>
            </div>
          </div>
        </div>
      </aside>

      <!-- 中间内容区：图片查看和批注 -->
      <main class="content-area">
        <div v-if="selectedImage" class="image-viewer-container">
          <!-- 图片查看器 -->
          <ImageViewer 
            :image="selectedImage"
            :annotations="currentImageAnnotations"
            @annotation-selected="handleAnnotationSelected"
            @annotation-created="handleAnnotationCreated"
          />
        </div>
        <div v-else class="no-image-selected">
          <div class="placeholder-icon">🖼️</div>
          <h3>请选择一张图片</h3>
          <p class="text-muted">从左侧列表选择图片进行查看和批注</p>
        </div>
      </main>

      <!-- 右侧边栏：批注详情 -->
      <aside class="annotation-panel">
        <AnnotationPanel 
          v-if="selectedImage"
          :image="selectedImage"
          :annotations="currentImageAnnotations"
          :selected-annotation="selectedAnnotation"
          @select-annotation="selectAnnotation"
          @update-annotation="updateAnnotation"
          @delete-annotation="deleteAnnotation"
        />
        <div v-else class="panel-placeholder">
          <p class="text-muted">选择图片后可查看和编辑批注</p>
        </div>
      </aside>
    </div>

    <!-- 底部导航标签 -->
    <nav class="bottom-nav">
      <router-link 
        :to="`/project/${projectId}/compare`" 
        class="nav-item"
        active-class="active"
      >
        <span class="nav-icon">↔️</span>
        <span class="nav-text">对比视图</span>
      </router-link>
      <router-link 
        :to="`/project/${projectId}/collage`" 
        class="nav-item"
        active-class="active"
      >
        <span class="nav-icon">🖼️</span>
        <span class="nav-text">拼版预览</span>
      </router-link>
      <router-link 
        :to="`/project/${projectId}/export`" 
        class="nav-item"
        active-class="active"
      >
        <span class="nav-icon">📥</span>
        <span class="nav-text">导出报告</span>
      </router-link>
    </nav>

    <!-- 子路由视图（对比、拼版、导出视图） -->
    <div class="overlay-view" v-if="showOverlayView">
      <router-view />
    </div>

    <!-- 导入图片模态框 -->
    <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3>导入图片</h3>
          <button class="modal-close" @click="showImportModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="import-section">
            <h4>选择图片文件</h4>
            <p class="text-muted mb-4">支持 JPG、PNG、GIF 等常见图片格式</p>
            
            <div class="drop-zone" @click="openFileDialog">
              <div class="drop-icon">📁</div>
              <p>点击选择文件或拖拽文件到此处</p>
            </div>

            <!-- 预览已选文件列表 -->
            <div v-if="selectedFiles.length > 0" class="selected-files">
              <h5>已选择 {{ selectedFiles.length }} 个文件</h5>
              <div class="file-list">
                <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
                <span class="file-name">{{ file.name }}</span>
                <button class="btn btn-danger btn-sm" @click="removeFile(index)">×</button>
              </div>
            </div>
          </div>

          <div class="import-settings">
            <h4>批量设置属性</h4>
            <p class="text-muted mb-4">这些属性将应用于所有导入的图片</p>
            
            <div class="form-group">
              <label class="form-label">器物编号</label>
              <input 
                type="text" 
                v-model="importSettings.artifactCode" 
                class="form-input"
                placeholder="例如：QD-2024-001"
              />
            </div>
            <div class="form-group">
              <label class="form-label">部位</label>
              <input 
                type="text" 
                v-model="importSettings.part" 
                class="form-input"
                placeholder="例如：正面、底部、耳部"
              />
            </div>
            <div class="form-group">
              <label class="form-label">拍摄阶段</label>
              <select v-model="importSettings.stage" class="form-select">
                <option value="before">修复前</option>
                <option value="during">修复中</option>
                <option value="after">修复后</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showImportModal = false">
            取消
          </button>
          <button class="btn btn-primary" @click="importImages" :disabled="selectedFiles.length === 0">
            导入图片
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCurrentProjectStore, useAnnotationsStore, useProjectsStore } from '../stores'
import ImageViewer from '../components/ImageViewer.vue'
import AnnotationPanel from '../components/AnnotationPanel.vue'
import ShootingStage, { ShootingStageLabels } from '../models/ShootingStage'

const route = useRoute()
const router = useRouter()
const currentProjectStore = useCurrentProjectStore()
const annotationsStore = useAnnotationsStore()
const projectsStore = useProjectsStore()

const projectId = computed(() => route.params.id)
const showImportModal = ref(false)
const showOverlayView = ref(false)

// 筛选条件
const filterPart = ref('')
const filterStage = ref('')
const filteredImages = ref([])

// 导入相关
const selectedFiles = ref([])
const importSettings = ref({
  artifactCode: '',
  part: '',
  stage: ShootingStage.BEFORE
})

// 计算属性
const currentProject = computed(() => currentProjectStore.currentProject)
const selectedImage = computed(() => currentProjectStore.selectedImage)
const selectedAnnotation = computed(() => annotationsStore.selectedAnnotation)
const currentImageAnnotations = computed(() => annotationsStore.currentImageAnnotations)
const imageCount = computed(() => currentProjectStore.imageCount)
const annotationCount = computed(() => currentProjectStore.annotationCount)
const uniqueParts = computed(() => currentProjectStore.uniqueParts)

// 监听路由变化
watch(() => route.path, (newPath) => {
  showOverlayView.value = newPath.includes('/compare') || 
                           newPath.includes('/collage') || 
                           newPath.includes('/export')
}, { immediate: true })

// 初始化
onMounted(() => {
  if (projectId.value) {
    currentProjectStore.setCurrentProject(projectId.value)
    filterImages()
  }
})

// 筛选图片
function filterImages() {
  if (!currentProject.value) {
    filteredImages.value = []
    return
  }

  filteredImages.value = currentProject.value.images.filter(image => {
    const matchPart = !filterPart.value || image.part === filterPart.value
    const matchStage = !filterStage.value || image.stage === filterStage.value
    return matchPart && matchStage
  })
}

// 选择图片
function selectImage(image) {
  currentProjectStore.selectImage(image.id)
  annotationsStore.clearSelection()
}

// 选择批注
function selectAnnotation(annotationId) {
  annotationsStore.selectAnnotation(annotationId)
}

// 更新批注
function updateAnnotation(annotationId, data) {
  annotationsStore.updateAnnotation(annotationId, data)
}

// 删除批注
function deleteAnnotation(annotationId) {
  annotationsStore.removeAnnotation(annotationId)
}

// 批注事件处理
function handleAnnotationSelected(annotation) {
  annotationsStore.selectAnnotation(annotation.id)
}

function handleAnnotationCreated(annotation) {
  annotationsStore.selectAnnotation(annotation.id)
}

// 获取阶段标签
function getStageLabel(stage) {
  return ShootingStageLabels[stage] || stage
}

// 返回首页
function goBack() {
  router.push('/')
}

// 打开文件对话框
async function openFileDialog() {
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  
  if (isElectron) {
    try {
      const result = await window.electronAPI.openFileDialog()
      if (!result.canceled && result.filePaths) {
        selectedFiles.value = result.filePaths.map(path => ({
          name: path.split('/').pop(),
          path: path
        }))
      }
    } catch (e) {
      console.error('打开文件对话框失败:', e)
    }
  } else {
    // 浏览器环境：创建文件输入
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*'
    input.onchange = (e) => {
      selectedFiles.value = Array.from(e.target.files).map(file => ({
        name: file.name,
        file: file
      }))
    }
    input.click()
  }
}

// 移除文件
function removeFile(index) {
  selectedFiles.value.splice(index, 1)
}

// 导入图片
function importImages() {
  if (selectedFiles.value.length === 0) return

  selectedFiles.value.forEach(file => {
    currentProjectStore.addImage({
      filePath: file.path || URL.createObjectURL(file.file),
      fileName: file.name,
      artifactCode: importSettings.value.artifactCode,
      part: importSettings.value.part,
      stage: importSettings.value.stage
    })
  })

  showImportModal.value = false
  selectedFiles.value = []
  filterImages()
}
</script>

<style scoped>
.project-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.project-code {
  font-size: 0.9rem;
  color: #1890ff;
}

.header-right {
  display: flex;
  gap: 16px;
}

.stats-badge {
  padding: 6px 12px;
  background: #f0f7ff;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #1890ff;
}

.project-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.sidebar-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.filters {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 0.85rem;
  color: #666;
  white-space: nowrap;
}

.filter-select {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.85rem;
}

.image-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.image-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 4px;
}

.image-item:hover {
  background-color: #f5f5f5;
}

.image-item.active {
  background-color: #e6f4ff;
  border: 1px solid #91caff;
}

.image-thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f0f0;
  flex-shrink: 0;
}

.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #999;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.image-info {
  flex: 1;
  min-width: 0;
}

.image-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}

.image-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 3px;
  background: #f0f0f0;
  color: #666;
}

.meta-badge.stage-before {
  background: #fff2e8;
  color: #fa8c16;
}

.meta-badge.stage-during {
  background: #fffbe6;
  color: #faad14;
}

.meta-badge.stage-after {
  background: #f6ffed;
  color: #52c41a;
}

.meta-badge.has-annotations {
  background: #e6f4ff;
  color: #1890ff;
}

.empty-list {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-list p {
  margin: 4px 0;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fafafa;
}

.image-viewer-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.no-image-selected {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.annotation-panel {
  width: 320px;
  background: white;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.panel-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}

.bottom-nav {
  display: flex;
  background: white;
  border-top: 1px solid #e8e8e8;
  padding: 0 24px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  color: #666;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.nav-item:hover {
  color: #1890ff;
  background: #f5f5f5;
}

.nav-item.active {
  color: #1890ff;
  border-bottom-color: #1890ff;
}

.nav-icon {
  font-size: 1.1rem;
}

.nav-text {
  font-size: 0.95rem;
  font-weight: 500;
}

.overlay-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f5f5;
  z-index: 100;
}

/* 模态框样式 */
.modal-lg {
  max-width: 700px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.import-section,
.import-settings {
  margin-bottom: 24px;
}

.import-section h4,
.import-settings h4 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #333;
}

.drop-zone {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.drop-zone:hover {
  border-color: #1890ff;
  background: #e6f4ff;
}

.drop-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.selected-files {
  margin-top: 16px;
}

.selected-files h5 {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
}

.file-list {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.file-item:last-child {
  border-bottom: none;
}

.file-name {
  font-size: 0.9rem;
  color: #333;
}
</style>
