<template>
  <div v-if="!projectStore.hasProject" class="welcome-screen">
    <div class="welcome-title">📦 搬家装箱清单</div>
    <div class="welcome-subtitle">
      轻松管理搬家物品、检查风险、生成清单。数据完全本地存储，不依赖云服务。
    </div>
    <div class="welcome-actions">
      <el-button type="primary" size="large" @click="showCreateProject = true">
        <el-icon><Plus /></el-icon>
        新建搬家项目
      </el-button>
      <el-button size="large" @click="loadDemoData">
        <el-icon><Document /></el-icon>
        加载示例数据
      </el-button>
    </div>
    
    <div v-if="projectStore.projectsList.length > 0" class="recent-projects">
      <div class="recent-title">最近项目</div>
      <div 
        v-for="proj in projectStore.projectsList" 
        :key="proj.id" 
        class="recent-item"
        @click="openProject(proj.id)"
      >
        <span class="recent-item-name">{{ proj.name }}</span>
        <span class="recent-item-date">{{ formatDate(proj.updatedAt) }}</span>
      </div>
    </div>
  </div>

  <div v-else class="main-layout">
    <LeftSidebar />
    <MainContent />
    <RiskPanel />
  </div>

  <CreateProjectDialog 
    v-model="showCreateProject"
    @success="handleProjectCreated"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import LeftSidebar from '@/components/LeftSidebar.vue'
import MainContent from '@/components/MainContent.vue'
import RiskPanel from '@/components/RiskPanel.vue'
import CreateProjectDialog from '@/components/CreateProjectDialog.vue'
import { Plus, Document } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { createDemoProject } from '@/utils/demoData'

const projectStore = useProjectStore()
const showCreateProject = ref(false)

onMounted(async () => {
  await projectStore.listProjects()
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

function handleProjectCreated(project) {
  showCreateProject.value = false
}

async function openProject(projectId) {
  await projectStore.loadProject(projectId)
}

function loadDemoData() {
  const demoProject = createDemoProject()
  projectStore.currentProject = demoProject
  projectStore.updateRisks()
  projectStore.saveCurrentProject()
}
</script>
