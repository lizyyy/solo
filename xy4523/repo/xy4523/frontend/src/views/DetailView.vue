<template>
  <div class="detail-view">
    <div class="page-header flex-between mb-4">
      <div>
        <button class="btn btn-sm btn-outline mb-2" @click="goBack">
          ← 返回
        </button>
        <h1 class="page-title">📋 评估详情</h1>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary" @click="openOverrideModal">
          人工改判
        </button>
        <button class="btn btn-success" @click="exportMarkdown">
          📄 工作单
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center p-4">
      <div class="spinner"></div>
      <div class="text-muted mt-2">加载中...</div>
    </div>

    <div v-else-if="!assessment" class="card">
      <div class="card-body text-center p-4">
        <div class="text-muted mb-3">
          未找到该批次的评估数据
        </div>
        <button class="btn btn-primary" @click="goBack">
          返回
        </button>
      </div>
    </div>

    <div v-else class="grid grid-2">
      <div class="card">
        <div class="card-header">
          基本信息
        </div>
        <div class="card-body">
          <div class="grid grid-2 gap-3">
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">温室</div>
              <div class="text-bold">{{ assessment.greenhouse_name }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">苗床</div>
              <div class="text-bold">{{ assessment.seedbed_code }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">植物名称</div>
              <div class="text-bold">{{ assessment.plant_name }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">品种</div>
              <div class="text-bold">{{ assessment.variety || '-' }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">批次号</div>
              <div class="text-bold">{{ assessment.batch_number || '-' }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">数量</div>
              <div class="text-bold">{{ assessment.quantity || '-' }} 株</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">种植日期</div>
              <div class="text-bold">{{ assessment.planting_date || '-' }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">评估日期</div>
              <div class="text-bold">{{ assessment.assessment_date }}</div>
            </div>
          </div>

          <div class="mt-4">
            <div class="text-bold mb-2">预期花期</div>
            <div class="p-3 bg-light rounded flex-between">
              <div>
                <span class="text-muted">开始: </span>
                <span class="text-bold">{{ assessment.expected_flowering_start || '-' }}</span>
              </div>
              <div class="text-muted">→</div>
              <div>
                <span class="text-muted">结束: </span>
                <span class="text-bold">{{ assessment.expected_flowering_end || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header flex-between">
          <span>评估状态</span>
          <span 
            class="badge" 
            :class="assessment.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
          >
            {{ assessment.is_suitable_pollination ? '✅ 适合授粉' : '⚠️ 存在风险' }}
          </span>
        </div>
        <div class="card-body">
          <div v-if="assessment.manual_override" class="alert alert-info mb-3">
            <div class="flex gap-2">
              <span>⚠️</span>
              <div>
                <div class="text-bold">已人工改判</div>
                <div v-if="assessment.override_reason" class="text-sm mt-1">
                  改判原因: {{ assessment.override_reason }}
                </div>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <div class="text-bold mb-1">风险类型</div>
            <span class="badge" :class="getRiskBadgeClass(assessment.risk_type)">
              {{ store.riskTypeLabels[assessment.risk_type] || assessment.risk_type }}
            </span>
          </div>

          <div v-if="assessment.risk_reason && assessment.risk_reason !== '无风险'" class="mb-3">
            <div class="text-bold mb-1">风险原因</div>
            <div class="p-3 bg-light rounded text-warning">
              {{ assessment.risk_reason }}
            </div>
          </div>

          <div class="mt-4">
            <div class="text-bold mb-2">花期状态</div>
            <div class="p-3 bg-light rounded">
              {{ assessment.flowering_stage }}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          环境评估
        </div>
        <div class="card-body">
          <div class="mb-4">
            <div class="text-bold mb-2">🌡️ 温度评估</div>
            <div 
              class="p-3 rounded"
              :class="assessment.temperature_risk?.includes('风险') ? 'bg-warning-light' : 'bg-success-light'"
            >
              {{ assessment.temperature_risk }}
            </div>
          </div>

          <div class="mb-4">
            <div class="text-bold mb-2">💧 湿度评估</div>
            <div 
              class="p-3 rounded"
              :class="assessment.humidity_risk?.includes('风险') ? 'bg-warning-light' : 'bg-success-light'"
            >
              {{ assessment.humidity_risk }}
            </div>
          </div>

          <div class="mb-4">
            <div class="text-bold mb-2">🚪 隔离状态</div>
            <div 
              class="p-3 rounded"
              :class="assessment.isolation_status?.includes('开放') ? 'bg-warning-light' : 'bg-success-light'"
            >
              {{ assessment.isolation_status }}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          授粉风险
        </div>
        <div class="card-body">
          <div class="mb-4">
            <div class="text-bold mb-2">🐝 串粉风险</div>
            <div 
              class="p-3 rounded"
              :class="assessment.cross_pollination_risk?.includes('高串粉风险') ? 'bg-warning-light' : 'bg-success-light'"
            >
              {{ assessment.cross_pollination_risk }}
            </div>
          </div>

          <div class="mb-4">
            <div class="text-bold mb-2">👤 操作员</div>
            <div 
              class="p-3 rounded"
              :class="assessment.operator_available?.includes('无') ? 'bg-warning-light' : 'bg-success-light'"
            >
              {{ assessment.operator_available }}
            </div>
          </div>

          <div class="mt-4 p-3 bg-light rounded">
            <div class="text-sm text-muted">
              <div>系统评估标准:</div>
              <div class="mt-1">• 最佳温度: 20-30°C</div>
              <div>• 最佳湿度: 40-70%</div>
              <div>• 临界温度: 12-38°C</div>
              <div>• 临界湿度: 20-90%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="assessment?.notes" class="card mt-4">
      <div class="card-header">备注</div>
      <div class="card-body">
        {{ assessment.notes }}
      </div>
    </div>

    <div v-if="showOverrideModal" class="modal-overlay" @click.self="closeOverrideModal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">人工改判</span>
          <button class="modal-close" @click="closeOverrideModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="mb-3 p-3 bg-light rounded">
            <div class="text-bold mb-1">
              {{ assessment?.plant_name }}
              <span v-if="assessment?.variety" class="text-muted">({{ assessment.variety }})</span>
            </div>
            <div class="text-sm text-muted">
              温室: {{ assessment?.greenhouse_name }} | 苗床: {{ assessment?.seedbed_code }}
            </div>
            <div class="text-sm mt-2">
              当前状态: 
              <span 
                class="badge ml-1" 
                :class="assessment?.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
              >
                {{ assessment?.is_suitable_pollination ? '适合授粉' : '存在风险' }}
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">改判为</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  v-model="overrideSuitable" 
                  :value="true"
                  class="cursor-pointer"
                />
                <span class="text-bold" style="color: #4caf50;">✅ 适合授粉</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  v-model="overrideSuitable" 
                  :value="false"
                  class="cursor-pointer"
                />
                <span class="text-bold" style="color: #ff9800;">⚠️ 存在风险</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">改判原因</label>
            <textarea 
              v-model="overrideReason"
              class="form-textarea"
              placeholder="请输入改判原因..."
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea 
              v-model="overrideNotes"
              class="form-textarea"
              placeholder="添加备注信息..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeOverrideModal">取消</button>
          <button 
            class="btn btn-primary" 
            @click="submitOverride"
            :disabled="submitting"
          >
            <span v-if="submitting" class="spinner"></span>
            确认改判
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import { exportApi } from '@/utils/api'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const loading = ref(true)
const assessment = ref(null)

const showOverrideModal = ref(false)
const overrideSuitable = ref(true)
const overrideReason = ref('')
const overrideNotes = ref('')
const submitting = ref(false)

const getRiskBadgeClass = (type) => {
  if (type === 'suitable') return 'badge-success'
  return 'badge-warning'
}

const goBack = () => {
  router.back()
}

const exportMarkdown = () => {
  exportApi.markdown(store.currentDate)
}

const openOverrideModal = () => {
  if (!assessment.value) return
  
  overrideSuitable.value = !assessment.value.is_suitable_pollination
  overrideReason.value = ''
  overrideNotes.value = assessment.value.notes || ''
  showOverrideModal.value = true
}

const closeOverrideModal = () => {
  showOverrideModal.value = false
  overrideReason.value = ''
  overrideNotes.value = ''
}

const submitOverride = async () => {
  if (!assessment.value) return
  
  submitting.value = true
  try {
    await store.updateAssessment(assessment.value.plant_batch_id, {
      is_suitable: overrideSuitable.value,
      override_reason: overrideReason.value,
      notes: overrideNotes.value
    })
    
    closeOverrideModal()
    
    const found = store.assessments.find(a => a.plant_batch_id === assessment.value.plant_batch_id)
    if (found) {
      assessment.value = { ...found }
    }
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const loadData = () => {
  loading.value = true
  
  const batchId = parseInt(route.params.id)
  
  setTimeout(() => {
    const found = store.assessments.find(a => a.plant_batch_id === batchId)
    assessment.value = found ? { ...found } : null
    loading.value = false
  }, 100)
}

onMounted(() => {
  if (store.assessments.length > 0) {
    loadData()
  } else {
    store.fetchAssessments().then(() => {
      loadData()
    })
  }
})
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.text-sm {
  font-size: 12px;
}

.bg-light {
  background-color: #f8f9fa;
}

.bg-warning-light {
  background-color: rgba(255, 152, 0, 0.1);
  border-left: 3px solid #ff9800;
}

.bg-success-light {
  background-color: rgba(76, 175, 80, 0.1);
  border-left: 3px solid #4caf50;
}

.rounded {
  border-radius: var(--radius);
}

.cursor-pointer {
  cursor: pointer;
}

.align-center {
  align-items: center;
}

.ml-1 {
  margin-left: 4px;
}

.mt-1 {
  margin-top: 4px;
}

.text-warning {
  color: var(--warning-color);
}
</style>
