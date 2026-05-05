<template>
  <div class="app-container">
    <el-header class="header">
      <h1>🚚 仓库无人车调度沙盘系统</h1>
    </el-header>
    
    <el-container class="main-container">
      <el-aside width="350px" class="sidebar">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="数据导入" name="import">
            <DataImportPanel @map-loaded="handleMapLoaded" />
          </el-tab-pane>
          
          <el-tab-pane label="调度控制" name="scheduling">
            <SchedulingPanel 
              :warehouse-map-id="currentMapId"
              @batch-created="handleBatchCreated"
            />
          </el-tab-pane>
          
          <el-tab-pane label="回放控制" name="replay">
            <ReplayPanel 
              @frames-loaded="handleFramesLoaded"
              @play="handlePlay"
              @pause="handlePause"
              @seek="handleSeek"
            />
          </el-tab-pane>
          
          <el-tab-pane label="对比分析" name="comparison">
            <ComparisonPanel @comparison-result="handleComparisonResult" />
          </el-tab-pane>
        </el-tabs>
      </el-aside>
      
      <el-main class="main-content">
        <div class="viewer-container" ref="viewerRef">
          <Warehouse3DViewer 
            ref="viewer"
            :map-data="mapData"
            :frames="replayFrames"
            :current-frame="currentFrame"
            :is-playing="isPlaying"
          />
        </div>
        
        <div class="status-bar">
          <el-row :gutter="20">
            <el-col :span="6">
              <div class="status-item">
                <span class="label">当前地图:</span>
                <span class="value">{{ mapData?.name || '未加载' }}</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="status-item">
                <span class="label">机器人数量:</span>
                <span class="value">{{ robotCount }}</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="status-item">
                <span class="label">当前帧:</span>
                <span class="value">{{ currentFrame + 1 }} / {{ totalFrames }}</span>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="status-item">
                <span class="label">播放状态:</span>
                <span class="value" :class="{ playing: isPlaying }">
                  {{ isPlaying ? '播放中' : '已暂停' }}
                </span>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DataImportPanel from './components/DataImportPanel.vue'
import SchedulingPanel from './components/SchedulingPanel.vue'
import ReplayPanel from './components/ReplayPanel.vue'
import ComparisonPanel from './components/ComparisonPanel.vue'
import Warehouse3DViewer from './components/Warehouse3DViewer.vue'

const activeTab = ref('import')
const viewerRef = ref(null)
const viewer = ref(null)

const mapData = ref(null)
const currentMapId = ref(null)
const replayFrames = ref([])
const currentFrame = ref(0)
const totalFrames = ref(0)
const isPlaying = ref(false)
const playInterval = ref(null)

const robotCount = computed(() => {
  if (replayFrames.value.length > 0 && currentFrame.value < replayFrames.value.length) {
    return replayFrames.value[currentFrame.value]?.robots?.length || 0
  }
  return 0
})

const handleMapLoaded = (data) => {
  mapData.value = data
  currentMapId.value = data.id
}

const handleBatchCreated = (batchId) => {
  console.log('Batch created:', batchId)
}

const handleFramesLoaded = (frames) => {
  replayFrames.value = frames
  totalFrames.value = frames.length
  currentFrame.value = 0
  if (frames.length > 0 && viewer.value) {
    viewer.value.setInitialFrame(frames[0])
  }
}

const handlePlay = () => {
  if (replayFrames.value.length === 0) return
  
  isPlaying.value = true
  if (playInterval.value) {
    clearInterval(playInterval.value)
  }
  
  playInterval.value = setInterval(() => {
    if (currentFrame.value < replayFrames.value.length - 1) {
      currentFrame.value++
    } else {
      isPlaying.value = false
      clearInterval(playInterval.value)
    }
  }, 100)
}

const handlePause = () => {
  isPlaying.value = false
  if (playInterval.value) {
    clearInterval(playInterval.value)
    playInterval.value = null
  }
}

const handleSeek = (frame) => {
  currentFrame.value = frame
}

const handleComparisonResult = (result) => {
  console.log('Comparison result:', result)
}

onMounted(() => {
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
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  height: 60px !important;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

.main-container {
  flex: 1;
  overflow: hidden;
}

.sidebar {
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  padding: 10px;
  overflow-y: auto;
}

.main-content {
  background: #1a1a2e;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-container {
  flex: 1;
  position: relative;
}

.status-bar {
  background: #16213e;
  color: #e4e7ed;
  padding: 10px 20px;
  border-top: 1px solid #333;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-item .label {
  color: #909399;
  font-size: 0.85rem;
}

.status-item .value {
  color: #fff;
  font-weight: 500;
}

.status-item .value.playing {
  color: #67c23a;
}

.el-tabs {
  height: 100%;
}

.el-tabs__content {
  height: calc(100% - 40px);
  overflow-y: auto;
}

.el-tab-pane {
  padding: 10px 0;
}
</style>
