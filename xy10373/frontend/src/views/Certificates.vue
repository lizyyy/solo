<template>
  <div class="certificates-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>证件管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            办理新证
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 130px">
            <el-option label="有效" value="active" />
            <el-option label="即将过期" value="expiring_soon" />
            <el-option label="已过期" value="expired" />
            <el-option label="已注销" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="病区">
          <el-select v-model="searchForm.ward" placeholder="全部病区" clearable style="width: 150px">
            <el-option v-for="ward in wards" :key="ward.ward_name" :label="ward.ward_name" :value="ward.ward_name" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadCertificates">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="certificates" v-loading="loading" border stripe>
        <el-table-column prop="certificate_no" label="证件号" width="200" />
        <el-table-column prop="patient_id" label="患者ID" width="120" />
        <el-table-column prop="caregiver_name" label="陪护人" width="100" />
        <el-table-column label="患者信息" width="180">
          <template #default="{ row }">
            <div>
              <div>{{ getPatientName(row.patient_id) }}</div>
              <div style="color: #909399; font-size: 12px">{{ getPatientWard(row.patient_id) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="issue_date" label="发证日期" width="120" />
        <el-table-column prop="expiry_date" label="过期日期" width="120" />
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">
            <span :class="getDaysClass(row.days_remaining, row.status)">
              {{ row.days_remaining >= 0 ? row.days_remaining + '天' : '已过期' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusInfo(row.status).type" size="small">
              {{ getStatusInfo(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source_file" label="来源文件" width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="viewDetail(row)">详情</el-button>
            <el-button size="small" type="success" link @click="renewCertificate(row)" :disabled="!canRenew(row)">续期</el-button>
            <el-button size="small" type="warning" link @click="requestReplacement(row)" :disabled="!canReplace(row)">换人</el-button>
            <el-button size="small" type="danger" link @click="cancelCertificate(row)" :disabled="!canCancel(row)">注销</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="办理新陪护证" width="700px">
      <el-form :model="certForm" :rules="certRules" ref="certFormRef" label-width="110px">
        <el-alert v-if="validationError" :title="validationError" type="error" :closable="false" style="margin-bottom: 20px" />
        
        <el-form-item label="患者" prop="patient_id">
          <el-select v-model="certForm.patient_id" filterable placeholder="请选择患者" style="width: 100%" @change="onPatientChange">
            <el-option v-for="patient in activePatients" :key="patient.patient_id" :label="`${patient.name} (${patient.patient_id} - ${patient.ward})`" :value="patient.patient_id" />
          </el-select>
          <div v-if="selectedPatient" class="patient-info">
            <span>病区: {{ selectedPatient.ward }}</span>
            <span>床号: {{ selectedPatient.bed_no }}</span>
            <span>诊断: {{ selectedPatient.diagnosis }}</span>
            <span v-if="selectedPatient.is_discharged" style="color: #f56c6c">⚠️ 患者已出院</span>
          </div>
        </el-form-item>
        
        <el-divider content-position="left">陪护人信息</el-divider>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="caregiver_name">
              <el-input v-model="caregiverForm.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="身份证号" prop="caregiver_id_card">
              <el-input v-model="caregiverForm.id_card" @blur="checkExistingCaregiver" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别" prop="caregiver_gender">
              <el-select v-model="caregiverForm.gender" style="width: 100%">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="与患者关系" prop="caregiver_relation">
              <el-select v-model="caregiverForm.relation_to_patient" filterable allow-create style="width: 100%">
                <el-option label="配偶" value="配偶" />
                <el-option label="父亲" value="父亲" />
                <el-option label="母亲" value="母亲" />
                <el-option label="儿子" value="儿子" />
                <el-option label="女儿" value="女儿" />
                <el-option label="兄弟姐妹" value="兄弟姐妹" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="caregiverForm.phone" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-divider content-position="left">证件信息</el-divider>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="发证日期" prop="issue_date">
              <el-date-picker v-model="certForm.issue_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效期至" prop="expiry_date">
              <el-date-picker v-model="certForm.expiry_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="来源文件">
          <el-input v-model="certForm.source_file" placeholder="如: 住院登记单_张三.pdf" />
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input v-model="certForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createCertificate">办理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="证件详情" width="600px">
      <el-descriptions v-if="currentCert" :column="2" border>
        <el-descriptions-item label="证件号" :span="2">{{ currentCert.certificate_no }}</el-descriptions-item>
        <el-descriptions-item label="患者">{{ getPatientName(currentCert.patient_id) }}</el-descriptions-item>
        <el-descriptions-item label="患者ID">{{ currentCert.patient_id }}</el-descriptions-item>
        <el-descriptions-item label="陪护人">{{ currentCert.caregiver_name }}</el-descriptions-item>
        <el-descriptions-item label="陪护人ID">{{ currentCert.caregiver_id }}</el-descriptions-item>
        <el-descriptions-item label="发证日期">{{ currentCert.issue_date }}</el-descriptions-item>
        <el-descriptions-item label="过期日期">{{ currentCert.expiry_date }}</el-descriptions-item>
        <el-descriptions-item label="剩余天数">
          <span :class="getDaysClass(currentCert.days_remaining, currentCert.status)">
            {{ currentCert.days_remaining >= 0 ? currentCert.days_remaining + '天' : '已过期' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusInfo(currentCert.status).type">
            {{ getStatusInfo(currentCert.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="来源文件" :span="2">{{ currentCert.source_file || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentCert.notes || '-' }}</el-descriptions-item>
      </el-descriptions>
      
      <el-divider>操作历史</el-divider>
      <el-table :data="certLogs" v-loading="logsLoading" size="small">
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="operation_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getOperationType(row.operation_type)?.type" size="small">
              {{ getOperationType(row.operation_type)?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作员" width="80" />
        <el-table-column prop="action" label="操作" show-overflow-tooltip />
        <el-table-column prop="source_file" label="来源文件" width="120" show-overflow-tooltip />
        <el-table-column prop="result" label="结果" width="60">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'" size="small">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="renewDialogVisible" title="续期证件" width="500px">
      <el-descriptions v-if="currentCert" :column="1" border>
        <el-descriptions-item label="证件号">{{ currentCert.certificate_no }}</el-descriptions-item>
        <el-descriptions-item label="患者">{{ getPatientName(currentCert.patient_id) }}</el-descriptions-item>
        <el-descriptions-item label="陪护人">{{ currentCert.caregiver_name }}</el-descriptions-item>
        <el-descriptions-item label="原过期日期">{{ currentCert.expiry_date }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="100px" style="margin-top: 20px">
        <el-form-item label="新过期日期">
          <el-date-picker v-model="newExpiryDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="disabledRenewDate" />
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="renewOperator" placeholder="请输入操作员姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRenew">确认续期</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { certificateStatusMap, operationTypeMap } from '@/utils/status'
import dayjs from 'dayjs'
import { Plus, Search } from '@element-plus/icons-vue'

const router = useRouter()

const loading = ref(false)
const logsLoading = ref(false)
const certificates = ref([])
const wards = ref([])
const activePatients = ref([])
const allPatients = ref([])
const certLogs = ref([])
const currentCert = ref(null)
const validationError = ref('')

const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const renewDialogVisible = ref(false)
const certFormRef = ref(null)

const searchForm = reactive({
  status: '',
  ward: ''
})

const certForm = reactive({
  patient_id: '',
  caregiver_id: '',
  issue_date: dayjs().format('YYYY-MM-DD'),
  expiry_date: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  source_file: '',
  notes: '',
  operator: '管理员'
})

const caregiverForm = reactive({
  caregiver_id: '',
  name: '',
  gender: '男',
  id_card: '',
  relation_to_patient: '',
  phone: ''
})

const certRules = {
  patient_id: [{ required: true, message: '请选择患者', trigger: 'change' }],
  caregiver_name: [{ required: true, message: '请输入陪护人姓名', trigger: 'blur' }],
  caregiver_id_card: [{ required: true, message: '请输入身份证号', trigger: 'blur' }],
  caregiver_gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  caregiver_relation: [{ required: true, message: '请选择与患者关系', trigger: 'change' }],
  issue_date: [{ required: true, message: '请选择发证日期', trigger: 'change' }],
  expiry_date: [{ required: true, message: '请选择有效期', trigger: 'change' }]
}

const selectedPatient = computed(() => {
  return allPatients.value.find(p => p.patient_id === certForm.patient_id)
})

const newExpiryDate = ref('')
const renewOperator = ref('管理员')

const disabledRenewDate = (time) => {
  if (!currentCert.value) return true
  return time.getTime() <= new Date(currentCert.value.expiry_date).getTime()
}

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

const getStatusInfo = (status) => certificateStatusMap[status] || { label: status, type: 'info' }

const getOperationType = (type) => operationTypeMap[type] || { label: type, type: 'info' }

const getPatientName = (patientId) => {
  const p = allPatients.value.find(p => p.patient_id === patientId)
  return p?.name || patientId
}

const getPatientWard = (patientId) => {
  const p = allPatients.value.find(p => p.patient_id === patientId)
  return p?.ward || ''
}

const getDaysClass = (days, status) => {
  if (status === 'expired' || days < 0) return 'text-danger'
  if (days <= 3) return 'text-warning'
  return ''
}

const canRenew = (row) => {
  return row.status === 'active' || row.status === 'expiring_soon'
}

const canReplace = (row) => {
  return row.status === 'active' || row.status === 'expiring_soon'
}

const canCancel = (row) => {
  return row.status === 'active' || row.status === 'expiring_soon'
}

const loadCertificates = async () => {
  loading.value = true
  try {
    const params = {}
    if (searchForm.status) params.status = searchForm.status
    if (searchForm.ward) params.ward = searchForm.ward
    
    const res = await api.certificates.list(params)
    certificates.value = res.data
  } catch (error) {
    ElMessage.error('加载证件列表失败')
  } finally {
    loading.value = false
  }
}

const loadWards = async () => {
  try {
    const res = await api.wards.list()
    wards.value = res.data
  } catch (error) {
    console.error('加载病区列表失败')
  }
}

const loadPatients = async () => {
  try {
    const res = await api.patients.list()
    allPatients.value = res.data
    activePatients.value = res.data.filter(p => !p.is_discharged)
  } catch (error) {
    console.error('加载患者列表失败')
  }
}

const resetSearch = () => {
  searchForm.status = ''
  searchForm.ward = ''
  loadCertificates()
}

const openCreateDialog = () => {
  Object.assign(certForm, {
    patient_id: '',
    caregiver_id: '',
    issue_date: dayjs().format('YYYY-MM-DD'),
    expiry_date: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    source_file: '',
    notes: '',
    operator: '管理员'
  })
  Object.assign(caregiverForm, {
    caregiver_id: '',
    name: '',
    gender: '男',
    id_card: '',
    relation_to_patient: '',
    phone: ''
  })
  validationError.value = ''
  createDialogVisible.value = true
}

const onPatientChange = async (patientId) => {
  validationError.value = ''
  if (!patientId) return
  
  const patient = allPatients.value.find(p => p.patient_id === patientId)
  if (patient?.is_discharged) {
    validationError.value = `患者 ${patient.name} 已出院，无法办理陪护证`
    return
  }
  
  const ward = wards.value.find(w => w.ward_name === patient?.ward)
  if (ward) {
    certForm.expiry_date = dayjs().add(ward.default_validity_days, 'day').format('YYYY-MM-DD')
  }
}

const checkExistingCaregiver = async () => {
  if (!caregiverForm.id_card || caregiverForm.id_card.length !== 18) return
  
  try {
    const res = await api.caregivers.list({ keyword: caregiverForm.id_card })
    const existing = res.data.find(c => c.id_card === caregiverForm.id_card)
    if (existing) {
      caregiverForm.name = existing.name
      caregiverForm.gender = existing.gender
      caregiverForm.relation_to_patient = existing.relation_to_patient
      caregiverForm.phone = existing.phone || ''
      caregiverForm.caregiver_id = existing.caregiver_id
      ElMessage.info('已匹配到现有陪护人信息')
    }
  } catch (error) {
    console.error('查询陪护人失败')
  }
}

const createCertificate = async () => {
  try {
    await certFormRef.value.validate()
    
    if (validationError.value) {
      ElMessage.error(validationError.value)
      return
    }
    
    if (!caregiverForm.caregiver_id) {
      caregiverForm.caregiver_id = 'CG' + caregiverForm.id_card.slice(-8)
    }
    
    const caregiverData = {
      caregiver_id: caregiverForm.caregiver_id,
      name: caregiverForm.name,
      gender: caregiverForm.gender,
      id_card: caregiverForm.id_card,
      relation_to_patient: caregiverForm.relation_to_patient,
      phone: caregiverForm.phone
    }
    
    await api.caregivers.create(caregiverData)
    
    const certData = {
      ...certForm,
      caregiver_id: caregiverForm.caregiver_id
    }
    
    await api.certificates.create(certData)
    ElMessage.success('办理成功')
    createDialogVisible.value = false
    loadCertificates()
  } catch (error) {
    if (error !== false) {
      let msg = '办理失败'
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail
        if (typeof detail === 'object') {
          msg = detail.message || detail.error_code || '办理失败'
        } else {
          msg = detail
        }
      }
      ElMessage.error(msg)
    }
  }
}

const viewDetail = async (row) => {
  currentCert.value = row
  logsLoading.value = true
  try {
    const res = await api.certificates.logs(row.id)
    certLogs.value = res.data
  } catch (error) {
    console.error('加载日志失败')
  } finally {
    logsLoading.value = false
  }
  detailDialogVisible.value = true
}

const renewCertificate = (row) => {
  currentCert.value = row
  newExpiryDate.value = dayjs(row.expiry_date).add(7, 'day').format('YYYY-MM-DD')
  renewOperator.value = '管理员'
  renewDialogVisible.value = true
}

const confirmRenew = async () => {
  if (!newExpiryDate.value) {
    ElMessage.warning('请选择新的过期日期')
    return
  }
  if (!renewOperator.value) {
    ElMessage.warning('请输入操作员姓名')
    return
  }
  
  try {
    await api.certificates.renew(currentCert.value.id, {
      new_expiry_date: newExpiryDate.value,
      operator: renewOperator.value
    })
    ElMessage.success('续期成功')
    renewDialogVisible.value = false
    loadCertificates()
  } catch (error) {
    ElMessage.error('续期失败')
  }
}

const requestReplacement = (row) => {
  router.push({
    path: '/replacements',
    query: { certificate_id: row.id }
  })
}

const cancelCertificate = async (row) => {
  try {
    await ElMessageBox.confirm('确定要注销此陪护证吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await api.certificates.cancel(row.id, {
      operator: '管理员',
      reason: '手动注销'
    })
    ElMessage.success('注销成功')
    loadCertificates()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('注销失败')
    }
  }
}

onMounted(() => {
  loadWards()
  loadPatients()
  loadCertificates()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}

.patient-info {
  margin-top: 8px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.text-danger {
  color: #f56c6c;
  font-weight: bold;
}

.text-warning {
  color: #e6a23c;
  font-weight: bold;
}
</style>
