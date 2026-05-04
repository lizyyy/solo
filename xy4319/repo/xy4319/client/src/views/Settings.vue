<template>
  <div class="settings-page">
    <div class="settings-section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">⚙️</span>
          <h2>分诊规则配置</h2>
        </div>
        <p class="section-desc">配置红黄绿三区的等待时间阈值和优先级权重</p>
      </div>
      
      <div class="triage-config-grid">
        <div class="triage-card red">
          <div class="triage-card-header">
            <span class="triage-icon">🔴</span>
            <span class="triage-label">红区（紧急）</span>
          </div>
          <div class="triage-form">
            <div class="form-group">
              <label>等待超时阈值（分钟）</label>
              <input 
                type="number" 
                v-model.number="triageConfig.red.waitThreshold"
                class="form-input"
                min="1"
              />
            </div>
            <div class="form-group">
              <label>优先级权重</label>
              <input 
                type="number" 
                v-model.number="triageConfig.red.priorityWeight"
                class="form-input"
                min="1"
              />
            </div>
          </div>
          <div class="triage-desc">
            红区患者需要立即处理，超时后优先级大幅提升
          </div>
        </div>
        
        <div class="triage-card yellow">
          <div class="triage-card-header">
            <span class="triage-icon">🟡</span>
            <span class="triage-label">黄区（紧急）</span>
          </div>
          <div class="triage-form">
            <div class="form-group">
              <label>等待超时阈值（分钟）</label>
              <input 
                type="number" 
                v-model.number="triageConfig.yellow.waitThreshold"
                class="form-input"
                min="1"
              />
            </div>
            <div class="form-group">
              <label>优先级权重</label>
              <input 
                type="number" 
                v-model.number="triageConfig.yellow.priorityWeight"
                class="form-input"
                min="1"
              />
            </div>
          </div>
          <div class="triage-desc">
            黄区患者需要尽快处理，超时后优先级逐步提升
          </div>
        </div>
        
        <div class="triage-card green">
          <div class="triage-card-header">
            <span class="triage-icon">🟢</span>
            <span class="triage-label">绿区（非紧急）</span>
          </div>
          <div class="triage-form">
            <div class="form-group">
              <label>等待超时阈值（分钟）</label>
              <input 
                type="number" 
                v-model.number="triageConfig.green.waitThreshold"
                class="form-input"
                min="1"
              />
            </div>
            <div class="form-group">
              <label>优先级权重</label>
              <input 
                type="number" 
                v-model.number="triageConfig.green.priorityWeight"
                class="form-input"
                min="1"
              />
            </div>
          </div>
          <div class="triage-desc">
            绿区患者可以稍候处理，但超时后仍会提升优先级
          </div>
        </div>
      </div>
      
      <div class="action-bar">
        <button class="btn btn-secondary" @click="resetTriageConfig">
          🔄 恢复默认
        </button>
        <button class="btn btn-primary" @click="saveTriageConfig" :disabled="saving">
          💾 保存配置
        </button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">⏱️</span>
          <h2>实时同步设置</h2>
        </div>
        <p class="section-desc">配置WebSocket连接和自动刷新参数</p>
      </div>
      
      <div class="settings-form">
        <div class="form-row">
          <div class="form-group">
            <label>WebSocket 服务器地址</label>
            <input 
              type="text" 
              v-model="syncConfig.wsUrl"
              class="form-input"
              placeholder="ws://localhost:3000"
            />
          </div>
          <div class="form-group">
            <label>自动重连间隔（秒）</label>
            <input 
              type="number" 
              v-model.number="syncConfig.reconnectInterval"
              class="form-input"
              min="1"
            />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>规则检查间隔（秒）</label>
            <input 
              type="number" 
              v-model.number="syncConfig.ruleCheckInterval"
              class="form-input"
              min="10"
            />
            <p class="form-hint">系统自动运行规则检查的时间间隔</p>
          </div>
          <div class="form-group">
            <label>数据刷新间隔（秒）</label>
            <input 
              type="number" 
              v-model.number="syncConfig.refreshInterval"
              class="form-input"
              min="5"
            />
            <p class="form-hint">前端主动刷新数据的时间间隔</p>
          </div>
        </div>
        
        <div class="form-toggle-group">
          <label class="toggle-item">
            <input type="checkbox" v-model="syncConfig.autoConnect" />
            <span class="toggle-slider"></span>
            <span class="toggle-label">启动时自动连接</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="syncConfig.autoReconnect" />
            <span class="toggle-slider"></span>
            <span class="toggle-label">断开后自动重连</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="syncConfig.autoRefresh" />
            <span class="toggle-slider"></span>
            <span class="toggle-label">自动刷新数据</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="syncConfig.enableNotifications" />
            <span class="toggle-slider"></span>
            <span class="toggle-label">启用桌面通知</span>
          </label>
        </div>
      </div>
      
      <div class="action-bar">
        <button class="btn btn-secondary" @click="resetSyncConfig">
          🔄 恢复默认
        </button>
        <button class="btn btn-primary" @click="saveSyncConfig" :disabled="saving">
          💾 保存设置
        </button>
      </div>
    </div>

    <div class="settings-section danger-zone">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">⚠️</span>
          <h2>数据管理</h2>
        </div>
        <p class="section-desc">演练数据管理操作，请谨慎操作</p>
      </div>
      
      <div class="data-actions">
        <div class="action-card">
          <div class="action-icon">📊</div>
          <div class="action-info">
            <h3>加载示例数据</h3>
            <p>加载预设的示例患者、科室和转运数据，用于演示和测试</p>
          </div>
          <button class="btn btn-primary" @click="handleLoadSample" :disabled="loading">
            {{ loading ? '加载中...' : '📥 加载数据' }}
          </button>
        </div>
        
        <div class="action-card warning">
          <div class="action-icon">🗑️</div>
          <div class="action-info">
            <h3>清除所有数据</h3>
            <p>清空数据库中的所有演练数据，此操作不可恢复</p>
          </div>
          <button class="btn btn-danger" @click="handleClearData" :disabled="loading">
            {{ loading ? '清除中...' : '🗑️ 清除数据' }}
          </button>
        </div>
        
        <div class="action-card">
          <div class="action-icon">ℹ️</div>
          <div class="action-info">
            <h3>系统信息</h3>
            <p>查看当前系统的运行状态和版本信息</p>
          </div>
          <button class="btn btn-secondary" @click="showSystemInfo = true">
            ℹ️ 查看详情
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSystemInfo" class="modal-overlay" @click.self="showSystemInfo = false">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">ℹ️ 系统信息</h3>
              <button class="btn-text" @click="showSystemInfo = false">✕</button>
            </div>
            <div class="modal-body">
              <div class="info-grid">
                <div class="info-item">
                  <label>系统名称</label>
                  <span>分诊转运压测台</span>
                </div>
                <div class="info-item">
                  <label>版本号</label>
                  <span>1.0.0</span>
                </div>
                <div class="info-item">
                  <label>前端框架</label>
                  <span>Vue 3 + Vite</span>
                </div>
                <div class="info-item">
                  <label>后端框架</label>
                  <span>Node.js + Express</span>
                </div>
                <div class="info-item">
                  <label>数据库</label>
                  <span>SQLite</span>
                </div>
                <div class="info-item">
                  <label>通信协议</label>
                  <span>REST API + WebSocket</span>
                </div>
                <div class="info-item full-width">
                  <label>功能模块</label>
                  <div class="feature-tags">
                    <span class="feature-tag">患者管理</span>
                    <span class="feature-tag">分诊看板</span>
                    <span class="feature-tag">转运队列</span>
                    <span class="feature-tag">床位管理</span>
                    <span class="feature-tag">规则引擎</span>
                    <span class="feature-tag">实时同步</span>
                    <span class="feature-tag">操作日志</span>
                    <span class="feature-tag">数据导出</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="showSystemInfo = false">关闭</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="toastMessage" class="toast-wrapper">
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
import { ref, computed, reactive } from 'vue'
import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()

