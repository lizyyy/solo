<template>
  <div class="app">
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <span class="logo-icon">🏥</span>
            <span class="logo-text">分诊转运压测台</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          <router-link 
            v-for="route in navRoutes" 
            :key="route.path"
            :to="route.path" 
            class="nav-link"
            :class="{ active: $route.path === route.path }"
          >
            <span class="nav-icon">{{ route.meta.icon }}</span>
            <span class="nav-text">{{ route.meta.title }}</span>
          </router-link>
        </nav>
        <div class="sidebar-footer">
          <div class="connection-status" :class="{ connected: wsConnected }">
            <span class="status-dot"></span>
            <span class="status-text">{{ wsConnected ? '已连接' : '未连接' }}</span>
          </div>
        </div>
      </aside>
      
      <main class="main-content">
        <header class="header">
          <div class="header-left">
            <h1 class="page-title">{{ currentRoute.meta.title }}</h1>
          </div>
          <div class="header-right">
            <button class="btn btn-secondary btn-sm" @click="handleRefresh">
              🔄 刷新数据
            </button>
            <button 
              class="btn btn-primary btn-sm" 
              @click="handleLoadSample"
              :disabled="loading"
            >
              📊 加载示例数据
            </button>
          </div>
        </header>
        
        <div class="content-area">
          <router-view />
        </div>
      </main>
    </div>
    
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="toastMessage" class="toast-container">
          <div class="toast" :class="toastType">
            <span class="toast-icon">{{ toastIcon }}</span>
            <span class="toast-text">{{ toastMessage }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePatientsStore } from '@/stores/patients'
import { useTransfersStore } from '@/stores/transfers'
import { useSystemStore } from '@/stores/system'

const route = useRoute()
const router = useRouter()
const patientsStore = usePatientsStore()
const transfersStore = useTransfersStore()
const systemStore = useSystemStore()

const wsConnected = ref(false)
const loading = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const navRoutes = computed(() => 
  router.options.routes.filter(r => r.meta && r.meta.title && r.path !== '/')
)

const currentRoute = computed(() => route)

const toastIcon = computed(() => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  return icons[toastType.value] || 'ℹ️'
})

function showToast(message, type = 'success') {
  toastMessage.value = message
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

async function handleRefresh() {
  loading.value = true
  try {
    await Promise.all([
      patientsStore.fetchPatients(),
      transfersStore.fetchTransfers(),
      systemStore.fetchDepartments(),
      systemStore.fetchBeds(),
      systemStore.fetchLogs(),
      systemStore.runRulesCheck()
    ])
    showToast('数据已刷新', 'success')
  } catch (error) {
    showToast('刷新数据失败: ' + error.message, 'error')
  } finally {
    loading.value = false
  }
}

async function handleLoadSample() {
  if (!confirm('确定要加载示例数据吗？这将添加示例患者、科室和转运数据。')) {
    return
  }
  
  loading.value = true
  try {
    await systemStore.createSampleData()
    await handleRefresh()
    showToast('示例数据已加载', 'success')
  } catch (error) {
    showToast('加载示例数据失败: ' + error.message, 'error')
  } finally {
    loading.value = false
  }
}

let ws = null

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}`
  
  ws = new WebSocket(wsUrl)
  
  ws.onopen = () => {
    console.log('WebSocket 已连接')
    wsConnected.value = true
    ws.send(JSON.stringify({ type: 'subscribe' }))
  }
  
  ws.onclose = () => {
    console.log('WebSocket 已断开')
    wsConnected.value = false
    setTimeout(initWebSocket, 5000)
  }
  
  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error)
    wsConnected.value = false
  }
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      handleWebSocketMessage(data)
    } catch (error) {
      console.error('解析 WebSocket 消息失败:', error)
    }
  }
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'pong':
      break
    case 'rule_results':
      systemStore.updateRuleResults(data.data)
      break
    case 'patient_update':
      if (data.action === 'created') {
        patientsStore.addPatientToList(data.data)
      } else if (data.action === 'updated') {
        patientsStore.updatePatientInList(data.data)
      } else if (data.action === 'deleted') {
        patientsStore.removePatientFromList(data.data.id)
      }
      break
    case 'transfer_update':
      if (data.action === 'created') {
        transfersStore.addTransferToList(data.data)
      } else if (data.action === 'updated') {
        transfersStore.updateTransferInList(data.data)
      }
      break
    case 'log_entry':
      systemStore.addLogEntry(data.data)
      break
    case 'incident':
      showToast(`异常事件: ${data.data.description || data.data.type}`, 'warning')
      break
  }
}

onMounted(() => {
  initWebSocket()
  handleRefresh()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
})
</script>

<style scoped>
.app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.app-layout {
  display: flex;
  height: 100%;
}

.sidebar {
  width: var(--sidebar-width);
  background-color: var(--color-gray-900);
  color: white;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--color-gray-800);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: var(--color-gray-400);
  text-decoration: none;
  border-radius: var(--radius);
  transition: all var(--transition-fast);
  margin-bottom: 4px;
}

.nav-link:hover {
  background-color: var(--color-gray-800);
  color: white;
  text-decoration: none;
}

.nav-link.active {
  background-color: var(--color-blue);
  color: white;
}

.nav-icon {
  font-size: 18px;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-gray-800);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-gray-500);
  font-size: 13px;
}

.connection-status.connected {
  color: var(--color-green);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-gray-500);
}

.connection-status.connected .status-dot {
  background-color: var(--color-green);
  box-shadow: 0 0 6px var(--color-green);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  height: var(--header-height);
  background-color: white;
  border-bottom: 1px solid var(--color-gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-gray-900);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.toast-container {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 9999;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: white;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  border-left: 4px solid;
  min-width: 280px;
}

.toast.success {
  border-left-color: var(--color-green);
}

.toast.error {
  border-left-color: var(--color-red);
}

.toast.warning {
  border-left-color: var(--color-yellow);
}

.toast.info {
  border-left-color: var(--color-blue);
}

.toast-icon {
  font-size: 18px;
}

.toast-text {
  font-size: 14px;
  color: var(--color-gray-800);
}
</style>
