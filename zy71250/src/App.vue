<template>
  <div class="app-container">
    <SidePanel 
      @take-screenshot="takeScreenshot"
      @export-report="exportReport"
    />
    
    <div class="main-content">
      <TopBar 
        @export-screenshot="takeScreenshot"
        @export-report="exportReport"
      />
      
      <VolatilitySurface ref="surfaceRef" />
      
      <BottomPanels />
    </div>
    
    <div v-if="showScreenshotPreview" class="modal-overlay" @click.self="showScreenshotPreview = false">
      <div class="modal modal-wide">
        <h3>截图预览</h3>
        <div class="screenshot-container">
          <img :src="screenshotData" alt="Screenshot" />
        </div>
        <div class="screenshot-info">
          <div class="check-row">
            <span class="status-dot ok"></span>
            <span class="status-text">3D曲面渲染</span>
            <span>已包含</span>
          </div>
          <div class="check-row">
            <span class="status-dot ok"></span>
            <span class="status-text">异常点标注</span>
            <span>已包含</span>
          </div>
          <div class="check-row" v-if="store.sliceView.enabled">
            <span class="status-dot ok"></span>
            <span class="status-text">切片平面</span>
            <span>已包含</span>
          </div>
          <div class="check-row">
            <span class="status-dot ok"></span>
            <span class="status-text">时间戳</span>
            <span>{{ screenshotTimestamp }}</span>
          </div>
          <div class="check-row">
            <span class="status-dot ok"></span>
            <span class="status-text">数据快照</span>
            <span>{{ store.stats.total }}个合约, {{ store.stats.anomaly }}个异常</span>
          </div>
        </div>
        <div class="btn-group" style="margin-top: 16px;">
          <button class="btn btn-secondary" @click="showScreenshotPreview = false">取消</button>
          <button class="btn btn-primary" @click="saveScreenshot">下载截图</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useOptionStore } from './stores/optionStore.js'
import VolatilitySurface from './components/VolatilitySurface.vue'
import SidePanel from './components/SidePanel.vue'
import TopBar from './components/TopBar.vue'
import BottomPanels from './components/BottomPanels.vue'

const store = useOptionStore()

const surfaceRef = ref(null)
const showScreenshotPreview = ref(false)
const screenshotData = ref('')
const screenshotTimestamp = ref('')

function takeScreenshot() {
  if (!surfaceRef.value) return
  
  screenshotData.value = surfaceRef.value.takeScreenshot()
  screenshotTimestamp.value = new Date().toLocaleString('zh-CN')
  showScreenshotPreview.value = true
  
  store.addHistory('export', '生成截图', '3D曲面')
}

function saveScreenshot() {
  const link = document.createElement('a')
  link.download = `volatility-surface-${Date.now()}.png`
  link.href = screenshotData.value
  link.click()
  
  store.addHistory('export', '下载截图', 'PNG')
}

function exportReport(format) {
  store.exportReport(format)
}

onMounted(() => {
  store.initMockData()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  width: 600px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
}

.modal.modal-wide {
  width: 680px;
}

.modal h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

.screenshot-container {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 12px;
  text-align: center;
}

.screenshot-container img {
  max-width: 100%;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.screenshot-info {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 12px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.ok { background: var(--accent-green); }
.status-dot.warn { background: var(--accent-yellow); }
.status-dot.error { background: var(--accent-red); }

.status-text {
  flex: 1;
  color: var(--text-secondary);
}
</style>
