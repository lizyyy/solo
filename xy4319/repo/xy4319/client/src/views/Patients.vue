<template>
  <div class="patients-view">
    <div class="card mb-6">
      <div class="card-header">
        <div class="card-title">患者列表</div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" @click="showImportModal = true">
            📥 批量导入
          </button>
          <button class="btn btn-primary btn-sm" @click="showAddPatient = true">
            ➕ 新增患者
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="filters mb-4 flex gap-4 flex-wrap">
          <div class="form-group" style="margin-bottom: 0; min-width: 150px;">
            <select v-model="filterTriageLevel" class="form-select" @change="fetchPatients">
              <option value="">全部分诊级别</option>
              <option value="red">红区</option>
              <option value="yellow">黄区</option>
              <option value="green">绿区</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0; min-width: 150px;">
            <select v-model="filterStatus" class="form-select" @change="fetchPatients">
              <option value="">全部状态</option>
              <option value="waiting">等待中</option>
              <option value="triage">分诊中</option>
              <option value="treatment">治疗中</option>
              <option value="transferred">已转运</option>
              <option value="discharged">已出院</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0; min-width: 200px;">
            <input 
              v-model="searchText" 
              type="text" 
              class="form-input" 
              placeholder="搜索患者姓名/主诉..."
              @input="debouncedSearch"
            >
          </div>
        </div>
        
        <div v-if="patientsStore.loading" class="text-center py-8 text-muted">
          加载中...
        </div>
        
        <div v-else-if="filteredPatients.length === 0" class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-text">暂无患者数据</div>
          <div class="empty-state-hint">点击上方"新增患者"按钮开始添加</div>
        </div>
        
        <div v-else>
          <div class="table-wrapper" style="overflow-x: auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>分诊级别</th>
                  <th>姓名</th>
                  <th>年龄</th>
                  <th>性别</th>
                  <th>主诉</th>
                  <th>目标科室</th>
                  <th>状态</th>
                  <th>到院时间</th>
                  <th>等待时间</th>
                  <th style="width: 160px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="patient in filteredPatients" :key="patient.id">
                  <td>
                    <span class="badge" :class="'triage-badge-' + patient.triageLevel">
                      {{ patientsStore.getTriageLabel(patient.triageLevel) }}
                    </span>
                  </td>
                  <td>
                    <strong>{{ patient.name }}</strong>
                  </td>
                  <td>{{ patient.age || '-' }}</td>
                  <td>{{ patient.gender || '-' }}</td>
                  <td>
                    <div class="text-truncate" style="max-width: 200px;" :title="patient.chiefComplaint">
                      {{ patient.chiefComplaint || '-' }}
                    </div>
                  </td>
                  <td>{{ patient.targetDepartment || '-' }}</td>
                  <td>
                    <span class="badge" :class="getStatusBadgeClass(patient.status)">
                      {{ patientsStore.getStatusLabel(patient.status) }}
                    </span>
                  </td>
                  <td>{{ formatTime(patient.arrivalTime) }}</td>
                  <td>{{ getWaitTime(patient.arrivalTime) }}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-secondary btn-sm" @click="editPatient(patient)" title="编辑">
                        ✏️ 编辑
                      </button>
                      <button class="btn btn-danger btn-sm" @click="deletePatient(patient)" title="删除">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="mt-4 text-sm text-muted">
            共 {{ filteredPatients.length }} 条记录
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
    
    <Transition name="fade">
      <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
        <div class="modal" style="max-width: 800px;">
          <div class="modal-header">
            <div class="modal-title">批量导入患者</div>
            <button class="modal-close" @click="showImportModal = false">×</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info mb-4">
              <strong>导入格式说明：</strong><br>
              每行一个患者，使用 JSON 数组格式。<br>
              必填字段：name（姓名）、chiefComplaint（主诉）<br>
              可选字段：age（年龄）、gender（性别）、triageLevel（分诊级别: red/yellow/green）、targetDepartment（目标科室）
            </div>
            
            <div class="form-group">
              <label class="form-label">JSON 数据</label>
              <textarea 
                v-model="importData" 
                class="form-textarea" 
                placeholder='[
  { "name": "张三", "age": 65, "gender": "男", "chiefComplaint": "胸痛2小时", "triageLevel": "red", "targetDepartment": "心内科" },
  { "name": "李四", "age": 45, "gender": "女", "chiefComplaint": "头痛", "triageLevel": "yellow", "targetDepartment": "神经内科" }
]'
                rows="10"
              ></textarea>
            </div>
            
            <div v-if="importPreview.length > 0" class="mt-4">
              <label class="form-label">预览 ({{ importPreview.length }} 条记录)</label>
              <div class="table-wrapper" style="overflow-x: auto; max-height: 200px; overflow-y: auto;">
                <table class="table" style="font-size: 13px;">
                  <thead>
                    <tr>
                      <th>分诊级别</th>
                      <th>姓名</th>
                      <th>年龄</th>
                      <th>性别</th>
                      <th>主诉</th>
                      <th>目标科室</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p, index) in importPreview" :key="index">
                      <td>
                        <span class="badge" :class="'triage-badge-' + (p.triageLevel || 'green')">
                          {{ patientsStore.getTriageLabel(p.triageLevel || 'green') }}
                        </span>
                      </td>
                      <td>{{ p.name || '-' }}</td>
                      <td>{{ p.age || '-' }}</td>
                      <td>{{ p.gender || '-' }}</td>
                      <td>{{ p.chiefComplaint || '-' }}</td>
                      <td>{{ p.targetDepartment || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div v-if="importError" class="alert alert-error mt-4">
              {{ importError }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="validateImport">验证</button>
            <button class="btn btn-secondary" @click="showImportModal = false">取消</button>
            <button class="btn btn-primary" @click="executeImport" :disabled="importPreview.length === 0 || importing">
              {{ importing ? '导入中...' : '导入' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { usePatientsStore } from '@/stores/patients'
import { useSystemStore } from '@/stores/system'
import { useDebounceFn } from '@vueuse/core'

const patientsStore = usePatientsStore()
const systemStore = useSystemStore()

const filterTriageLevel = ref('')
const filterStatus = ref('')
const searchText = ref('')
const showAddPatient = ref(false)
const showImportModal = ref(false)
const editingPatient = ref(null)
const saving = ref(false)
const importing = ref(false)
const importData = ref('')
const importPreview = ref([])
const importError = ref('')

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

const filteredPatients = computed(() => {
  let patients = patientsStore.patients
  
  if (filterTriageLevel.value) {
    patients = patients.filter(p => p.triageLevel === filterTriageLevel.value)
  }
  
  if (filterStatus.value) {
    patients = patients.filter(p => p.status === filterStatus.value)
  }
  
  if (searchText.value) {
    const keyword = searchText.value.toLowerCase()
    patients = patients.filter(p => 
      p.name?.toLowerCase().includes(keyword) ||
      p.chiefComplaint?.toLowerCase().includes(keyword)
    )
  }
  
  return patients
})

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

async function deletePatient(patient) {
  if (!confirm(`确定要删除患者 "${patient.name}" 吗？此操作不可恢复。`)) {
    return
  }
  try {
    await patientsStore.deletePatient(patient.id)
  } catch (error) {
    alert('删除失败: ' + error.message)
  }
}

function getStatusBadgeClass(status) {
  const map = {
    waiting: 'badge-warning',
    triage: 'badge-info',
    treatment: 'badge-success',
    transferred: 'badge-info',
    discharged: 'badge-gray'
  }
  return map[status] || 'badge-gray'
}

function formatTime(time) {
  if (!time) return '-'
  const d = new Date(time)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function getWaitTime(arrivalTime) {
  if (!arrivalTime) return '-'
  const arrival = new Date(arrivalTime)
  const now = new Date()
  const minutes = Math.floor((now - arrival) / 60000)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

function validateImport() {
  importError.value = ''
  importPreview.value = []
  
  if (!importData.value.trim()) {
    importError.value = '请输入 JSON 数据'
    return
  }
  
  try {
    const data = JSON.parse(importData.value)
    if (!Array.isArray(data)) {
      importError.value = '数据格式错误，必须是数组格式'
      return
    }
    if (data.length === 0) {
      importError.value = '数组不能为空'
      return
    }
    
    const invalid = data.findIndex(p => !p.name || !p.chiefComplaint)
    if (invalid !== -1) {
      importError.value = `第 ${invalid + 1} 条记录缺少必填字段（name 或 chiefComplaint）`
      return
    }
    
    importPreview.value = data
  } catch (error) {
    importError.value = 'JSON 格式错误: ' + error.message
  }
}

async function executeImport() {
  if (importPreview.value.length === 0) {
    validateImport()
    if (importPreview.value.length === 0) return
  }
  
  importing.value = true
  try {
    const result = await patientsStore.batchImport(importPreview.value)
    alert(`导入完成！成功: ${result.imported} 条，失败: ${result.failed} 条`)
    await patientsStore.fetchPatients()
    showImportModal.value = false
    importData.value = ''
    importPreview.value = []
  } catch (error) {
    alert('导入失败: ' + error.message)
  } finally {
    importing.value = false
  }
}

const fetchPatients = useDebounceFn(async () => {
  const params = {}
  if (filterTriageLevel.value) params.triageLevel = filterTriageLevel.value
  if (filterStatus.value) params.status = filterStatus.value
  await patientsStore.fetchPatients(params)
}, 300)

const debouncedSearch = useDebounceFn(() => {
  // 搜索使用 computed，不需要额外操作
}, 300)

watch(showAddPatient, (val) => {
  if (!val) {
    resetPatientForm()
  }
})

onMounted(() => {
  fetchPatients()
})
</script>

<style scoped>
.patients-view {
  width: 100%;
}

.filters {
  align-items: center;
}

.table-wrapper {
  width: 100%;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
  
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filters .form-group {
    min-width: auto !important;
  }
}
</style>
