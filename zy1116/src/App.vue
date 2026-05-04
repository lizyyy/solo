<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-left">
        <el-icon :size="24" color="#409EFF">
          <VideoCamera />
        </el-icon>
        <span class="title">剧场CUE管理器</span>
      </div>
      <div class="header-center">
        <el-select 
          v-model="currentShowId" 
          placeholder="选择演出" 
          style="width: 300px"
          @change="handleShowChange"
        >
          <el-option
            v-for="show in shows"
            :key="show.id"
            :label="`${show.name} - ${show.date}`"
            :value="show.id"
          />
        </el-select>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showCreateShow = true">
          <el-icon><Plus /></el-icon>
          新建演出
        </el-button>
        <el-button @click="runConflictCheck">
          <el-icon><Warning /></el-icon>
          冲突检查
        </el-button>
        <el-dropdown @command="handleExport">
          <el-button type="success">
            <el-icon><Download /></el-icon>
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="execution">当日执行单</el-dropdown-item>
              <el-dropdown-item command="conflicts">冲突清单</el-dropdown-item>
              <el-dropdown-item command="report">复盘报告</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="main-container">
      <el-aside width="280px" class="left-panel">
        <LeftPanel 
          :current-show-id="currentShowId"
          @select-scene="handleSelectScene"
          @refresh="refreshData"
        />
      </el-aside>

      <el-main class="center-panel">
        <CenterPanel
          :current-show-id="currentShowId"
          :selected-scene-id="selectedSceneId"
          @select-cue="handleSelectCue"
          @refresh="refreshData"
        />
      </el-main>

      <el-aside width="350px" class="right-panel">
        <RightPanel
          :cue-id="selectedCueId"
          @refresh="refreshData"
        />
      </el-aside>
    </el-container>

    <el-dialog
      v-model="showCreateShow"
      title="新建演出"
      width="500px"
      @closed="resetNewShowForm"
    >
      <el-form :model="newShowForm" label-width="80px">
        <el-form-item label="演出名称" required>
          <el-input v-model="newShowForm.name" placeholder="请输入演出名称" />
        </el-form-item>
        <el-form-item label="演出日期" required>
          <el-date-picker
            v-model="newShowForm.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="演出地点">
          <el-input v-model="newShowForm.venue" placeholder="请输入演出地点" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="newShowForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateShow = false">取消</el-button>
        <el-button type="primary" @click="createShow">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showConflictResult"
      title="冲突检查结果"
      width="800px"
    >
      <el-table :data="conflicts" stripe>
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getConflictTagType(row.severity)">
              {{ getConflictTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="severity" label="严重程度" width="100">
          <template #default="{ row }">
            <el-tag :type="getConflictTagType(row.severity)">
              {{ row.severity === 'critical' ? '严重' : '警告' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.resolved ? 'success' : 'danger'">
              {{ row.resolved ? '已解决' : '未解决' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showConflictResult = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useShowStore } from '@/stores/showStore'
import LeftPanel from '@/components/LeftPanel.vue'
import CenterPanel from '@/components/CenterPanel.vue'
import RightPanel from '@/components/RightPanel.vue'
import { v4 as uuidv4 } from 'uuid'

const showStore = useShowStore()

const shows = ref([])
const currentShowId = ref(null)
const selectedSceneId = ref(null)
const selectedCueId = ref(null)
const showCreateShow = ref(false)
const showConflictResult = ref(false)
const conflicts = ref([])

const newShowForm = ref({
  name: '',
  date: '',
  venue: '',
  description: ''
})

const loadShows = async () => {
  shows.value = await showStore.getAllShows()
}

const handleShowChange = async (showId) => {
  selectedSceneId.value = null
  selectedCueId.value = null
  await refreshData()
}

const handleSelectScene = (sceneId) => {
  selectedSceneId.value = sceneId
  selectedCueId.value = null
}

const handleSelectCue = (cueId) => {
  selectedCueId.value = cueId
}

const refreshData = async () => {
  await loadShows()
}

const createShow = async () => {
  if (!newShowForm.value.name || !newShowForm.value.date) {
    ElMessage.warning('请填写演出名称和日期')
    return
  }

  const showId = uuidv4()
  const show = {
    id: showId,
    ...newShowForm.value
  }

  await showStore.createShow(show)
  currentShowId.value = showId
  showCreateShow.value = false
  ElMessage.success('演出创建成功')
  await refreshData()
}

const resetNewShowForm = () => {
  newShowForm.value = {
    name: '',
    date: '',
    venue: '',
    description: ''
  }
}

const runConflictCheck = async () => {
  if (!currentShowId.value) {
    ElMessage.warning('请先选择一个演出')
    return
  }

  const result = await showStore.checkConflicts(currentShowId.value)
  conflicts.value = result
  showConflictResult.value = true
}

const getConflictTagType = (severity) => {
  return severity === 'critical' ? 'danger' : 'warning'
}

const getConflictTypeLabel = (type) => {
  const labels = {
    device_conflict: '设备冲突',
    transition_time: '换场时间',
    actor_waiting: '演员候场',
    prop_status: '道具状态',
    mic_battery: '麦克风电量'
  }
  return labels[type] || type
}

const handleExport = async (command) => {
  if (!currentShowId.value) {
    ElMessage.warning('请先选择一个演出')
    return
  }

  try {
    const result = await showStore.exportData(currentShowId.value, command)
    ElMessage.success(`导出成功: ${result.filePath}`)
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

onMounted(async () => {
  await showStore.init()
  await loadShows()
  // 加载示例数据
  await showStore.loadSampleData()
  await loadShows()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left .title {
  color: white;
  font-size: 20px;
  font-weight: 600;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 40px;
}

.header-right {
  display: flex;
  gap: 10px;
}

.main-container {
  flex: 1;
  min-height: 0;
}

.left-panel {
  background: #f8f9fa;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
}

.center-panel {
  background: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.right-panel {
  background: #f8f9fa;
  border-left: 1px solid #e4e7ed;
  overflow-y: auto;
}
</style>
