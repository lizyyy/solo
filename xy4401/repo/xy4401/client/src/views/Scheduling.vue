<template>
  <div class="layout-row">
    <aside class="sidebar">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📊 排程状态</h3>
        </div>
        
        <template v-if="currentSchedule">
          <div class="mb-3">
            <div class="flex justify-between text-sm mb-1">
              <span>驳船总数:</span>
              <span class="font-semibold">{{ currentSchedule.barges?.length || 0 }} 艘</span>
            </div>
            <div class="flex justify-between text-sm mb-1">
              <span>冲突数量:</span>
              <span class="font-semibold" :class="hasConflict ? 'text-error' : ''">
                {{ currentSchedule.conflicts?.length || 0 }} 个
              </span>
            </div>
            <div class="flex justify-between text-sm mb-1">
              <span>警告数量:</span>
              <span class="font-semibold" :class="hasWarning ? 'text-warning' : ''">
                {{ currentSchedule.warnings?.length || 0 }} 个
              </span>
            </div>
          </div>
          
          <div v-if="currentSchedule.name" class="mb-3">
            <div class="text-sm text-muted">当前排程:</div>
            <div class="font-semibold">{{ currentSchedule.name }}</div>
          </div>
        </template>
        
        <template v-else>
          <p class="text-muted text-sm">暂无排程数据，请先计算排程</p>
        </template>
        
        <div class="mt-4 flex flex-col gap-2">
          <button 
            class="btn btn-primary w-full"
            :disabled="!canCalculate || calculating"
            @click="handleCalculate"
          >
            {{ calculating ? '计算中...' : '计算排程' }}
          </button>
          
          <button 
            class="btn btn-success w-full"
            :disabled="!currentSchedule"
            @click="showSaveModal = true"
          >
            保存排程
          </button>
        </div>
      </div>

      <div v-if="currentSchedule?.conflicts?.length > 0" class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">🔴 冲突</h3>
        </div>
        <div class="flex flex-col gap-2">
          <div 
            v-for="(conflict, idx) in currentSchedule.conflicts"
            :key="idx"
            class="alert alert-error"
            style="margin-bottom: 0; padding: 8px 12px;"
          >
            <p class="text-sm">{{ conflict.message }}</p>
          </div>
        </div>
      </div>

      <div v-if="currentSchedule?.warnings?.length > 0" class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">🟡 警告</h3>
        </div>
        <div class="flex flex-col gap-2">
          <div 
            v-for="(warning, idx) in currentSchedule.warnings"
            :key="idx"
            class="alert alert-warning"
            style="margin-bottom: 0; padding: 8px 12px;"
          >
            <p class="text-sm">{{ warning.message }}</p>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">📝 交班备注</h3>
        </div>
        <textarea 
          v-model="generalNotes"
          class="form-input form-textarea"
          placeholder="填写交班备注..."
          rows="4"
        ></textarea>
      </div>

      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">📤 导出</h3>
        </div>
        <div class="flex flex-col gap-2">
          <button 
            class="btn btn-secondary w-full"
            :disabled="!currentSchedule"
            @click="handleExportMarkdown"
          >
            导出 Markdown 交班单
          </button>
          <button 
            class="btn btn-secondary w-full"
            :disabled="!currentSchedule"
            @click="handleExportJson"
          >
            导出 JSON 审计包
          </button>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <div v-if="!currentSchedule" class="card">
        <div class="text-center py-8">
          <h2 class="text-xl mb-2">还没有排程数据</h2>
          <p class="text-muted mb-4">
            请先导入潮汐、泊位和驳船数据，然后点击"计算排程"
          </p>
          <router-link to="/import" class="btn btn-primary">
            前往数据导入
          </router-link>
        </div>
      </div>

      <TimelineView 
        v-else
        :schedule="currentSchedule"
        @update-barge="handleUpdateBarge"
        @select-barge="handleSelectBarge"
      />

      <div v-if="selectedBarge" class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">🚢 {{ selectedBarge.name }} - 详情</h3>
          <button class="btn btn-sm btn-secondary" @click="selectedBarge = null">
            关闭
          </button>
        </div>
        
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-sm text-muted">吃水</p>
            <p class="font-semibold">{{ selectedBarge.draft }} m</p>
          </div>
          <div>
            <p class="text-sm text-muted">货种</p>
            <p class="font-semibold">{{ selectedBarge.cargoType || '-' }}</p>
          </div>
          <div>
            <p class="text-sm text-muted">预计装卸时间</p>
            <p class="font-semibold">{{ selectedBarge.loadingTime || 120 }} 分钟</p>
          </div>
        </div>

        <div v-if="selectedBarge.availableWindows?.length > 0" class="mt-4">
          <h4 class="font-semibold mb-2">可用时间窗 (共 {{ selectedBarge.availableWindows.length }} 个):</h4>
          <table class="table">
            <thead>
              <tr>
                <th>序号</th>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>最低潮位</th>
                <th>最高流速</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(window, idx) in selectedBarge.availableWindows" :key="idx">
                <td>{{ idx + 1 }}</td>
                <td>{{ formatTime(window.startTime) }}</td>
                <td>{{ formatTime(window.endTime) }}</td>
                <td>{{ window.minHeight?.toFixed(2) || '-' }} m</td>
                <td>{{ window.maxCurrent?.toFixed(2) || '-' }} 节</td>
                <td>
                  <span 
                    class="badge"
                    :class="window.issues?.length > 0 ? 'badge-warning' : 'badge-success'"
                  >
                    {{ window.issues?.length > 0 ? '有警告' : '正常' }}
                  </span>
                </td>
                <td>
                  <button 
                    class="btn btn-sm btn-primary"
                    @click="assignWindowToBarge(window)"
                  >
                    选择
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4">
          <h4 class="font-semibold mb-2">备注:</h4>
          <textarea 
            v-model="bargeNotes"
            class="form-input form-textarea"
            placeholder="填写该驳船的备注..."
            rows="2"
          ></textarea>
        </div>
      </div>
    </main>

    <div v-if="showSaveModal" class="modal-overlay" @click.self="showSaveModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">保存排程</h3>
          <button class="modal-close" @click="showSaveModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">排程名称</label>
            <input 
              v-model="saveName"
              class="form-input"
              placeholder="请输入排程名称"
            />
          </div>
          <div class="form-group">
            <label class="form-label">交班备注</label>
            <textarea 
              v-model="generalNotes"
              class="form-input form-textarea"
              placeholder="填写交班备注..."
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showSaveModal = false">取消</button>
          <button 
            class="btn btn-primary"
            :disabled="!saveName.trim() || saving"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="message" class="alert fixed" :class="messageType" style="
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 2000;
      min-width: 300px;
    ">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useScheduleStore } from '@/stores/scheduleStore'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import TimelineView from '@/components/TimelineView.vue'

