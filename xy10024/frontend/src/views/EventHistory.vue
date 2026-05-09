<template>
  <div>
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>
            <el-tag type="info" style="margin-right: 8px;">{{ aggregateType }}</el-tag>
            {{ aggregateId.substring(0, 12) }}... 的事件历史
          </span>
          <div>
            <el-button type="primary" @click="replayAggregate">
              <el-icon><VideoPlay /></el-icon>
              回放状态
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="replayedState"
        type="success"
        title="回放完成"
        :closable="false"
        style="margin-bottom: 16px;"
      >
        <pre style="background: #f0f9eb; padding: 12px; border-radius: 4px; margin: 0; overflow-x: auto;">
{{ formatState(replayedState) }}</pre>
      </el-alert>

      <div class="event-timeline" v-loading="loading">
        <div v-for="event in events" :key="event.id" class="event-item">
          <div class="event-type">
            <el-tag :type="getEventType(event.event_type)" size="small">
              {{ event.event_type }}
            </el-tag>
            <span style="margin-left: 8px;">版本 v{{ event.event_version }}</span>
          </div>
          <div class="event-time">
            <span>序列: {{ event.sequence }}</span>
            <span style="margin-left: 16px;">{{ formatDate(event.created_at) }}</span>
            <span v-if="event.created_by" style="margin-left: 16px;">
              操作人: {{ event.created_by.substring(0, 8) }}...
            </span>
            <span v-if="event.request_id" style="margin-left: 16px;">
              请求: {{ event.request_id.substring(0, 12) }}...
            </span>
          </div>
          <div class="event-payload">
            <strong>Payload:</strong><br />
            {{ formatState(event.payload) }}
          </div>
          <div v-if="event.metadata" class="event-payload" style="background: #fdf6ec;">
            <strong>Metadata:</strong><br />
            {{ formatState(event.metadata) }}
          </div>
        </div>

        <el-empty v-if="events.length === 0" description="暂无事件记录" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getEventHistory, replayAggregate as apiReplayAggregate } from '@/api/audit'
import dayjs from 'dayjs'

const route = useRoute()
const aggregateType = ref(route.params.type)
const aggregateId = ref(route.params.id)

const loading = ref(false)
const events = ref([])
const replayedState = ref(null)

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

function formatState(state) {
  try {
    return JSON.stringify(state, null, 2)
  } catch {
    return String(state)
  }
}

function getEventType(type) {
  if (type.includes('.created') || type.includes('.borrowed')) return 'success'
  if (type.includes('.updated')) return 'primary'
  if (type.includes('.deleted') || type.includes('.returned') || type.includes('.completed')) return 'danger'
  return 'info'
}

async function loadEvents() {
  loading.value = true
  try {
    const res = await getEventHistory(aggregateType.value, aggregateId.value, 100)
    events.value = res.events?.reverse() || []
  } catch (error) {
    console.error('Failed to load events:', error)
  } finally {
    loading.value = false
  }
}

async function replayAggregate() {
  loading.value = true
  try {
    const res = await apiReplayAggregate(aggregateType.value, aggregateId.value)
    replayedState.value = res.state
  } catch (error) {
    console.error('Failed to replay aggregate:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadEvents()
})
</script>
