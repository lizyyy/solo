<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">🌟 观测夜复盘工具</h1>
        <p class="app-subtitle">校园天文社 - 流星观测数据整合与分析</p>
      </div>
    </header>

    <!-- 主要内容区 -->
    <main class="app-main">
      <!-- 左侧面板：数据导入和统计 -->
      <aside class="left-panel">
        <!-- 数据导入组件 -->
        <DataImport @import-success="handleImportSuccess" />
        
        <!-- 统计面板 -->
        <div class="stats-panel" v-if="events.length > 0">
          <h3>📊 统计概览</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ events.length }}</span>
              <span class="stat-label">总事件数</span>
            </div>
            <div class="stat-item confirmed">
              <span class="stat-value">{{ statsByStatus.confirmed || 0 }}</span>
              <span class="stat-label">已确认</span>
            </div>
            <div class="stat-item pending">
              <span class="stat-value">{{ statsByStatus.pending || 0 }}</span>
              <span class="stat-label">待处理</span>
            </div>
            <div class="stat-item needs-review">
              <span class="stat-value">{{ statsByStatus.needs_review || 0 }}</span>
              <span class="stat-label">需复核</span>
            </div>
          </div>
        </div>

        <!-- 导出面板 -->
        <ExportPanel :selected-events="selectedEvents" :all-events="events" />
      </aside>

      <!-- 中间面板：时间轴和事件列表 -->
      <section class="center-panel">
        <!-- 时间轴视图 -->
        <TimelineView 
          :events="events" 
          @select-event="selectEvent"
          :selected-event-id="selectedEvent?.id"
        />

        <!-- 事件列表 -->
        <EventList 
          :events="events" 
          @select-event="selectEvent"
          @toggle-selection="toggleEventSelection"
          :selected-event-id="selectedEvent?.id"
          :selected-event-ids="selectedEventIds"
        />
      </section>

      <!-- 右侧面板：事件详情和编辑 -->
      <aside class="right-panel" v-if="selectedEvent">
        <EventDetail 
          :event="selectedEvent" 
          @update-event="handleUpdateEvent"
        />
      </aside>
    </main>

    <!-- 底部状态栏 -->
    <footer class="app-footer">
      <div class="footer-content">
        <span v-if="events.length > 0">
          已加载 {{ events.length }} 个事件 | 
          选中 {{ selectedEventIds.length }} 个事件
        </span>
        <span v-else>
          请导入观测数据开始分析
        </span>
      </div>
    </footer>

    <!-- 消息提示 -->
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import DataImport from './components/DataImport.vue'
import TimelineView from './components/TimelineView.vue'
import EventList from './components/EventList.vue'
import EventDetail from './components/EventDetail.vue'
import ExportPanel from './components/ExportPanel.vue'

export default {
  name: 'App',
  components: {
    DataImport,
    TimelineView,
    EventList,
    EventDetail,
    ExportPanel
  },
  setup() {
    // 状态管理
    const events = ref([])
    const selectedEvent = ref(null)
    const selectedEventIds = ref([])
    const message = ref('')
    const messageType = ref('info')

    // 计算属性：按状态统计
    const statsByStatus = computed(() => {
      const stats = {}
      for (const event of events.value) {
        stats[event.status] = (stats[event.status] || 0) + 1
      }
      return stats
    })

    // 加载事件
    const loadEvents = async () => {
      try {
        const response = await axios.get('/api/events')
        if (response.data.success) {
          events.value = response.data.data
        }
      } catch (error) {
        console.error('加载事件失败:', error)
        showMessage('加载事件失败', 'error')
      }
    }

    // 显示消息
    const showMessage = (msg, type = 'info') => {
      message.value = msg
      messageType.value = type
      setTimeout(() => {
        message.value = ''
      }, 3000)
    }

    // 处理导入成功
    const handleImportSuccess = (result) => {
      showMessage(`成功导入 ${result.importResults.length} 个文件，创建 ${result.mergedEvents.length} 个事件`, 'success')
      loadEvents()
    }

    // 选择事件
    const selectEvent = (event) => {
      selectedEvent.value = event
    }

    // 切换事件选中状态（用于批量操作）
    const toggleEventSelection = (eventId) => {
      const index = selectedEventIds.value.indexOf(eventId)
      if (index > -1) {
        selectedEventIds.value.splice(index, 1)
      } else {
        selectedEventIds.value.push(eventId)
      }
    }

    // 处理事件更新
    const handleUpdateEvent = async ({ eventId, updates }) => {
      try {
        const response = await axios.put(`/api/events/${eventId}`, updates)
        if (response.data.success) {
          showMessage('事件已更新', 'success')
          // 更新本地状态
          const index = events.value.findIndex(e => e.id === eventId)
          if (index > -1) {
            events.value[index] = response.data.data
          }
          if (selectedEvent.value && selectedEvent.value.id === eventId) {
            selectedEvent.value = response.data.data
          }
        }
      } catch (error) {
        console.error('更新事件失败:', error)
        showMessage('更新事件失败', 'error')
      }
    }

    // 组件挂载时加载数据
    onMounted(() => {
      loadEvents()
    })

    return {
      events,
      selectedEvent,
      selectedEventIds,
      statsByStatus,
      message,
      messageType,
      handleImportSuccess,
      selectEvent,
      toggleEventSelection,
      handleUpdateEvent
    }
  }
}
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
}

.app-title {
  font-size: 1.8rem;
  margin-bottom: 0.25rem;
}

.app-subtitle {
  font-size: 0.9rem;
  opacity: 0.8;
}

.app-main {
  flex: 1;
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

.left-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.center-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

.right-panel {
  width: 380px;
  flex-shrink: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.stats-panel {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stats-panel h3 {
  margin-bottom: 1rem;
  font-size: 1rem;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
}

.stat-item.confirmed .stat-value {
  color: #28a745;
}

.stat-item.pending .stat-value {
  color: #ffc107;
}

.stat-item.needs-review .stat-value {
  color: #fd7e14;
}

.app-footer {
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  padding: 0.75rem 2rem;
}

.footer-content {
  max-width: 1600px;
  margin: 0 auto;
  font-size: 0.875rem;
  color: #666;
}

.message {
  position: fixed;
  top: 80px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 1200px) {
  .app-main {
    flex-direction: column;
  }
  
  .left-panel,
  .right-panel {
    width: 100%;
  }
}
</style>
