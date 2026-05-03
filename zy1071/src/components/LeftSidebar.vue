<template>
  <div class="left-sidebar">
    <div class="sidebar-header">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="font-size: 16px; font-weight: bold;">{{ currentProjectName }}</div>
        <el-dropdown>
          <el-button type="text" :icon="MoreFilled" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="showCreateProject = true">
                <el-icon><Plus /></el-icon>
                新建项目
              </el-dropdown-item>
              <el-dropdown-item @click="backToWelcome">
                <el-icon><Back /></el-icon>
                返回项目列表
              </el-dropdown-item>
              <el-dropdown-item divided @click="saveProject">
                <el-icon><Download /></el-icon>
                保存项目
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <el-input
        v-model="projectStore.searchKeyword"
        placeholder="搜索物品..."
        clearable
        :prefix-icon="Search"
        class="search-input"
      />
    </div>

    <div class="sidebar-content">
      <div class="sidebar-section">
        <div class="sidebar-section-title">全部视图</div>
        <div 
          class="sidebar-item"
          :class="{ active: !projectStore.selectedRoomId && !projectStore.selectedBoxId }"
          @click="projectStore.clearSelection()"
        >
          <el-icon class="sidebar-item-icon"><Box /></el-icon>
          <span class="sidebar-item-text">全部物品</span>
          <span class="sidebar-item-badge">{{ projectStore.stats.totalItems }}</span>
        </div>
        <div 
          class="sidebar-item"
          :class="{ active: showingUnboxed }"
          @click="showUnboxedItems"
        >
          <el-icon class="sidebar-item-icon"><DocumentRemove /></el-icon>
          <span class="sidebar-item-text">未装箱物品</span>
          <span class="sidebar-item-badge">{{ projectStore.stats.unpackedItems }}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>箱子 ({{ projectStore.boxes.length }})</span>
          <el-button type="primary" link size="small" :icon="Plus" @click="showAddBox = true" />
        </div>
        <div 
          v-for="box in projectStore.boxes" 
          :key="box.id"
          class="sidebar-item"
          :class="{ active: projectStore.selectedBoxId === box.id }"
          @click="projectStore.setSelectedBox(box.id)"
        >
          <el-tag :type="getBoxStatusType(box.status)" size="small" class="sidebar-item-icon" style="min-width: 50px;">
            #{{ box.boxNumber }}
          </el-tag>
          <span class="sidebar-item-text">{{ box.name || '未命名' }}</span>
          <span class="sidebar-item-badge">{{ getBoxItemCount(box.id) }}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>源房间</span>
        </div>
        <div 
          v-for="room in projectStore.sourceRooms" 
          :key="room.id"
          class="sidebar-item"
          :class="{ active: projectStore.selectedRoomId === room.id }"
          @click="projectStore.setSelectedRoom(room.id)"
        >
          <el-icon class="sidebar-item-icon"><HomeFilled /></el-icon>
          <span class="sidebar-item-text">{{ room.name }}</span>
          <span class="sidebar-item-badge">{{ getRoomItemCount(room.id) }}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>目标房间</span>
        </div>
        <div 
          v-for="room in projectStore.targetRooms" 
          :key="room.id"
          class="sidebar-item"
        >
          <el-icon class="sidebar-item-icon"><OfficeBuilding /></el-icon>
          <span class="sidebar-item-text">{{ room.name }}</span>
          <span class="sidebar-item-badge">{{ getTargetRoomBoxCount(room.id) }}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">标签筛选</div>
        <div style="padding: 0 12px;">
          <el-tag
            v-for="tag in systemTags"
            :key="tag"
            :type="projectStore.filterTags.includes(tag) ? 'primary' : 'info'"
            :effect="projectStore.filterTags.includes(tag) ? 'dark' : 'plain'"
            size="small"
            style="margin: 4px; cursor: pointer;"
            @click="projectStore.toggleFilterTag(tag)"
          >
            {{ tag }}
          </el-tag>
        </div>
        <div v-if="projectStore.filterTags.length > 0" style="padding: 8px 12px;">
          <el-button link size="small" @click="projectStore.clearFilterTags()">清除筛选</el-button>
        </div>
      </div>
    </div>

    <AddBoxDialog 
      v-model="showAddBox"
      @success="handleBoxAdded"
    />

    <CreateProjectDialog 
      v-model="showCreateProject"
      @success="handleProjectCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import AddBoxDialog from '@/components/AddBoxDialog.vue'
import CreateProjectDialog from '@/components/CreateProjectDialog.vue'
import { 
  Search, MoreFilled, Plus, Back, Download,
  Box, DocumentRemove, HomeFilled, OfficeBuilding 
} from '@element-plus/icons-vue'
import { BoxStatusColors } from '@/models/types'
import { ElMessage } from 'element-plus'

const projectStore = useProjectStore()
const showAddBox = ref(false)
const showCreateProject = ref(false)
const showingUnboxed = ref(false)

const systemTags = ['易碎', '贵重', '急用', '证件']

const currentProjectName = computed(() => {
  return projectStore.currentProject?.name || '未命名项目'
})

function getBoxStatusType(status) {
  return BoxStatusColors[status] || 'info'
}

function getBoxItemCount(boxId) {
  const stats = projectStore.getBoxStats(boxId)
  return stats.totalItems
}

function getRoomItemCount(roomId) {
  const items = projectStore.items.filter(i => i.roomId === roomId)
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

function getTargetRoomBoxCount(roomId) {
  return projectStore.boxes.filter(b => b.targetRoomId === roomId).length
}

function showUnboxedItems() {
  showingUnboxed.value = true
  projectStore.clearSelection()
}

function handleBoxAdded(box) {
  showAddBox.value = false
  projectStore.setSelectedBox(box.id)
}

function handleProjectCreated(project) {
  showCreateProject.value = false
}

function backToWelcome() {
  projectStore.currentProject = null
}

async function saveProject() {
  await projectStore.saveCurrentProject()
  ElMessage.success('项目已保存')
}
</script>
