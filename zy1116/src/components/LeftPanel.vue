<template>
  <div class="left-panel-container">
    <div class="panel-header">
      <span class="panel-title">节目与场景</span>
      <el-tooltip content="刷新" placement="top">
        <el-button text @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <div v-if="!currentShowId" class="empty-state">
      <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
      <p>请先选择一个演出</p>
    </div>

    <el-tree
      v-else
      :data="treeData"
      :props="treeProps"
      node-key="id"
      default-expand-all
      highlight-current
      @node-click="handleNodeClick"
      class="program-tree"
    >
      <template #default="{ node, data }">
        <div class="tree-node-content">
          <el-icon v-if="data.type === 'program'" color="#409EFF"><Collection /></el-icon>
          <el-icon v-else-if="data.type === 'scene'" color="#67c23a"><Picture /></el-icon>
          <span class="node-label">{{ data.label }}</span>
          <span v-if="data.type === 'program'" class="node-badge">{{ data.sceneCount }}场景</span>
        </div>
      </template>
    </el-tree>

    <el-divider />

    <div class="resource-section">
      <div class="section-header">
        <span class="section-title">资源清单</span>
      </div>
      
      <el-collapse v-model="activeNames">
        <el-collapse-item name="actors">
          <template #title>
            <div class="collapse-title">
              <el-icon><User /></el-icon>
              <span>演员 ({{ actors.length }})</span>
            </div>
          </template>
          <div class="actor-list">
            <div v-for="actor in actors" :key="actor.id" class="actor-item">
              <el-avatar :size="32" class="actor-avatar">
                {{ actor.name.charAt(0) }}
              </el-avatar>
              <div class="actor-info">
                <div class="actor-name">{{ actor.name }}</div>
                <div class="actor-role">{{ actor.role || '无角色' }}</div>
              </div>
              <el-tag :type="actor.status === 'available' ? 'success' : 'info'" size="small">
                {{ actor.status === 'available' ? '可用' : '忙' }}
              </el-tag>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="props">
          <template #title>
            <div class="collapse-title">
              <el-icon><Box /></el-icon>
              <span>道具 ({{ props.length }})</span>
            </div>
          </template>
          <div class="prop-list">
            <div v-for="prop in props" :key="prop.id" class="prop-item">
              <div class="prop-info">
                <div class="prop-name">{{ prop.name }}</div>
                <div class="prop-location">{{ prop.location || '未知位置' }}</div>
              </div>
              <el-tag :type="prop.status === 'stored' ? 'info' : 'warning'" size="small">
                {{ prop.status === 'stored' ? '入库' : '场上' }}
              </el-tag>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="mics">
          <template #title>
            <div class="collapse-title">
              <el-icon><Microphone /></el-icon>
              <span>麦克风 ({{ microphones.length }})</span>
            </div>
          </template>
          <div class="mic-list">
            <div v-for="mic in microphones" :key="mic.id" class="mic-item">
              <div class="mic-info">
                <div class="mic-name">{{ mic.name }}</div>
                <div class="mic-channel">通道 {{ mic.channel }}</div>
              </div>
              <div class="mic-battery">
                <el-progress 
                  :percentage="mic.battery_level" 
                  :status="mic.battery_level < 20 ? 'exception' : mic.battery_level < 50 ? 'warning' : ''"
                  :stroke-width="8"
                  :show-text="false"
                  style="width: 60px"
                />
                <span class="battery-text">{{ mic.battery_level }}%</span>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useShowStore } from '@/stores/showStore'

const props = defineProps({
  currentShowId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select-scene', 'refresh'])

const showStore = useShowStore()

const programs = ref([])
const actors = ref([])
const props_ = ref([])
const microphones = ref([])
const activeNames = ref(['actors', 'props', 'mics'])

const treeProps = {
  children: 'children',
  label: 'label'
}

const treeData = computed(() => {
  return programs.value.map(prog => ({
    id: prog.id,
    type: 'program',
    label: prog.name,
    sceneCount: prog.scenes?.length || 0,
    children: prog.scenes?.map(scene => ({
      id: scene.id,
      type: 'scene',
      label: scene.name,
      programId: prog.id
    })) || []
  }))
})

const loadData = async () => {
  if (!props.currentShowId) return

  programs.value = await showStore.getProgramsByShow(props.currentShowId)
  
  for (const prog of programs.value) {
    prog.scenes = await showStore.getScenesByProgram(prog.id)
  }

  actors.value = await showStore.getActorsByShow(props.currentShowId)
  props_.value = await showStore.getPropsByShow(props.currentShowId)
  microphones.value = await showStore.getMicrophonesByShow(props.currentShowId)
}

const handleNodeClick = (data) => {
  if (data.type === 'scene') {
    emit('select-scene', data.id)
  }
}

watch(() => props.currentShowId, () => {
  loadData()
}, { immediate: true })

onMounted(() => {
  if (props.currentShowId) {
    loadData()
  }
})
</script>

<style scoped>
.left-panel-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  padding: 40px 20px;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.program-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.node-label {
  flex: 1;
  font-size: 13px;
}

.node-badge {
  font-size: 11px;
  color: #909399;
  background: #f4f4f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.resource-section {
  flex-shrink: 0;
  padding: 0 8px 8px;
}

.section-header {
  padding: 8px 4px;
}

.section-title {
  font-weight: 600;
  font-size: 13px;
  color: #606266;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.actor-list,
.prop-list,
.mic-list {
  max-height: 200px;
  overflow-y: auto;
}

.actor-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-radius: 4px;
}

.actor-item:hover {
  background: #f4f4f5;
}

.actor-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.actor-info {
  flex: 1;
  min-width: 0;
}

.actor-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.actor-role {
  font-size: 11px;
  color: #909399;
}

.prop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  border-radius: 4px;
}

.prop-item:hover {
  background: #f4f4f5;
}

.prop-info {
  flex: 1;
  min-width: 0;
}

.prop-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.prop-location {
  font-size: 11px;
  color: #909399;
}

.mic-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  border-radius: 4px;
}

.mic-item:hover {
  background: #f4f4f5;
}

.mic-info {
  flex: 1;
  min-width: 0;
}

.mic-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.mic-channel {
  font-size: 11px;
  color: #909399;
}

.mic-battery {
  display: flex;
  align-items: center;
  gap: 6px;
}

.battery-text {
  font-size: 11px;
  color: #606266;
  min-width: 30px;
}
</style>
