<template>
  <div class="home-view">
    <header class="header">
      <div class="header-content">
        <h1 class="title">修复照片拼版批注台</h1>
        <p class="subtitle">文物修复照片管理与批注工具</p>
      </div>
    </header>

    <main class="main-content">
      <div class="actions-bar">
        <button class="btn btn-primary" @click="showCreateProjectModal = true">
          + 新建项目
        </button>
        <button class="btn btn-secondary" @click="loadSampleData">
          加载示例数据
        </button>
      </div>

      <div v-if="projectsStore.isLoading" class="loading">
        加载中...
      </div>

      <div v-else-if="!projectsStore.hasProjects" class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>暂无项目</h3>
        <p>创建一个新项目开始管理您的文物修复照片</p>
        <button class="btn btn-primary mt-4" @click="showCreateProjectModal = true">
          创建第一个项目
        </button>
      </div>

      <div v-else class="projects-grid">
        <div 
          v-for="project in projectsStore.projects" 
          :key="project.id" 
          class="project-card"
          @click="openProject(project.id)"
        >
          <div class="project-card-header">
            <h3 class="project-name">{{ project.name || '未命名项目' }}</h3>
            <button 
              class="btn btn-secondary btn-sm delete-btn" 
              @click.stop="confirmDelete(project)"
            >
              删除
            </button>
          </div>
          <div class="project-card-body">
            <p v-if="project.artifactCode" class="project-code">
              器物编号: {{ project.artifactCode }}
            </p>
            <p v-if="project.description" class="project-desc text-muted">
              {{ project.description.length > 100 ? project.description.substring(0, 100) + '...' : project.description }}
            </p>
          </div>
          <div class="project-card-footer">
            <span class="stat">
              <span class="stat-value">{{ project.imageCount }}</span>
              <span class="stat-label">张图片</span>
            </span>
            <span class="stat">
              <span class="stat-value">{{ project.annotationCount }}</span>
              <span class="stat-label">个批注</span>
            </span>
            <span class="stat text-muted">
              {{ formatDate(project.createdAt) }}
            </span>
          </div>
        </div>
      </div>
    </main>

    <!-- 创建项目模态框 -->
    <div v-if="showCreateProjectModal" class="modal-overlay" @click.self="showCreateProjectModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>新建项目</h3>
          <button class="modal-close" @click="showCreateProjectModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="createProject">
            <div class="form-group">
              <label class="form-label">项目名称 *</label>
              <input 
                type="text" 
                v-model="newProject.name" 
                class="form-input"
                placeholder="请输入项目名称"
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">器物编号</label>
              <input 
                type="text" 
                v-model="newProject.artifactCode" 
                class="form-input"
                placeholder="例如：QW-2024-001"
              />
            </div>
            <div class="form-group">
              <label class="form-label">项目描述</label>
              <textarea 
                v-model="newProject.description" 
                class="form-input"
                rows="4"
                placeholder="请输入项目描述"
              ></textarea>
            </div>
            <div class="form-actions flex justify-end gap-2">
              <button type="button" class="btn btn-secondary" @click="showCreateProjectModal = false">
                取消
              </button>
              <button type="submit" class="btn btn-primary">
                创建项目
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 确认删除模态框 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3>确认删除</h3>
        </div>
        <div class="modal-body">
          <p>确定要删除项目「{{ projectToDelete?.name }}」吗？</p>
          <p class="text-muted mt-2">此操作不可撤销，所有图片和批注数据将被删除。</p>
          <div class="form-actions flex justify-end gap-2 mt-4">
            <button class="btn btn-secondary" @click="showDeleteModal = false">
              取消
            </button>
            <button class="btn btn-danger" @click="deleteProject">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '../stores'
import { createSampleProject } from '../utils/sampleData'

const router = useRouter()
const projectsStore = useProjectsStore()

const showCreateProjectModal = ref(false)
const showDeleteModal = ref(false)
const projectToDelete = ref(null)

const newProject = reactive({
  name: '',
  artifactCode: '',
  description: ''
})

function openProject(projectId) {
  router.push(`/project/${projectId}/compare`)
}

function createProject() {
  if (!newProject.name.trim()) return
  
  projectsStore.addProject({
    name: newProject.name,
    artifactCode: newProject.artifactCode,
    description: newProject.description
  })
  
  showCreateProjectModal.value = false
  newProject.name = ''
  newProject.artifactCode = ''
  newProject.description = ''
}

function confirmDelete(project) {
  projectToDelete.value = project
  showDeleteModal.value = true
}

function deleteProject() {
  if (projectToDelete.value) {
    projectsStore.removeProject(projectToDelete.value.id)
  }
  showDeleteModal.value = false
  projectToDelete.value = null
}

function loadSampleData() {
  const sampleProject = createSampleProject()
  projectsStore.addProject(sampleProject.toJSON())
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.home-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #1890ff 0%, #722ed1 100%);
  color: white;
  padding: 40px 20px;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
}

.main-content {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px;
  width: 100%;
}

.actions-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.loading, .empty-state {
  text-align: center;
  padding: 60px 20px;
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

.empty-state p {
  color: #999;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.project-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.project-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #1890ff;
  transform: translateY(-2px);
}

.project-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.project-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.delete-btn {
  font-size: 12px;
  padding: 4px 8px;
}

.project-card-body {
  margin-bottom: 16px;
}

.project-code {
  color: #1890ff;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.project-desc {
  font-size: 0.9rem;
  line-height: 1.5;
}

.project-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 0.85rem;
  color: #666;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-weight: 600;
  color: #1890ff;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
}

.modal-sm {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 120px);
  overflow-y: auto;
}

.form-actions {
  margin-top: 24px;
}
</style>