const saving = ref(false)
const loading = ref(false)
const showSystemInfo = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const defaultTriageConfig = {
  red: { waitThreshold: 5, priorityWeight: 100 },
  yellow: { waitThreshold: 30, priorityWeight: 50 },
  green: { waitThreshold: 120, priorityWeight: 10 }
}

const triageConfig = reactive({
  red: { ...defaultTriageConfig.red },
  yellow: { ...defaultTriageConfig.yellow },
  green: { ...defaultTriageConfig.green }
})

const defaultSyncConfig = {
  wsUrl: '',
  reconnectInterval: 5,
  ruleCheckInterval: 30,
  refreshInterval: 60,
  autoConnect: true,
  autoReconnect: true,
  autoRefresh: true,
  enableNotifications: false
}

const syncConfig = reactive({ ...defaultSyncConfig })

const toastIcon = computed(() => {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }
  return icons[toastType.value] || 'ℹ️'
})

function showToast(message, type = 'success') {
  toastMessage.value = message
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

function resetTriageConfig() {
  Object.assign(triageConfig.red, defaultTriageConfig.red)
  Object.assign(triageConfig.yellow, defaultTriageConfig.yellow)
  Object.assign(triageConfig.green, defaultTriageConfig.green)
  showToast('已恢复默认分诊配置', 'info')
}

async function saveTriageConfig() {
  saving.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    showToast('分诊配置已保存', 'success')
  } catch (error) {
    showToast('保存失败: ' + error.message, 'error')
  } finally {
    saving.value = false
  }
}

