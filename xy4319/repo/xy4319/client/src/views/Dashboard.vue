<template>
  <div class="dashboard">
    <div class="stats-grid">
      <div class="stat-card card">
        <div class="card-body">
          <div class="stat-value" style="color: var(--color-blue)">{{ patientsStore.stats.total }}</div>
          <div class="stat-label">总患者数</div>
        </div>
      </div>
      
      <div class="stat-card card">
        <div class="card-body">
          <div class="stat-value" style="color: var(--color-red)">{{ patientsStore.stats.red }}</div>
          <div class="stat-label">红区患者</div>
        </div>
      </div>
      
      <div class="stat-card card">
        <div class="card-body">
          <div class="stat-value" style="color: var(--color-yellow)">{{ patientsStore.stats.yellow }}</div>
          <div class="stat-label">黄区患者</div>
        </div>
      </div>
      
      <div class="stat-card card">
        <div class="card-body">
          <div class="stat-value" style="color: var(--color-green)">{{ patientsStore.stats.green }}</div>
          <div class="stat-label">绿区患者</div>
        </div>
      </div>
      
      <div class="stat-card card">
        <div class="card-body">
          <div class="stat-value" style="color: var(--color-blue)">{{ transfersStore.stats.pending }}</div>
          <div class="stat-label">待转运</div>
        </div>
      </div>
      
      <div class="stat-card card">
        <div class="card-body">
          <div class="stat-value" style="color: var(--color-green)">{{ systemStore.stats.availableBeds }} / {{ systemStore.stats.totalBeds }}</div>
          <div class="stat-label">可用床位</div>
        </div>
      </div>
    </div>
    
    <div v-if="hasAlerts" class="alerts-section mb-6">
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚠️ 异常告警</div>
        </div>
        <div class="card-body">
          <div v-if="systemStore.ruleResults?.timeouts?.length > 0" class="alert alert-error mb-4">
            <strong>等待超时 ({{ systemStore.ruleResults.timeouts.length }} 人):</strong>
            <div class="mt-2">
              <span v-for="p in systemStore.ruleResults.timeouts" :key="p.patientId" class="badge badge-error mr-2 mb-2">
                {{ p.patientName }} - 超时 {{ p.excessMinutes }} 分钟
              </span>
            </div>
          </div>
          
          <div v-if="systemStore.ruleResults?.missedTransfers?.length > 0" class="alert alert-warning mb-4">
            <strong>转运漏看 ({{ systemStore.ruleResults.missedTransfers.length }} 项):</strong>
            <div class="mt-2">
              <span v-for="t in systemStore.ruleResults.missedTransfers" :key="t.transferId" class="badge badge-warning mr-2 mb-2">
                {{ t.patientName }} - 等待 {{ t.waitTime }} 分钟
              </span>
            </div>
          </div>
          
          <div v-if="systemStore.ruleResults?.bedDiscrepancies?.length > 0" class="alert alert-error">
            <strong>床位同步异常 ({{ systemStore.ruleResults.bedDiscrepancies.length }} 项):</strong>
            <div class="mt-2">
              <span v-for="d in systemStore.ruleResults.bedDiscrepancies" :key="d.bedId || d.patientId" class="badge badge-error mr-2 mb-2">
                {{ d.message }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="kanban-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 分诊看板</div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" @click="showAddPatient = true">
              ➕ 新增患者
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="kanban-columns">
            <div class="kanban-column">
              <div class="kanban-column-header">
                <span class="column-title">等待分诊</span>
                <span class="column-count badge badge-info">{{ patientsByStatus.waiting.length }}</span>
              </div>
              <div ref="waitingList" class="kanban-items">
                <div 
                  v-for="patient in patientsByStatus.waiting" 
                  :key="patient.id"
                  class="patient-card draggable-item"
                  :class="'triage-' + patient.triageLevel"
                >
                  <div class="patient-header flex justify-between items-center mb-2">
                    <span class="patient-name font-semibold">{{ patient.name }}</span>
                    <span class="badge" :class="'triage-badge-' + patient.triageLevel">
                      {{ patientsStore.getTriageLabel(patient.triageLevel) }}
                    </span>
                  </div>
                  <div class="patient-details text-sm text-muted mb-2">
                    <div v-if="patient.age">{{ patient.age }}岁 {{ patient.gender || '' }}</div>
                    <div class="text-truncate" :title="patient.chiefComplaint">{{ patient.chiefComplaint }}</div>
                  </div>
                  <div class="patient-footer flex justify-between items-center text-xs text-muted">
                    <span>等待 {{ getWaitMinutes(patient.arrivalTime) }} 分钟</span>
                    <div class="flex gap-1">
                      <button class="btn btn-secondary btn-sm" @click="editPatient(patient)" title="编辑">✏️</button>
                      <button class="btn btn-primary btn-sm" @click="startTriage(patient)" title="开始分诊">➡️</button>
                    </div>
                  </div>
                </div>
                
                <div v-if="patientsByStatus.waiting.length === 0" class="empty-state">
                  <div class="empty-state-icon">⏳</div>
                  <div class="empty-state-text">暂无等待患者</div>
                </div>
              </div>
            </div>
            
            <div class="kanban-column">
              <div class="kanban-column-header">
                <span class="column-title">分诊中</span>
                <span class="column-count badge badge-info">{{ patientsByStatus.triage.length }}</span>
              </div>
              <div ref="triageList" class="kanban-items">
                <div 
                  v-for="patient in patientsByStatus.triage" 
                  :key="patient.id"
                  class="patient-card draggable-item"
                  :class="'triage-' + patient.triageLevel"
                >
                  <div class="patient-header flex justify-between items-center mb-2">
                    <span class="patient-name font-semibold">{{ patient.name }}</span>
                    <span class="badge" :class="'triage-badge-' + patient.triageLevel">
                      {{ patientsStore.getTriageLabel(patient.triageLevel) }}
                    </span>
                  </div>
                  <div class="patient-details text-sm text-muted mb-2">
                    <div v-if="patient.age">{{ patient.age }}岁 {{ patient.gender || '' }}</div>
                    <div class="text-truncate" :title="patient.chiefComplaint">{{ patient.chiefComplaint }}</div>
                  </div>
                  <div class="patient-footer flex justify-between items-center text-xs text-muted">
                    <span>分诊中</span>
                    <div class="flex gap-1">
                      <button class="btn btn-secondary btn-sm" @click="editPatient(patient)" title="编辑">✏️</button>
                      <button class="btn btn-success btn-sm" @click="startTreatment(patient)" title="开始治疗">✅</button>
                    </div>
                  </div>
                </div>
                
                <div v-if="patientsByStatus.triage.length === 0" class="empty-state">
                  <div class="empty-state-icon">🏥</div>
                  <div class="empty-state-text">暂无分诊中患者</div>
                </div>
              </div>
            </div>
            
            <div class="kanban-column">
              <div class="kanban-column-header">
                <span class="column-title">治疗中</span>
                <span class="column-count badge badge-info">{{ patientsByStatus.treatment.length }}</span>
              </div>
              <div ref="treatmentList" class="kanban-items">
                <div 
                  v-for="patient in patientsByStatus.treatment" 
                  :key="patient.id"
                  class="patient-card draggable-item"
                  :class="'triage-' + patient.triageLevel"
                >
                  <div class="patient-header flex justify-between items-center mb-2">
                    <span class="patient-name font-semibold">{{ patient.name }}</span>
                    <span class="badge" :class="'triage-badge-' + patient.triageLevel">
                      {{ patientsStore.getTriageLabel(patient.triageLevel) }}
                    </span>
                  </div>
                  <div class="patient-details text-sm text-muted mb-2">
                    <div v-if="patient.age">{{ patient.age }}岁 {{ patient.gender || '' }}</div>
                    <div class="text-truncate" :title="patient.chiefComplaint">{{ patient.chiefComplaint }}</div>
                    <div v-if="patient.targetDepartment" class="mt-1">
                      <span class="badge badge-info">目标: {{ patient.targetDepartment }}</span>
                    </div>
                  </div>
                  <div class="patient-footer flex justify-between items-center text-xs text-muted">
                    <span>治疗中</span>
                    <div class="flex gap-1">
                      <button class="btn btn-secondary btn-sm" @click="editPatient(patient)" title="编辑">✏️</button>
                      <button class="btn btn-primary btn-sm" @click="requestTransfer(patient)" title="申请转运">🚑</button>
                      <button class="btn btn-success btn-sm" @click="dischargePatient(patient)" title="出院">🏠</button>
                    </div>
                  </div>
                </div>
                
                <div v-if="patientsByStatus.treatment.length === 0" class="empty-state">
                  <div class="empty-state-icon">💊</div>
                  <div class="empty-state-text">暂无治疗中患者</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="pending-transfers-section mt-6">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🚑 转运队列</div>
        </div>
        <div class="card-body">
          <div ref="transferList" class="transfer-list">
            <div 
              v-for="transfer in transfersStore.pendingTransfers" 
              :key="transfer.id"
              class="transfer-item draggable-item"
            >
              <div class="transfer-header flex justify-between items-center mb-2">
                <span class="transfer-patient font-semibold">{{ transfer.patientName || '未知患者' }}</span>
                <span class="badge" :style="{ backgroundColor: transfersStore.getPriorityColor(transfer.priority) }">
                  优先级: {{ transfersStore.getPriorityLabel(transfer.priority) }}
                </span>
              </div>
              <div class="transfer-details text-sm text-muted mb-2">
                <div>
                  <span class="badge" :class="'triage-badge-' + transfer.triageLevel">
                    {{ patientsStore.getTriageLabel(transfer.triageLevel) }}
                  </span>
                </div>
                <div class="mt-1">
                  从: {{ transfer.fromDepartment || '急诊科' }} → 到: {{ transfer.toDepartment }}
                </div>
                <div v-if="transfer.reason" class="text-truncate mt-1" :title="transfer.reason">
                  原因: {{ transfer.reason }}
                </div>
              </div>
              <div class="transfer-footer flex justify-between items-center text-xs text-muted">
                <span>队列位置: {{ transfer.queuePosition }}</span>
                <div class="flex gap-1">
                  <button class="btn btn-success btn-sm" @click="completeTransfer(transfer)" title="完成转运">✅</button>
                  <button class="btn btn-secondary btn-sm" @click="cancelTransfer(transfer)" title="取消">❌</button>
                </div>
              </div>
            </div>
            
            <div v-if="transfersStore.pendingTransfers.length === 0" class="empty-state">
              <div class="empty-state-icon">🚑</div>
              <div class="empty-state-text">暂无待转运患者</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <Transition name="fade">
      <div v-if="showAddPatient" class="modal-overlay" @click.self="showAddPatient = false">
        <div class="modal" style="max-width: 600px;">
          <div class="modal-header">
            <div class="modal-title">{{ editingPatient ? '编辑患者' : '新增患者' }}</div>
            <button class="modal-close" @click="showAddPatient = false">×</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">姓名 *</label>
                <input 
                  v-model="patientForm.name" 
                  type="text" 
                  class="form-input" 
                  placeholder="请输入患者姓名"
                >
              </div>
              <div class="form-group">
                <label class="form-label">分诊级别 *</label>
                <select v-model="patientForm.triageLevel" class="form-select">
                  <option value="red">红区（紧急）</option>
                  <option value="yellow">黄区（紧急）</option>
                  <option value="green">绿区（非紧急）</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">年龄</label>
                <input 
                  v-model.number="patientForm.age" 
                  type="number" 
                  class="form-input" 
                  placeholder="请输入年龄"
                >
              </div>
              <div class="form-group">
                <label class="form-label">性别</label>
                <select v-model="patientForm.gender" class="form-select">
                  <option value="">请选择</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">主诉 *</label>
              <textarea 
                v-model="patientForm.chiefComplaint" 
                class="form-textarea" 
                placeholder="请输入主诉"
                rows="2"
              ></textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">状态</label>
                <select v-model="patientForm.status" class="form-select">
                  <option value="waiting">等待中</option>
                  <option value="triage">分诊中</option>
                  <option value="treatment">治疗中</option>
                  <option value="transferred">已转运</option>
                  <option value="discharged">已出院</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">目标科室</label>
                <select v-model="patientForm.targetDepartment" class="form-select">
                  <option value="">请选择</option>
                  <option v-for="dept in systemStore.departments" :key="dept.id" :value="dept.name">
                    {{ dept.name }}
                  </option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">备注</label>
              <textarea 
                v-model="patientForm.notes" 
                class="form-textarea" 
                placeholder="请输入备注"
                rows="2"
              ></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showAddPatient = false">取消</button>
            <button class="btn btn-primary" @click="savePatient" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { usePatientsStore } from '@/stores/patients'
import { useTransfersStore } from '@/stores/transfers'
import { useSystemStore } from '@/stores/system'
import Sortable from 'sortablejs'

const patientsStore = usePatientsStore()
const transfersStore = useTransfersStore()
const systemStore = useSystemStore()

const waitingList = ref(null)
const triageList = ref(null)
const treatmentList = ref(null)
const transferList = ref(null)

const showAddPatient = ref(false)
const editingPatient = ref(null)
const saving = ref(false)

const patientForm = ref({
  name: '',
  age: null,
  gender: '',
  chiefComplaint: '',
  triageLevel: 'yellow',
  status: 'waiting',
  targetDepartment: '',
  notes: ''
})

const patientsByStatus = computed(() => patientsStore.patientsByStatus)

const hasAlerts = computed(() => {
  const results = systemStore.ruleResults
  return results && (
    (results.timeouts?.length > 0) ||
    (results.missedTransfers?.length > 0) ||
    (results.bedDiscrepancies?.length > 0)
  )
})

function getWaitMinutes(arrivalTime) {
  if (!arrivalTime) return 0
  const arrival = new Date(arrivalTime)
  const now = new Date()
  return Math.floor((now - arrival) / 60000)
}

function resetPatientForm() {
  patientForm.value = {
    name: '',
    age: null,
    gender: '',
    chiefComplaint: '',
    triageLevel: 'yellow',
    status: 'waiting',
    targetDepartment: '',
    notes: ''
  }
  editingPatient.value = null
}

function editPatient(patient) {
  editingPatient.value = patient
  patientForm.value = {
    name: patient.name,
    age: patient.age,
    gender: patient.gender || '',
    chiefComplaint: patient.chiefComplaint || '',
    triageLevel: patient.triageLevel,
    status: patient.status,
    targetDepartment: patient.targetDepartment || '',
    notes: patient.notes || ''
  }
  showAddPatient.value = true
}

async function savePatient() {
  if (!patientForm.value.name || !patientForm.value.chiefComplaint) {
    alert('请填写姓名和主诉')
    return
  }
  
  saving.value = true
  try {
    if (editingPatient.value) {
      await patientsStore.updatePatient(editingPatient.value.id, patientForm.value)
    } else {
      await patientsStore.createPatient(patientForm.value)
    }
    showAddPatient.value = false
    resetPatientForm()
  } catch (error) {
    alert('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

async function startTriage(patient) {
  try {
    await patientsStore.updatePatient(patient.id, { status: 'triage' })
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

async function startTreatment(patient) {
  try {
    await patientsStore.updatePatient(patient.id, { status: 'treatment' })
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

async function dischargePatient(patient) {
  if (!confirm(`确定要将 ${patient.name} 标记为已出院吗？`)) {
    return
  }
  try {
    await patientsStore.updatePatient(patient.id, { status: 'discharged', bedId: null })
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

async function requestTransfer(patient) {
  const toDepartment = prompt('请输入目标科室:', patient.targetDepartment || '')
  if (!toDepartment) return
  
  try {
    await transfersStore.createTransfer({
      patientId: patient.id,
      fromDepartment: '急诊科',
      toDepartment: toDepartment,
      reason: `患者: ${patient.name}, 主诉: ${patient.chiefComplaint}`
    })
  } catch (error) {
    alert('申请转运失败: ' + error.message)
  }
}

async function completeTransfer(transfer) {
  try {
    await transfersStore.updateTransfer(transfer.id, { status: 'completed' })
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

async function cancelTransfer(transfer) {
  if (!confirm('确定要取消这个转运请求吗？')) {
    return
  }
  try {
    await transfersStore.updateTransfer(transfer.id, { status: 'cancelled' })
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

let sortableInstances = []

function initSortable() {
  sortableInstances.forEach(s => s.destroy())
  sortableInstances = []
  
  const statusMap = {
    waiting: 'waiting',
    triage: 'triage',
    treatment: 'treatment'
  }
  
  Object.entries(statusMap).forEach(([listKey, status]) => {
    const listRef = {
      waiting: waitingList,
      triage: triageList,
      treatment: treatmentList
    }[listKey]
    
    if (listRef.value) {
      const sortable = new Sortable(listRef.value, {
        group: 'patients',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: async (evt) => {
          const patientId = evt.item.getAttribute('data-id') || 
            patientsStore.patientsByStatus[listKey][evt.oldIndex]?.id
          
          if (patientId && evt.to !== evt.from) {
            const targetStatus = {
              [waitingList.value]: 'waiting',
              [triageList.value]: 'triage',
              [treatmentList.value]: 'treatment'
            }[evt.to]
            
            if (targetStatus) {
              try {
                await patientsStore.updatePatient(patientId, { status: targetStatus })
              } catch (error) {
                console.error('更新患者状态失败:', error)
              }
            }
          }
        }
      })
      sortableInstances.push(sortable)
    }
  })
  
  if (transferList.value) {
    const transferSortable = new Sortable(transferList.value, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: async (evt) => {
        const orderedTransfers = Array.from(transferList.value.children).map((el, index) => ({
          id: transfersStore.pendingTransfers[evt.oldIndex]?.id || transfersStore.pendingTransfers[index]?.id,
          queuePosition: index + 1
        })).filter(t => t.id)
        
        if (orderedTransfers.length > 0) {
          try {
            await transfersStore.reorderTransfers(orderedTransfers)
            await transfersStore.fetchTransfers()
          } catch (error) {
            console.error('重新排序失败:', error)
          }
        }
      }
    })
    sortableInstances.push(transferSortable)
  }
}

watch(showAddPatient, (val) => {
  if (!val) {
    resetPatientForm()
  }
})

onMounted(() => {
  initSortable()
})

onUnmounted(() => {
  sortableInstances.forEach(s => s.destroy())
})
</script>

<style scoped>
.dashboard {
  width: 100%;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--color-gray-500);
}

.alerts-section {
  margin-bottom: 24px;
}

.kanban-section {
  margin-bottom: 24px;
}

.kanban-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.kanban-column {
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.kanban-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-gray-200);
}

.column-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-gray-700);
}

.column-count {
  min-width: 28px;
}

.kanban-items {
  flex: 1;
  padding: 8px;
  background-color: var(--color-gray-50);
  border-radius: var(--radius-md);
  min-height: 300px;
  overflow-y: auto;
}

.patient-card {
  background: white;
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.patient-card:hover {
  box-shadow: var(--shadow-md);
}

.patient-name {
  font-size: 15px;
}

.transfer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transfer-item {
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius);
  padding: 16px;
  transition: all var(--transition-fast);
}

.transfer-item:hover {
  box-shadow: var(--shadow-md);
}

.transfer-patient {
  font-size: 15px;
}

@media (max-width: 1200px) {
  .kanban-columns {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .kanban-column {
    min-height: auto;
  }
  
  .kanban-items {
    min-height: 200px;
    max-height: 400px;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .stat-value {
    font-size: 28px;
  }
  
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>
