<template>
  <div class="patients-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>患者列表</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增患者
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="病区">
          <el-select v-model="searchForm.ward" placeholder="全部病区" clearable style="width: 150px">
            <el-option v-for="ward in wards" :key="ward.ward_name" :label="ward.ward_name" :value="ward.ward_name" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.is_discharged" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="在院" :value="false" />
            <el-option label="已出院" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="姓名/患者ID/身份证" clearable style="width: 200px" @keyup.enter="loadPatients" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadPatients">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="patients" v-loading="loading" border stripe>
        <el-table-column prop="patient_id" label="患者ID" width="130" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="gender" label="性别" width="70" />
        <el-table-column prop="age" label="年龄" width="70" />
        <el-table-column prop="ward" label="病区" width="120" />
        <el-table-column prop="bed_no" label="床号" width="100" />
        <el-table-column prop="diagnosis" label="诊断" show-overflow-tooltip />
        <el-table-column prop="admission_date" label="入院日期" width="120" />
        <el-table-column prop="discharge_date" label="出院日期" width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.is_discharged ? 'info' : 'success'" size="small">
              {{ row.is_discharged ? '已出院' : '在院' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="viewPatient(row)">详情</el-button>
            <el-button size="small" type="warning" link @click="editPatient(row)">编辑</el-button>
            <el-button size="small" type="info" link @click="viewLogs(row)">操作日志</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="patientDialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="patientForm" :rules="patientRules" ref="patientFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="患者ID" prop="patient_id">
              <el-input v-model="patientForm.patient_id" :disabled="isEdit" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="patientForm.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别" prop="gender">
              <el-select v-model="patientForm.gender" style="width: 100%">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年龄" prop="age">
              <el-input-number v-model="patientForm.age" :min="0" :max="150" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="病区" prop="ward">
              <el-select v-model="patientForm.ward" style="width: 100%">
                <el-option v-for="ward in wards" :key="ward.ward_name" :label="ward.ward_name" :value="ward.ward_name" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="床号" prop="bed_no">
              <el-input v-model="patientForm.bed_no" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入院日期" prop="admission_date">
              <el-date-picker v-model="patientForm.admission_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出院日期">
              <el-date-picker v-model="patientForm.discharge_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="disabledDate" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="诊断" prop="diagnosis">
              <el-input v-model="patientForm.diagnosis" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="patientForm.contact_phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="身份证号">
              <el-input v-model="patientForm.id_card" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="patientDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePatient">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logsDialogVisible" title="操作日志" width="800px">
      <el-timeline>
        <el-timeline-item v-for="log in patientLogs" :key="log.id" :timestamp="formatDate(log.created_at)" placement="top">
          <el-card>
            <div class="log-item">
              <div class="log-header">
                <el-tag :type="getOperationType(log.operation_type)?.type" size="small">
                  {{ getOperationType(log.operation_type)?.label }}
                </el-tag>
                <el-tag :type="log.result === 'success' ? 'success' : 'danger'" size="small">
                  {{ log.result === 'success' ? '成功' : '失败' }}
                </el-tag>
                <span class="log-operator">操作员: {{ log.operator }}</span>
              </div>
              <div class="log-content">{{ log.action }}</div>
              <div v-if="log.source_file" class="log-source">来源文件: {{ log.source_file }}</div>
              <div v-if="log.old_value" class="log-diff">旧值: {{ log.old_value }}</div>
              <div v-if="log.new_value" class="log-diff">新值: {{ log.new_value }}</div>
              <div v-if="log.notes" class="log-notes">备注: {{ log.notes }}</div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="患者详情" width="700px">
      <el-descriptions v-if="selectedPatient" :column="2" border>
        <el-descriptions-item label="患者ID">{{ selectedPatient.patient_id }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ selectedPatient.name }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ selectedPatient.gender }}</el-descriptions-item>
        <el-descriptions-item label="年龄">{{ selectedPatient.age }}</el-descriptions-item>
        <el-descriptions-item label="病区">{{ selectedPatient.ward }}</el-descriptions-item>
        <el-descriptions-item label="床号">{{ selectedPatient.bed_no }}</el-descriptions-item>
        <el-descriptions-item label="入院日期">{{ selectedPatient.admission_date }}</el-descriptions-item>
        <el-descriptions-item label="出院日期">{{ selectedPatient.discharge_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="诊断">{{ selectedPatient.diagnosis }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedPatient.is_discharged ? 'info' : 'success'">
            {{ selectedPatient.is_discharged ? '已出院' : '在院' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      
      <el-divider>陪护证列表</el-divider>
      <el-table :data="patientCertificates" v-loading="certLoading" size="small">
        <el-table-column prop="certificate_no" label="证件号" width="180" />
        <el-table-column prop="caregiver_name" label="陪护人" width="100" />
        <el-table-column prop="issue_date" label="发证日期" width="120" />
        <el-table-column prop="expiry_date" label="过期日期" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusInfo(row.status).type" size="small">
              {{ getStatusInfo(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">
            <span :class="{ 'text-danger': row.days_remaining < 0, 'text-warning': row.days_remaining >= 0 && row.days_remaining <= 3 }">
              {{ row.days_remaining >= 0 ? row.days_remaining + '天' : '已过期' }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { operationTypeMap, certificateStatusMap } from '@/utils/status'
import dayjs from 'dayjs'
import { Plus, Search, View } from '@element-plus/icons-vue'

const loading = ref(false)
const certLoading = ref(false)
const patients = ref([])
const wards = ref([])
const patientLogs = ref([])
const patientCertificates = ref([])
const selectedPatient = ref(null)

const patientDialogVisible = ref(false)
const logsDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const isEdit = ref(false)
const patientFormRef = ref(null)

const searchForm = reactive({
  ward: '',
  is_discharged: null,
  keyword: ''
})

const patientForm = reactive({
  patient_id: '',
  name: '',
  gender: '男',
  age: 0,
  id_card: '',
  ward: '',
  bed_no: '',
  admission_date: dayjs().format('YYYY-MM-DD'),
  discharge_date: null,
  diagnosis: '',
  contact_phone: '',
  is_discharged: false
})

const patientRules = {
  patient_id: [{ required: true, message: '请输入患者ID', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  ward: [{ required: true, message: '请选择病区', trigger: 'change' }],
  admission_date: [{ required: true, message: '请选择入院日期', trigger: 'change' }]
}

const dialogTitle = computed(() => isEdit.value ? '编辑患者' : '新增患者')

const disabledDate = (time) => {
  return time.getTime() < new Date(patientForm.admission_date).getTime()
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const getOperationType = (type) => {
  return operationTypeMap[type] || { label: type, type: 'info' }
}

const getStatusInfo = (status) => {
  return certificateStatusMap[status] || { label: status, type: 'info' }
}

const loadPatients = async () => {
  loading.value = true
  try {
    const params = {}
    if (searchForm.ward) params.ward = searchForm.ward
    if (searchForm.is_discharged !== null) params.is_discharged = searchForm.is_discharged
    if (searchForm.keyword) params.keyword = searchForm.keyword
    
    const res = await api.patients.list(params)
    patients.value = res.data
  } catch (error) {
    ElMessage.error('加载患者列表失败')
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

const resetSearch = () => {
  searchForm.ward = ''
  searchForm.is_discharged = null
  searchForm.keyword = ''
  loadPatients()
}

const openCreateDialog = () => {
  isEdit.value = false
  Object.assign(patientForm, {
    patient_id: '',
    name: '',
    gender: '男',
    age: 0,
    id_card: '',
    ward: wards.value[0]?.ward_name || '',
    bed_no: '',
    admission_date: dayjs().format('YYYY-MM-DD'),
    discharge_date: null,
    diagnosis: '',
    contact_phone: '',
    is_discharged: false
  })
  patientDialogVisible.value = true
}

const editPatient = (row) => {
  isEdit.value = true
  Object.assign(patientForm, { ...row })
  patientDialogVisible.value = true
}

const savePatient = async () => {
  try {
    await patientFormRef.value.validate()
    
    if (patientForm.discharge_date) {
      patientForm.is_discharged = true
    }
    
    if (isEdit.value) {
      await api.patients.update(patientForm.patient_id, patientForm)
      ElMessage.success('更新成功')
    } else {
      await api.patients.create(patientForm)
      ElMessage.success('创建成功')
    }
    
    patientDialogVisible.value = false
    loadPatients()
  } catch (error) {
    if (error !== false) {
      const msg = error.response?.data?.detail?.message || error.response?.data?.detail || '保存失败'
      ElMessage.error(msg)
    }
  }
}

const viewLogs = async (row) => {
  try {
    const res = await api.patients.logs(row.patient_id)
    patientLogs.value = res.data
    logsDialogVisible.value = true
  } catch (error) {
    ElMessage.error('加载日志失败')
  }
}

const viewPatient = async (row) => {
  selectedPatient.value = row
  certLoading.value = true
  try {
    const res = await api.certificates.list({ patient_id: row.patient_id })
    patientCertificates.value = res.data
  } catch (error) {
    console.error('加载陪护证失败')
  } finally {
    certLoading.value = false
  }
  detailDialogVisible.value = true
}

onMounted(() => {
  loadWards()
  loadPatients()
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

.log-item .log-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.log-item .log-operator {
  color: #909399;
  font-size: 12px;
}

.log-item .log-content {
  font-weight: 500;
  margin-bottom: 8px;
}

.log-item .log-source,
.log-item .log-diff,
.log-item .log-notes {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
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