const store = useScheduleStore()
const { currentSchedule, canCalculate, hasConflict, hasWarning, selectedBarge } = storeToRefs(store)

const calculating = ref(false)
const saving = ref(false)
const showSaveModal = ref(false)
const saveName = ref('')
const generalNotes = ref('')
const bargeNotes = ref('')
const message = ref('')
const messageType = ref('')

onMounted(() => {
  store.loadFromLocalStorage()
  if (currentSchedule.value?.notes?.general) {
    generalNotes.value = currentSchedule.value.notes.general
  }
})

watch(selectedBarge, (newVal) => {
  if (newVal && currentSchedule.value?.bargeNotes) {
    bargeNotes.value = currentSchedule.value.bargeNotes[newVal.id] || 
                        currentSchedule.value.bargeNotes[newVal.name] || ''
  }
})

function formatTime(time) {
  return time ? dayjs(time).format('MM-DD HH:mm') : '-'
}

async function handleCalculate() {
  if (!canCalculate.value) return
  
  calculating.value = true
  try {
    const result = await store.calculateSchedule()
    if (result.success) {
      showMessage('排程计算完成！', 'alert-success')
    } else {
      showMessage(result.error || '计算失败', 'alert-error')
    }
  } catch (error) {
    showMessage('计算失败: ' + error.message, 'alert-error')
  } finally {
    calculating.value = false
  }
}

function handleUpdateBarge({ bargeId, newTime, newBerth }) {
  store.updateBargeAssignment(bargeId, newTime, newBerth)
  
  if (hasConflict.value) {
    showMessage('检测到冲突，请检查冲突列表', 'alert-warning')
  }
}

function handleSelectBarge(barge) {
  store.selectBarge(barge)
}

function assignWindowToBarge(window) {
  if (selectedBarge.value) {
    store.updateBargeAssignment(
      selectedBarge.value.id || selectedBarge.value.name,
      window,
      selectedBarge.value.assignedBerth
    )
    showMessage('已更新时间窗', 'alert-success')
  }
}

async function handleSave() {
  if (!saveName.value.trim() || !currentSchedule.value) return
  
  saving.value = true
  try {
    if (!currentSchedule.value.notes) {
      currentSchedule.value.notes = {}
    }
    currentSchedule.value.notes.general = generalNotes.value
    
    if (selectedBarge.value && bargeNotes.value.trim()) {
      if (!currentSchedule.value.bargeNotes) {
        currentSchedule.value.bargeNotes = {}
      }
      currentSchedule.value.bargeNotes[selectedBarge.value.id || selectedBarge.value.name] = bargeNotes.value
    }
    
    const result = await store.saveSchedule(saveName.value.trim())
    if (result.success) {
      showMessage('排程已保存！', 'alert-success')
      showSaveModal.value = false
    } else {
      showMessage(result.error || '保存失败', 'alert-error')
    }
  } catch (error) {
    showMessage('保存失败: ' + error.message, 'alert-error')
  } finally {
    saving.value = false
  }
}

async function handleExportMarkdown() {
  try {
    if (generalNotes.value.trim() && currentSchedule.value) {
      if (!currentSchedule.value.notes) {
        currentSchedule.value.notes = {}
      }
      currentSchedule.value.notes.general = generalNotes.value
      store.saveToLocalStorage()
    }
    
    const result = await store.exportMarkdown()
    if (result.success) {
      showMessage('Markdown 交班单已导出！', 'alert-success')
    } else {
      showMessage(result.error || '导出失败', 'alert-error')
    }
  } catch (error) {
    showMessage('导出失败: ' + error.message, 'alert-error')
  }
}

async function handleExportJson() {
  try {
    const result = await store.exportJson()
    if (result.success) {
      showMessage('JSON 审计包已导出！', 'alert-success')
    } else {
      showMessage(result.error || '导出失败', 'alert-error')
    }
  } catch (error) {
    showMessage('导出失败: ' + error.message, 'alert-error')
  }
}

function showMessage(msg, type) {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 5000)
}
</script>
