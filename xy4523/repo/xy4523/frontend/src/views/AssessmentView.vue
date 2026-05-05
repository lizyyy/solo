<template>
  <div class="assessment-view">
    <div class="page-header flex-between mb-4">
      <div>
        <h1 class="page-title">🔍 评估结果</h1>
        <p class="page-subtitle text-muted">
          日期: {{ store.currentDate }} | 共 {{ store.assessments.length }} 个评估批次
        </p>
      </div>
      <div class="flex gap-2">
        <button 
          class="btn btn-primary" 
          @click="runAssessment"
          :disabled="store.loading"
        >
          <span v-if="store.loading" class="spinner"></span>
          重新评估
        </button>
        <button class="btn btn-success" @click="exportMarkdown">
          📄 工作单
        </button>
        <button class="btn btn-info" @click="exportJson">
          📋 审计明细
        </button>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">温室</label>
            <select v-model="filterGreenhouse" class="form-select" @change="applyFilters">
              <option value="">全部温室</option>
              <option v-for="gh in store.greenhouses" :key="gh.id" :value="gh.id">
                {{ gh.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">风险类型</label>
            <select v-model="filterRiskType" class="form-select" @change="applyFilters">
              <option value="">全部类型</option>
              <option v-for="(label, value) in store.riskTypeLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select v-model="filterStatus" class="form-select" @change="applyFilters">
              <option value="">全部状态</option>
              <option value="suitable">适合授粉</option>
              <option value="risk">存在风险</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-3 mb-4">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(76, 175, 80, 0.1); color: #4caf50;">
          📊
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color: #4caf50;">{{ filteredAssessments.length }}</div>
          <div class="stat-label">筛选后批次</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(76, 175, 80, 0.15); color: #4caf50;">
          ✅
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color: #4caf50;">
            {{ filteredAssessments.filter(a => a.is_suitable_pollination).length }}
          </div>
          <div class="stat-label">适合授粉</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(255, 152, 0, 0.15); color: #ff9800;">
          ⚠️
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color: #ff9800;">
            {{ filteredAssessments.filter(a => !a.is_suitable_pollination).length }}
          </div>
          <div class="stat-label">存在风险</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body p-0">
        <table class="table">
          <thead>
            <tr>
              <th>温室</th>
              <th>苗床</th>
              <th>植物</th>
              <th>花期状态</th>
              <th>风险类型</th>
              <th>风险原因</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredAssessments.length === 0">
              <td colspan="8" class="text-center text-muted p-4">
                暂无评估数据，请先运行评估
              </td>
            </tr>
            <tr v-for="item in filteredAssessments" :key="item.id">
              <td>{{ item.greenhouse_name }}</td>
              <td>{{ item.seedbed_code }}</td>
              <td>
                <div class="text-bold">{{ item.plant_name }}</div>
                <div v-if="item.variety" class="text-muted text-sm">{{ item.variety }}</div>
                <div v-if="item.batch_number" class="text-muted text-sm">{{ item.batch_number }}</div>
              </td>
              <td>
                <span class="text-sm">{{ item.flowering_stage }}</span>
              </td>
              <td>
                <span class="badge" :class="getRiskBadgeClass(item.risk_type)">
                  {{ store.riskTypeLabels[item.risk_type] || item.risk_type }}
                </span>
              </td>
              <td style="max-width: 300px;">
                <div class="text-sm">{{ item.risk_reason || '无风险' }}</div>
              </td>
              <td>
                <div class="flex flex-col gap-1">
                  <span 
                    class="badge" 
                    :class="item.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
                  >
                    {{ item.is_suitable_pollination ? '✅ 适合' : '⚠️ 风险' }}
                  </span>
                  <span v-if="item.manual_override" class="badge badge-info text-xs">
                    (人工改判)
                  </span>
                </div>
              </td>
              <td>
                <div class="flex gap-1">
                  <button class="btn btn-sm btn-outline" @click="openDetail(item)">
                    详情
                  </button>
                  <button class="btn btn-sm btn-secondary" @click="openOverrideModal(item)">
                    改判
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
              {{ selectedItem?.plant_name }}
              <span v-if="selectedItem?.variety" class="text-muted">({{ selectedItem.variety }})</span>
            </div>
            <div class="text-sm text-muted">
              温室: {{ selectedItem?.greenhouse_name }} | 
              苗床: {{ selectedItem?.seedbed_code }}
            </div>
            <div class="text-sm mt-2">
              当前状态: 
              <span 
                class="badge ml-1" 
                :class="selectedItem?.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
              >
                {{ selectedItem?.is_suitable_pollination ? '适合授粉' : '存在风险' }}
              </span>
            </div>
            <div class="text-sm text-muted mt-1">
              风险原因: {{ selectedItem?.risk_reason }}
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

    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetailModal">
      <div class="modal" style="max-width: 800px;">
        <div class="modal-header">
          <span class="modal-title">评估详情</span>
          <button class="modal-close" @click="closeDetailModal">&times;</button>
        </div>
        <div class="modal-body" v-if="selectedItem">
          <div class="grid grid-2 mb-4">
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">温室</div>
              <div class="text-bold">{{ selectedItem.greenhouse_name }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">苗床</div>
              <div class="text-bold">{{ selectedItem.seedbed_code }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">植物</div>
              <div class="text-bold">{{ selectedItem.plant_name }}</div>
            </div>
            <div class="p-3 bg-light rounded">
              <div class="text-muted text-sm mb-1">批次号</div>
              <div class="text-bold">{{ selectedItem.batch_number || '-' }}</div>
            </div>
          </div>

          <div class="card mb-3">
            <div class="card-header">评估状态</div>
            <div class="card-body">
              <div class="flex-between mb-2">
                <span>综合评估</span>
                <span 
                  class="badge" 
                  :class="selectedItem.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
                >
                  {{ selectedItem.is_suitable_pollination ? '✅ 适合授粉' : '⚠️ 存在风险' }}
                </span>
              </div>
              <div v-if="selectedItem.manual_override" class="alert alert-info">
                ⚠️ 已人工改判
                <div v-if="selectedItem.override_reason" class="text-sm mt-1">
                  改判原因: {{ selectedItem.override_reason }}
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-3">
            <div class="card-header">风险详情</div>
            <div class="card-body">
              <div class="mb-3">
                <div class="text-bold mb-1">风险类型</div>
                <span class="badge" :class="getRiskBadgeClass(selectedItem.risk_type)">
                  {{ store.riskTypeLabels[selectedItem.risk_type] || selectedItem.risk_type }}
                </span>
              </div>
              
              <div class="mb-3" v-if="selectedItem.risk_reason && selectedItem.risk_reason !== '无风险'">
                <div class="text-bold mb-1">风险原因</div>
                <div class="text-muted">{{ selectedItem.risk_reason }}</div>
              </div>

              <div class="grid grid-2 gap-3">
                <div class="p-3 bg-light rounded">
                  <div class="text-bold mb-1">🌡️ 温度评估</div>
                  <div class="text-sm">{{ selectedItem.temperature_risk }}</div>
                </div>
                <div class="p-3 bg-light rounded">
                  <div class="text-bold mb-1">💧 湿度评估</div>
                  <div class="text-sm">{{ selectedItem.humidity_risk }}</div>
                </div>
                <div class="p-3 bg-light rounded">
                  <div class="text-bold mb-1">🐝 串粉风险</div>
                  <div class="text-sm">{{ selectedItem.cross_pollination_risk }}</div>
                </div>
                <div class="p-3 bg-light rounded">
                  <div class="text-bold mb-1">🌱 花期状态</div>
                  <div class="text-sm">{{ selectedItem.flowering_stage }}</div>
                </div>
                <div class="p-3 bg-light rounded">
                  <div class="text-bold mb-1">🚪 隔离状态</div>
                  <div class="text-sm">{{ selectedItem.isolation_status }}</div>
                </div>
                <div class="p-3 bg-light rounded">
                  <div class="text-bold mb-1">👤 操作员</div>
                  <div class="text-sm">{{ selectedItem.operator_available }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedItem.notes" class="card">
            <div class="card-header">备注</div>
            <div class="card-body">
              {{ selectedItem.notes }}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeDetailModal">关闭</button>
          <button class="btn btn-secondary" @click="openOverrideFromDetail">人工改判</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { exportApi } from '@/utils/api'

const store = useAppStore()

const filterGreenhouse = ref('')
const filterRiskType = ref('')
const filterStatus = ref('')

const showOverrideModal = ref(false)
const showDetailModal = ref(false)
const selectedItem = ref(null)
const overrideSuitable = ref(true)
const overrideReason = ref('')
const overrideNotes = ref('')
const submitting = ref(false)

const filteredAssessments = computed(() => {
  let result = [...store.assessments]
  
  if (filterGreenhouse.value) {
    const gh = store.greenhouses.find(g => g.id === parseInt(filterGreenhouse.value))
    if (gh) {
      result = result.filter(a => a.greenhouse_name === gh.name)
    }
  }
  
  if (filterRiskType.value) {
    result = result.filter(a => a.risk_type === filterRiskType.value)
  }
  
  if (filterStatus.value === 'suitable') {
    result = result.filter(a => a.is_suitable_pollination)
  } else if (filterStatus.value === 'risk') {
    result = result.filter(a => !a.is_suitable_pollination)
  }
  
  return result
})

const runAssessment = async () => {
  await store.runAssessment()
}

const exportMarkdown = () => {
  exportApi.markdown(store.currentDate)
}

const exportJson = () => {
  exportApi.json(store.currentDate)
}

const applyFilters = () => {
}

const getRiskBadgeClass = (type) => {
  if (type === 'suitable') return 'badge-success'
  return 'badge-warning'
}

const openDetail = (item) => {
  selectedItem.value = item
  showDetailModal.value = true
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedItem.value = null
}

const openOverrideFromDetail = () => {
  showDetailModal.value = false
  openOverrideModal(selectedItem.value)
}

const openOverrideModal = (item) => {
  selectedItem.value = item
  overrideSuitable.value = !item.is_suitable_pollination
  overrideReason.value = ''
  overrideNotes.value = item.notes || ''
  showOverrideModal.value = true
}

const closeOverrideModal = () => {
  showOverrideModal.value = false
  selectedItem.value = null
  overrideReason.value = ''
  overrideNotes.value = ''
}

const submitOverride = async () => {
  submitting.value = true
  try {
    await store.updateAssessment(selectedItem.value.plant_batch_id, {
      is_suitable: overrideSuitable.value,
      override_reason: overrideReason.value,
      notes: overrideNotes.value
    })
    closeOverrideModal()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  store.fetchAssessments()
})

watch(() => store.currentDate, () => {
  store.fetchAssessments()
})
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
}

.text-sm {
  font-size: 12px;
}

.text-xs {
  font-size: 11px;
}

.bg-light {
  background-color: #f8f9fa;
}

.rounded {
  border-radius: var(--radius);
}

.cursor-pointer {
  cursor: pointer;
}
</style>
