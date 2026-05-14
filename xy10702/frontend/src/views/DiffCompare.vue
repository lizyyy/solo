<template>
  <div class="diff-compare">
    <h2>会话差异比较</h2>
    
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" label-width="80px">
        <el-form-item label="会话1">
          <el-select v-model="sessionId1" style="width: 300px" placeholder="选择第一个会话">
            <el-option
              v-for="s in sessions"
              :key="s.id"
              :label="`#${s.id} - ${s.state.slice(0, 20)}...`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="会话2">
          <el-select v-model="sessionId2" style="width: 300px" placeholder="选择第二个会话">
            <el-option
              v-for="s in sessions"
              :key="s.id"
              :label="`#${s.id} - ${s.state.slice(0, 20)}...`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="compare" :loading="loading">比较</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-if="diffResult">
      <el-alert
        :title="'发现 ' + (Object.keys(diffResult.differences || {}).length || 0) + ' 处差异'"
        type="info"
        show-icon
        style="margin-bottom: 20px"
      />

      <el-row :gutter="20">
        <el-col :span="12">
          <el-card class="session-card session1">
            <template #header>
              <span>会话 #{{ sessionId1 }}</span>
              <el-tag type="success" size="small">基准</el-tag>
            </template>
            <div class="diff-item" v-for="(val, key) in diffResult.session1" :key="key">
              <label>{{ key }}:</label>
              <span :class="{ 'diff-highlight': isDifferent(key) }">{{ formatValue(val) }}</span>
            </div>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card class="session-card session2">
            <template #header>
              <span>会话 #{{ sessionId2 }}</span>
              <el-tag type="warning" size="small">对比</el-tag>
            </template>
            <div class="diff-item" v-for="(val, key) in diffResult.session2" :key="key">
              <label>{{ key }}:</label>
              <span :class="{ 'diff-highlight': isDifferent(key) }">{{ formatValue(val) }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card style="margin-top: 20px">
        <template #header>时间线对比</template>
        <el-row :gutter="20">
          <el-col :span="12">
            <h4>会话 {{ sessionId1 }}</h4>
            <el-timeline>
              <el-timeline-item
                v-for="event in diffResult.session1.timeline_events"
                :key="event.id"
                :timestamp="formatDate(event.timestamp)"
                :color="getTimelineColor(event.path)"
              >
                {{ event.title }}
              </el-timeline-item>
            </el-timeline>
          </el-col>
          <el-col :span="12">
            <h4>会话 {{ sessionId2 }}</h4>
            <el-timeline>
              <el-timeline-item
                v-for="event in diffResult.session2.timeline_events"
                :key="event.id"
                :timestamp="formatDate(event.timestamp)"
                :color="getTimelineColor(event.path)"
              >
                {{ event.title }}
              </el-timeline-item>
            </el-timeline>
          </el-col>
        </el-row>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const loading = ref(false)
const sessions = ref([])
const sessionId1 = ref(null)
const sessionId2 = ref(null)
const diffResult = ref(null)

const loadSessions = async () => {
  try {
    const res = await api.getSessions()
    sessions.value = res.data
  } catch (e) {
    ElMessage.error('加载会话列表失败')
  }
}

const compare = async () => {
  if (!sessionId1.value || !sessionId2.value) {
    ElMessage.warning('请选择两个会话进行比较')
    return
  }
  if (sessionId1.value === sessionId2.value) {
    ElMessage.warning('请选择两个不同的会话')
    return
  }

  loading.value = true
  try {
    const res = await api.compareSessions(sessionId1.value, sessionId2.value)
    diffResult.value = res.data
    ElMessage.success('对比完成')
  } catch (e) {
    ElMessage.error('对比失败')
  } finally {
    loading.value = false
  }
}

const isDifferent = (key) => {
  if (!diffResult.value?.differences) return false
  return Object.keys(diffResult.value.differences).some(k => key.includes(k))
}

const formatValue = (val) => {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'boolean') return val ? '是' : '否'
  if (Array.isArray(val)) return `[${val.length} 项]`
  if (typeof val === 'object') return '[对象]'
  return String(val).slice(0, 50)
}

const getTimelineColor = (path) => {
  const map = { success: '#67c23a', blocked: '#f56c6c', compensation: '#e6a23c' }
  return map[path] || '#409eff'
}

const formatDate = (dateStr) => {
  return dateStr ? new Date(dateStr).toLocaleString('zh-CN') : '-'
}

onMounted(() => {
  loadSessions()
})
</script>

<style scoped>
.diff-compare h2 {
  margin: 0 0 20px 0;
  color: #303133;
}

.diff-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.diff-item label {
  font-weight: 500;
  color: #606266;
}

.diff-highlight {
  background: #fef0f0;
  color: #f56c6c;
  padding: 2px 6px;
  border-radius: 4px;
}

h4 {
  margin: 0 0 16px 0;
  color: #303133;
}
</style>
