<template>
  <div class="case-detail">
    <div class="page-header">
      <div class="header-left">
        <button class="btn-back" @click="$router.back()">← 返回</button>
        <div>
          <h2>{{ caseData?.case?.case_number }}</h2>
          <p class="patient-name">{{ caseData?.case?.patient_name }}</p>
        </div>
      </div>
      <div class="header-right">
        <span :class="['status-badge', 'status-' + (caseData?.case?.status?.toLowerCase() || '')]">
          {{ caseData?.case?.statusDescription }}
        </span>
        <select 
          v-if="caseData?.case?.availableNextStates?.length > 0"
          v-model="newState"
          class="state-select"
        >
          <option value="">转换状态...</option>
          <option v-for="state in caseData.case.availableNextStates" :key="state" :value="state">
            {{ getStateDescription(state) }}
          </option>
        </select>
        <button 
          v-if="newState"
          class="btn-primary"
          @click="transitionState"
        >
          确认转换
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <p>加载中...</p>
    </div>

    <div v-else class="detail-content">
      <div v-if="caseData?.validation?.totalViolations > 0" class="violations-section">
        <div class="section-header">
          <span class="warning-icon">⚠️</span>
          <h3>校验警告 ({{ caseData.validation.totalViolations }})</h3>
        </div>
        <div class="violations-list">
          <div 
            v-for="(v, index) in caseData.validation.violations" 
            :key="index"
            :class="['violation-item', 'violation-' + v.severity.toLowerCase()]"
          >
            <span class="violation-severity">[{{ v.severity }}]</span>
            <span class="violation-message">{{ v.message }}</span>
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <h4>基本信息</h4>
          <div class="info-items">
            <div class="info-row">
              <span class="info-label">医生</span>
              <span class="info-value">{{ caseData?.case?.doctor_name || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">诊所</span>
              <span class="info-value">{{ caseData?.case?.clinic_name || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">创建时间</span>
              <span class="info-value">{{ formatDate(caseData?.case?.created_at) }}</span>
            </div>
            <div class="info-row" v-if="caseData?.case?.notes">
              <span class="info-label">备注</span>
              <span class="info-value">{{ caseData.case.notes }}</span>
            </div>
          </div>
        </div>

        <div class="info-card">
          <h4>牙位信息 ({{ caseData?.teeth?.length || 0 }})</h4>
          <div class="teeth-list">
            <div v-for="tooth in caseData?.teeth" :key="tooth.id" class="tooth-item">
              <div class="tooth-header">
                <span class="tooth-number">#{{ tooth.tooth_number }}</span>
                <span class="tooth-version">v{{ tooth.version }}</span>
                <span v-if="tooth.is_rework" class="rework-badge">返工</span>
              </div>
              <div class="tooth-info">
                <span>{{ tooth.tooth_type }}</span>
                <span v-if="tooth.rework_count > 0">返工 {{ tooth.rework_count }} 次</span>
              </div>
            </div>
            <div v-if="!caseData?.teeth?.length" class="empty-teeth">
              暂无牙位信息
            </div>
          </div>
          <button class="btn-add" @click="showAddToothModal = true">+ 添加牙位</button>
        </div>
      </div>

      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span v-if="tab.id === 'rework' && caseData?.reworkRequests?.length > 0" class="tab-count">
            {{ caseData.reworkRequests.length }}
          </span>
        </button>
      </div>

      <div class="tab-content">
        <div v-if="activeTab === 'process'">
          <div class="process-flow">
            <h4>工序流转</h4>
            <div class="steps-container">
              <div 
                v-for="(step, index) in caseData?.processSteps" 
                :key="step.id"
                :class="['step-item', 'step-' + (step.status?.toLowerCase() || 'pending')]"
              >
                <div class="step-indicator"></div>
                <div class="step-content">
                  <span class="step-name">{{ getStepLabel(step.step_name) }}</span>
                  <span class="step-status">{{ getStepStatusLabel(step.status) }}</span>
                  <span v-if="step.assigned_to" class="step-assigned">负责人: {{ step.assigned_to }}</span>
                  <span v-if="step.notes" class="step-notes">{{ step.notes }}</span>
                </div>
                <div v-if="index < (caseData?.processSteps?.length || 0) - 1" class="step-connector"></div>
              </div>
            </div>
            <div v-if="!caseData?.processSteps?.length" class="empty-steps">
              暂无工序记录
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'rework'">
          <div class="rework-section">
            <div class="section-header">
              <h4>返工申请</h4>
              <button class="btn-primary" @click="showReworkModal = true">+ 申请返工</button>
            </div>
            <div class="rework-list">
              <div v-for="rework in caseData?.reworkRequests" :key="rework.id" class="rework-card">
                <div class="rework-header">
                  <span :class="['rework-status', 'status-' + rework.status.toLowerCase()]">
                    {{ getReworkStatusLabel(rework.status) }}
                  </span>
                  <span class="rework-reason">{{ rework.reason_description }}</span>
                </div>
                <div class="rework-info">
                  <div class="info-pair">
                    <span class="label">原因代码:</span>
                    <span class="value">{{ rework.reason_code }}</span>
                  </div>
                  <div class="info-pair">
                    <span class="label">返工类型:</span>
                    <span class="value">{{ rework.rework_type }}</span>
                  </div>
                  <div class="info-pair">
                    <span class="label">来源工序:</span>
                    <span class="value">{{ getStepLabel(rework.source_step) }}</span>
                  </div>
                  <div class="info-pair">
                    <span class="label">目标工序:</span>
                    <span class="value">{{ getStepLabel(rework.target_step) }}</span>
                  </div>
                </div>
                <div class="rework-actions" v-if="rework.status === 'PENDING'">
                  <button class="btn-approve" @click="reviewRework(rework.id, 'APPROVED')">批准</button>
                  <button class="btn-reject" @click="reviewRework(rework.id, 'REJECTED')">拒绝</button>
                </div>
              </div>
              <div v-if="!caseData?.reworkRequests?.length" class="empty-rework">
                暂无返工申请
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'feedback'">
          <div class="feedback-section">
            <div class="section-header">
              <h4>试戴反馈</h4>
              <button class="btn-primary" @click="showFeedbackModal = true">+ 添加反馈</button>
            </div>
            <div class="feedback-list">
              <div v-for="feedback in caseData?.tryInFeedbacks" :key="feedback.id" class="feedback-card">
                <div class="feedback-header">
                  <span class="feedback-date">{{ formatDate(feedback.feedback_date) }}</span>
                  <span :class="['followup-badge', feedback.is_followed_up ? 'followed' : 'not-followed']">
                    {{ feedback.is_followed_up ? '已跟进' : '待跟进' }}
                  </span>
                </div>
                <div class="feedback-info">
                  <div class="info-row">
                    <span class="label">就位情况:</span>
                    <span class="value">{{ feedback.fit_status }}</span>
                  </div>
                  <div class="info-row" v-if="feedback.occlusion_status">
                    <span class="label">咬合情况:</span>
                    <span class="value">{{ feedback.occlusion_status }}</span>
                  </div>
                  <div class="info-row" v-if="feedback.esthetics_status">
                    <span class="label">美学情况:</span>
                    <span class="value">{{ feedback.esthetics_status }}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">需返工:</span>
                    <span class="value">{{ feedback.needs_rework ? '是' : '否' }}</span>
                  </div>
                  <div class="info-row" v-if="feedback.notes">
                    <span class="label">备注:</span>
                    <span class="value">{{ feedback.notes }}</span>
                  </div>
                </div>
                <div class="feedback-actions" v-if="!feedback.is_followed_up">
                  <button class="btn-follow" @click="followUpFeedback(feedback.id)">标记已跟进</button>
                </div>
              </div>
              <div v-if="!caseData?.tryInFeedbacks?.length" class="empty-feedback">
                暂无试戴反馈
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'versions'">
          <div class="versions-section">
            <h4>版本历史</h4>
            <div class="version-list">
              <div v-for="(vh, index) in caseData?.versionHistory" :key="vh.id" class="version-item">
                <div class="version-time">{{ formatDateTime(vh.created_at) }}</div>
                <div class="version-action">{{ vh.action }}</div>
                <div class="version-change" v-if="vh.previous_status || vh.new_status">
                  {{ vh.previous_status }} → {{ vh.new_status }}
                </div>
                <div class="version-reason" v-if="vh.change_reason">{{ vh.change_reason }}</div>
              </div>
              <div v-if="!caseData?.versionHistory?.length" class="empty-versions">
                暂无版本历史
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="export-section">
        <h4>导出数据</h4>
        <div class="export-buttons">
          <button class="export-btn" @click="exportData('cases', 'csv')">导出病例 (CSV)</button>
          <button class="export-btn" @click="exportData('cases', 'json')">导出病例 (JSON)</button>
          <button class="export-btn" @click="exportData('cases', 'markdown')">导出病例 (Markdown)</button>
          <button class="export-btn" @click="exportData('teeth', 'csv')">导出牙位 (CSV)</button>
          <button class="export-btn" @click="exportData('rework_requests', 'csv')">导出返工 (CSV)</button>
        </div>
      </div>
    </div>

    <div v-if="showAddToothModal" class="modal-overlay" @click.self="showAddToothModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>添加牙位</h3>
          <button class="modal-close" @click="showAddToothModal = false">&times;</button>
        </div>
        <form @submit.prevent="addTooth">
          <div class="form-group">
            <label>牙位编号 (1-32) *</label>
            <input type="number" v-model="newTooth.toothNumber" min="1" max="32" required />
          </div>
          <div class="form-group">
            <label>修复类型 *</label>
            <select v-model="newTooth.toothType" required>
              <option value="">请选择</option>
              <option value="CROWN">冠</option>
              <option value="BRIDGE">桥</option>
              <option value="INLAY">嵌体</option>
              <option value="ONLAY">高嵌体</option>
              <option value="VENEER">贴面</option>
              <option value="IMPLANT">种植</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="showAddToothModal = false">取消</button>
            <button type="submit" class="btn-submit">添加</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showReworkModal" class="modal-overlay" @click.self="showReworkModal = false">
      <div class="modal-content large">
        <div class="modal-header">
          <h3>申请返工</h3>
          <button class="modal-close" @click="showReworkModal = false">&times;</button>
        </div>
        <form @submit.prevent="submitRework">
          <div class="form-group">
            <label>牙位</label>
            <select v-model="newRework.toothId">
              <option value="">全病例</option>
              <option v-for="tooth in caseData?.teeth" :key="tooth.id" :value="tooth.id">
                #{{ tooth.tooth_number }} - {{ tooth.tooth_type }} (v{{ tooth.version }})
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>返工原因 *</label>
            <select v-model="newRework.reasonCode" required>
              <option value="">请选择</option>
              <option v-for="(label, code) in reworkReasonOptions" :key="code" :value="code">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>原因描述 *</label>
            <textarea v-model="newRework.reasonDescription" rows="3" required></textarea>
          </div>
          <div class="form-group">
            <label>返工类型 *</label>
            <select v-model="newRework.reworkType" required>
              <option value="DESIGN">设计返工</option>
              <option value="MANUFACTURING">加工返工</option>
              <option value="FULL">全流程返工</option>
            </select>
          </div>
          <div class="form-group">
            <label>来源工序 *</label>
            <select v-model="newRework.sourceStep" required>
              <option v-for="step in processSteps" :key="step" :value="step">
                {{ getStepLabel(step) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>目标工序 *</label>
            <select v-model="newRework.targetStep" required>
              <option v-for="step in processSteps" :key="step" :value="step">
                {{ getStepLabel(step) }}
              </option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="showReworkModal = false">取消</button>
            <button type="submit" class="btn-submit">提交申请</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showFeedbackModal" class="modal-overlay" @click.self="showFeedbackModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>添加试戴反馈</h3>
          <button class="modal-close" @click="showFeedbackModal = false">&times;</button>
        </div>
        <form @submit.prevent="submitFeedback">
          <div class="form-group">
            <label>牙位</label>
            <select v-model="newFeedback.toothId">
              <option value="">全病例</option>
              <option v-for="tooth in caseData?.teeth" :key="tooth.id" :value="tooth.id">
                #{{ tooth.tooth_number }} - {{ tooth.tooth_type }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>医生姓名</label>
            <input type="text" v-model="newFeedback.doctorName" />
          </div>
          <div class="form-group">
            <label>就位情况 *</label>
            <select v-model="newFeedback.fitStatus" required>
              <option value="GOOD">良好</option>
              <option value="MINOR_ADJUSTMENT">需微调</option>
              <option value="NEEDS_REWORK">需返工</option>
            </select>
          </div>
          <div class="form-group">
            <label>咬合情况</label>
            <select v-model="newFeedback.occlusionStatus">
              <option value="">请选择</option>
              <option value="GOOD">良好</option>
              <option value="HIGH">咬合高</option>
              <option value="LOW">咬合低</option>
              <option value="NEEDS_ADJUSTMENT">需调整</option>
            </select>
          </div>
          <div class="form-group">
            <label>美学情况</label>
            <select v-model="newFeedback.estheticsStatus">
              <option value="">请选择</option>
              <option value="GOOD">良好</option>
              <option value="COLOR_MISMATCH">颜色不匹配</option>
              <option value="SHAPE_ISSUE">形态问题</option>
              <option value="NEEDS_ADJUSTMENT">需调整</option>
            </select>
          </div>
          <div class="form-group">
            <label>是否需要返工</label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="newFeedback.needsRework" />
              <span>是</span>
            </label>
          </div>
          <div class="form-group" v-if="newFeedback.needsRework">
            <label>返工原因</label>
            <textarea v-model="newFeedback.reworkReason" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="newFeedback.notes" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="showFeedbackModal = false">取消</button>
            <button type="submit" class="btn-submit">提交</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toothApi, reworkApi, tryInFeedbackApi, importExportApi } from '../api'
import { CASE_STATE_TRANSITIONS, PROCESS_STEP_NAMES, REWORK_REASONS, REWORK_REASON_DESCRIPTIONS } from '../state-machine'

const route = useRoute()
const loading = ref(false)
const caseData = ref(null)
const newState = ref('')
const activeTab = ref('process')

const showAddToothModal = ref(false)
const showReworkModal = ref(false)
const showFeedbackModal = ref(false)

const newTooth = reactive({
  toothNumber: null,
  toothType: ''
})

const newRework = reactive({
  toothId: '',
  reasonCode: '',
  reasonDescription: '',
  reworkType: 'DESIGN',
  sourceStep: 'QUALITY_INSPECTION',
  targetStep: 'DIGITAL_DESIGN'
})

const newFeedback = reactive({
  toothId: '',
  doctorName: '',
  fitStatus: 'GOOD',
  occlusionStatus: '',
  estheticsStatus: '',
  needsRework: false,
  reworkReason: '',
  notes: ''
})

const tabs = [
  { id: 'process', label: '工序流转' },
  { id: 'rework', label: '返工申请' },
  { id: 'feedback', label: '试戴反馈' },
  { id: 'versions', label: '版本历史' }
]

const processSteps = PROCESS_STEP_NAMES
const reworkReasonOptions = REWORK_REASON_DESCRIPTIONS

const stepLabels = {
  SCAN_VALIDATION: '口扫验证',
  DIGITAL_DESIGN: '数字化设计',
  DESIGN_APPROVAL: '设计审批',
  MILLING: '铣削',
  SINTERING: '烧结',
  STACKING: '堆瓷',
  GLAZING: '上釉',
  QUALITY_INSPECTION: '质检',
  TRY_IN_PREPARATION: '试戴准备',
  TRY_IN: '试戴',
  FINAL_INSPECTION: '终检',
  DELIVERY: '交付'
}

const stepStatusLabels = {
  PENDING: '待处理',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  ON_HOLD: '暂停',
  SKIPPED: '跳过',
  CANCELLED: '取消',
  REWORK_REQUIRED: '需返工'
}

const reworkStatusLabels = {
  PENDING: '待复核',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
  COMPLETED: '已完成'
}

const getStateDescription = (state) => {
  const config = CASE_STATE_TRANSITIONS[state]
  return config?.description || state
}

const getStepLabel = (step) => stepLabels[step] || step

const getStepStatusLabel = (status) => stepStatusLabels[status] || status

const getReworkStatusLabel = (status) => reworkStatusLabels[status] || status

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const loadCaseData = async () => {
  loading.value = true
  try {
    const response = await fetch(`/api/cases/${route.params.id}`)
    if (!response.ok) throw new Error('Failed to load case')
    caseData.value = await response.json()
  } catch (e) {
    console.error('Failed to load case:', e)
  } finally {
    loading.value = false
  }
}

const transitionState = async () => {
  if (!newState.value) return
  
  try {
    const response = await fetch(`/api/cases/${route.params.id}/transition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newState: newState.value,
        changedBy: 'operator',
        reason: '状态转换'
      })
    })
    
    if (response.ok) {
      newState.value = ''
      loadCaseData()
    } else {
      const error = await response.json()
      alert(error.error || '状态转换失败')
    }
  } catch (e) {
    alert('状态转换失败: ' + e.message)
  }
}

const addTooth = async () => {
  if (!newTooth.toothNumber || !newTooth.toothType) return
  
  try {
    await toothApi.create(route.params.id, {
      toothNumber: newTooth.toothNumber,
      toothType: newTooth.toothType
    })
    showAddToothModal.value = false
    newTooth.toothNumber = null
    newTooth.toothType = ''
    loadCaseData()
  } catch (e) {
    alert('添加失败: ' + (e.response?.data?.error || e.message))
  }
}

const submitRework = async () => {
  if (!newRework.reasonCode || !newRework.reasonDescription) return
  
  try {
    await reworkApi.create({
      caseId: route.params.id,
      toothId: newRework.toothId || null,
      reasonCode: newRework.reasonCode,
      reasonDescription: newRework.reasonDescription,
      reworkType: newRework.reworkType,
      requestedBy: 'operator',
      sourceStep: newRework.sourceStep,
      targetStep: newRework.targetStep
    })
    showReworkModal.value = false
    Object.assign(newRework, {
      toothId: '',
      reasonCode: '',
      reasonDescription: '',
      reworkType: 'DESIGN',
      sourceStep: 'QUALITY_INSPECTION',
      targetStep: 'DIGITAL_DESIGN'
    })
    loadCaseData()
  } catch (e) {
    alert('提交失败: ' + (e.response?.data?.error || e.message))
  }
}

const reviewRework = async (reworkId, status) => {
  try {
    await reworkApi.review(reworkId, {
      status,
      reviewedBy: 'operator',
      reviewNotes: status === 'APPROVED' ? '批准返工' : '拒绝返工'
    })
    loadCaseData()
  } catch (e) {
    alert('操作失败: ' + (e.response?.data?.error || e.message))
  }
}

const submitFeedback = async () => {
  if (!newFeedback.fitStatus) return
  
  try {
    await tryInFeedbackApi.create({
      caseId: route.params.id,
      toothId: newFeedback.toothId || null,
      doctorName: newFeedback.doctorName || null,
      fitStatus: newFeedback.fitStatus,
      occlusionStatus: newFeedback.occlusionStatus || null,
      estheticsStatus: newFeedback.estheticsStatus || null,
      notes: newFeedback.notes || null,
      needsRework: newFeedback.needsRework,
      reworkReason: newFeedback.reworkReason || null
    })
    showFeedbackModal.value = false
    Object.assign(newFeedback, {
      toothId: '',
      doctorName: '',
      fitStatus: 'GOOD',
      occlusionStatus: '',
      estheticsStatus: '',
      needsRework: false,
      reworkReason: '',
      notes: ''
    })
    loadCaseData()
  } catch (e) {
    alert('提交失败: ' + (e.response?.data?.error || e.message))
  }
}

const followUpFeedback = async (feedbackId) => {
  try {
    await tryInFeedbackApi.followUp(feedbackId, {
      followedUpBy: 'operator'
    })
    loadCaseData()
  } catch (e) {
    alert('操作失败: ' + (e.response?.data?.error || e.message))
  }
}

const exportData = async (entityType, format) => {
  try {
    const response = await importExportApi.exportData(entityType, format)
    
    const contentType = response.headers['content-type']
    const contentDisposition = response.headers['content-disposition']
    let filename = `${entityType}.${format}`
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match) filename = match[1]
    }
    
    const blob = new Blob([response.data], { type: contentType })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败: ' + (e.response?.data?.error || e.message))
  }
}

onMounted(() => {
  loadCaseData()
})
</script>

<style scoped>
.case-detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-back {
  background: white;
  border: 1px solid #dcdfe6;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  color: #606266;
  transition: all 0.2s;
}

.btn-back:hover {
  border-color: #409eff;
  color: #409eff;
}

.header-left h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #303133;
}

.patient-name {
  color: #606266;
  font-size: 0.95rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
}

.status-prescription_received {
  background: #f4f4f5;
  color: #71717a;
}

.status-scan_received {
  background: #e0f2fe;
  color: #0284c7;
}

.status-designing,
.status-manufacturing {
  background: #fff7ed;
  color: #c2410c;
}

.status-design_approved {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-quality_check {
  background: #fef3c7;
  color: #b45309;
}

.status-try_in,
.status-try_in_feedback_received {
  background: #fce7f3;
  color: #be185d;
}

.status-final_delivery {
  background: #d1fae5;
  color: #059669;
}

.status-completed {
  background: #dcfce7;
  color: #166534;
}

.status-rework_in_progress {
  background: #fee2e2;
  color: #dc2626;
}

.state-select {
  padding: 0.5rem 1rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #909399;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.violations-section {
  background: #fff1f0;
  border: 1px solid #ffb8b8;
  border-radius: 8px;
  padding: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.warning-icon {
  font-size: 1.2rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #cf1322;
}

.violations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.violation-item {
  padding: 0.5rem 0.75rem;
  background: white;
  border-radius: 4px;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.violation-critical {
  border-left: 3px solid #ff4d4f;
}

.violation-error {
  border-left: 3px solid #f56c6c;
}

.violation-warning {
  border-left: 3px solid #e6a23c;
}

.violation-severity {
  font-weight: 600;
  font-size: 0.8rem;
  color: #909399;
}

.violation-message {
  color: #303133;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.info-card {
  background: white;
  border-radius: 8px;
  padding: 1.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.info-card h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #ebeef5;
}

.info-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
}

.info-label {
  width: 80px;
  color: #909399;
  font-size: 0.9rem;
}

.info-value {
  color: #303133;
  font-weight: 500;
}

.teeth-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tooth-item {
  padding: 0.75rem;
  background: #f5f7fa;
  border-radius: 6px;
}

.tooth-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.tooth-number {
  font-weight: 600;
  color: #409eff;
}

.tooth-version {
  font-size: 0.8rem;
  color: #909399;
  background: white;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.rework-badge {
  background: #ffb8b8;
  color: #cf1322;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-weight: 500;
}

.tooth-info {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: #606266;
}

.empty-teeth {
  color: #909399;
  text-align: center;
  padding: 1rem;
}

.btn-add {
  margin-top: 0.75rem;
  width: 100%;
  padding: 0.6rem;
  border: 1px dashed #409eff;
  background: white;
  color: #409eff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover {
  background: #ecf5ff;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid #ebeef5;
}

.tab-btn {
  background: none;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  color: #606266;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tab-btn:hover {
  color: #409eff;
}

.tab-btn.active {
  color: #409eff;
  font-weight: 500;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #409eff;
}

.tab-count {
  background: #ffb8b8;
  color: #cf1322;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
  margin-left: 0.25rem;
}

.tab-content {
  background: white;
  border-radius: 0 0 8px 8px;
  padding: 1.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.process-flow h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1rem;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-item {
  display: flex;
  align-items: flex-start;
  position: relative;
  padding: 1rem 0;
}

.step-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #dcdfe6;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #dcdfe6;
  flex-shrink: 0;
  margin-top: 4px;
}

.step-completed .step-indicator {
  background: #67c23a;
  box-shadow: 0 0 0 2px #67c23a;
}

.step-in_progress .step-indicator {
  background: #409eff;
  box-shadow: 0 0 0 2px #409eff;
}

.step-failed .step-indicator,
.step-rework_required .step-indicator {
  background: #f56c6c;
  box-shadow: 0 0 0 2px #f56c6c;
}

.step-content {
  margin-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.step-name {
  font-weight: 500;
  color: #303133;
}

.step-status {
  font-size: 0.85rem;
  color: #909399;
}

.step-assigned,
.step-notes {
  font-size: 0.85rem;
  color: #606266;
}

.step-connector {
  position: absolute;
  left: 7px;
  top: 32px;
  bottom: 0;
  width: 2px;
  background: #ebeef5;
}

.step-completed ~ .step-item .step-connector {
  background: #67c23a;
}

.empty-steps {
  color: #909399;
  text-align: center;
  padding: 2rem;
}

.rework-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.rework-section .section-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
}

.rework-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rework-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 1rem;
}

.rework-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.rework-status {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-pending {
  background: #fef3c7;
  color: #b45309;
}

.status-approved {
  background: #dcfce7;
  color: #166534;
}

.status-rejected {
  background: #fee2e2;
  color: #dc2626;
}

.status-completed {
  background: #dbeafe;
  color: #1d4ed8;
}

.rework-reason {
  color: #303133;
  font-weight: 500;
}

.rework-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

.info-pair {
  display: flex;
  font-size: 0.9rem;
}

.info-pair .label {
  color: #909399;
  margin-right: 0.25rem;
}

.info-pair .value {
  color: #303133;
  font-weight: 500;
}

.rework-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #ebeef5;
}

.btn-approve {
  background: #67c23a;
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.btn-reject {
  background: #f56c6c;
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.empty-rework {
  color: #909399;
  text-align: center;
  padding: 2rem;
}

.feedback-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.feedback-section .section-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feedback-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 1rem;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.feedback-date {
  font-weight: 500;
  color: #303133;
}

.followup-badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.followed {
  background: #dcfce7;
  color: #166534;
}

.not-followed {
  background: #fee2e2;
  color: #dc2626;
}

.feedback-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feedback-info .info-row {
  display: flex;
  font-size: 0.9rem;
}

.feedback-info .label {
  color: #909399;
  width: 80px;
}

.feedback-info .value {
  color: #303133;
  font-weight: 500;
}

.feedback-actions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #ebeef5;
}

.btn-follow {
  background: #409eff;
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.empty-feedback {
  color: #909399;
  text-align: center;
  padding: 2rem;
}

.versions-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1rem;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.version-item {
  padding: 0.75rem;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}

.version-time {
  font-size: 0.85rem;
  color: #909399;
  margin-bottom: 0.25rem;
}

.version-action {
  font-weight: 500;
  color: #303133;
}

.version-change {
  font-size: 0.9rem;
  color: #409eff;
  margin-top: 0.25rem;
}

.version-reason {
  font-size: 0.85rem;
  color: #606266;
  margin-top: 0.25rem;
  font-style: italic;
}

.empty-versions {
  color: #909399;
  text-align: center;
  padding: 2rem;
}

.export-section {
  background: white;
  border-radius: 8px;
  padding: 1.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.export-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1rem;
}

.export-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.export-btn {
  background: white;
  border: 1px solid #dcdfe6;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  color: #606266;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.export-btn:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
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
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.large {
  max-width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ebeef5;
}

.modal-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #909399;
}

form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #303133;
  font-size: 0.95rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #409eff;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-cancel {
  background: white;
  color: #606266;
  border: 1px solid #dcdfe6;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f5f7fa;
}

.btn-submit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-submit:hover {
  opacity: 0.9;
}
</style>