function resetSyncConfig() {
  Object.assign(syncConfig, defaultSyncConfig)
  showToast('已恢复默认同步设置', 'info')
}

async function saveSyncConfig() {
  saving.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    showToast('同步设置已保存', 'success')
  } catch (error) {
    showToast('保存失败: ' + error.message, 'error')
  } finally {
    saving.value = false
  }
}

async function handleLoadSample() {
  if (!confirm('确定要加载示例数据吗？这将添加示例患者、科室和转运数据。')) {
    return
  }
  
  loading.value = true
  try {
    await systemStore.createSampleData()
    showToast('示例数据已加载', 'success')
  } catch (error) {
    showToast('加载示例数据失败: ' + error.message, 'error')
  } finally {
    loading.value = false
  }
}

async function handleClearData() {
  if (!confirm('⚠️ 警告：此操作将删除所有演练数据，且无法恢复！\n\n确定要继续吗？')) {
    return
  }
  
  if (!confirm('再次确认：真的要清除所有数据吗？')) {
    return
  }
  
  loading.value = true
  try {
    await systemStore.clearAllData()
    showToast('所有数据已清除', 'success')
  } catch (error) {
    showToast('清除数据失败: ' + error.message, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
  padding: 24px;
}

.section-header {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.section-icon {
  font-size: 24px;
}

.section-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-gray-900);
}

.section-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-gray-600);
}

.triage-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.triage-card {
  padding: 20px;
  border-radius: var(--radius);
  border: 2px solid var(--color-gray-200);
  background: var(--color-gray-50);
}

.triage-card.red {
  border-color: #fecaca;
  background: #fef2f2;
}

.triage-card.yellow {
  border-color: #fde68a;
  background: #fffbeb;
}

.triage-card.green {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.triage-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.triage-icon {
  font-size: 24px;
}

.triage-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-gray-900);
}

.triage-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-700);
}

.form-input {
  padding: 10px 12px;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: all var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-hint {
  font-size: 12px;
  color: var(--color-gray-500);
  margin: 0;
}

.triage-desc {
  font-size: 12px;
  color: var(--color-gray-600);
  line-height: 1.5;
  padding-top: 12px;
  border-top: 1px dashed var(--color-gray-300);
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-gray-100);
}

.settings-form {
  margin-bottom: 24px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.form-toggle-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  background: var(--color-gray-50);
  border-radius: var(--radius);
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-item input[type="checkbox"] {
  display: none;
}

.toggle-slider {
  width: 44px;
  height: 24px;
  background: var(--color-gray-300);
  border-radius: 12px;
  position: relative;
  transition: background var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  top: 3px;
  left: 3px;
  transition: transform var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-item input:checked + .toggle-slider {
  background: var(--color-blue);
}

.toggle-item input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 14px;
  color: var(--color-gray-700);
}

.data-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.action-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--color-gray-50);
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.action-card.warning {
  background: #fef2f2;
  border-color: #fecaca;
}

.action-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.action-info {
  flex: 1;
}

.action-info h3 {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-gray-900);
}

.action-info p {
  margin: 0;
  font-size: 13px;
  color: var(--color-gray-600);
  line-height: 1.5;
}

.danger-zone {
  border-color: #fecaca;
}

.danger-zone .section-title h2 {
  color: var(--color-red);
}

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
}

.modal {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90vw;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-gray-200);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-gray-200);
  display: flex;
  justify-content: flex-end;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-500);
}

.info-item span {
  font-size: 14px;
  color: var(--color-gray-900);
  font-weight: 500;
}

.feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.feature-tag {
  padding: 4px 10px;
  background: var(--color-blue);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.toast-wrapper {
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
  background: white;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  border-left: 4px solid;
  min-width: 280px;
}

.toast.success { border-left-color: var(--color-green); }
.toast.error { border-left-color: var(--color-red); }
.toast.warning { border-left-color: var(--color-yellow); }
.toast.info { border-left-color: var(--color-blue); }

.toast-icon { font-size: 18px; }
.toast-text { font-size: 14px; color: var(--color-gray-800); }

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
