<template>
  <div class="replacements-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>换人申请管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建申请
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 130px">
            <el-option label="待审批" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRequests">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="requests" v-loading="loading" border stripe>
        <el-table-column prop="request_no" label="申请单号" width="200" />
        <el-table-column prop="patient_name" label="患者" width="100" />
        <el-table-column prop="patient_id" label="患者ID" width="120" />
        <el-table-column prop="old_caregiver_name" label="原陪护人" width="100" />
        <el-table-column label="新陪护人" width="150">
          <template #default="{ row }">
            <div>
              <div>{{ row.new_caregiver_name }}</div>
              <div style="color: #909399; font-size: 12px">{{ row.new_caregiver_relation }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="申请原因" show-overflow-tooltip min-width="150" />
        <el-table-column prop="requested_by" label="申请人" width="100" />
        <el-table-column prop="request_date" label="申请时间" width="170">
          <template #default="{ row }">{{ formatDate(row.request_date) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusInfo(row.status).type" size="small">
              {{ getStatusInfo(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'pending'" size="small" type="success" link @click="reviewRequest(row, 'approved')">通过</el-button>
            <el-button v-if="row.status === 'pending'" size="small" type="danger" link @click="reviewRequest(row, 'rejected')">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新建换人申请" width="600px">
      <el-form :model="requestForm" :rules="requestRules" ref="requestFormRef" label-width="110px">
        <el-form-item label="选择证件" prop="certificate_id">
          <el-select v-model="requestForm.certificate_id" filterable placeholder="请选择要换人的陪护证" style="width: 100%" @change="onCertificateChange">
            <el-option v-for="cert in activeCertificates" :key="cert.id" :label="`${cert.certificate_no} - ${getPatientName(cert.patient_id)} (${cert.caregiver_name})`" :value="cert.id" />
          </el-select>
          <div v-if="selectedCertificate" class="cert-info">
            <span>证件号: {{ selectedCertificate.certificate_no }}</span>
            <span>患者: {{ getPatientName(selectedCertificate.patient_id) }}</span>
            <span>原陪护人: {{ selectedCertificate.caregiver_name }}</span>
            <span>有效期至: {{ selectedCertificate.expiry_date }}</span>
          </div>
        </el-form-item>
        
        <el-divider content-position="left">新陪护人信息</el-divider>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="new_caregiver_name">
              <el-input v-model="requestForm.new_caregiver_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="身份证号" prop="new_caregiver_id_card">
              <el-input v-model="requestForm.new_caregiver_id_card" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="与患者关系" prop="new_caregiver_relation">
              <el-select v-model="requestForm.new_caregiver_relation" filterable allow-create style="width: 100%">
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
              <el-input v-model="requestForm.new_caregiver_phone" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="换人原因" prop="reason">
          <el-input v-model="requestForm.reason" type="textarea" :rows="3" placeholder="请详细说明换人原因" />
        </el-form-item>
        
        <el-form-item label="申请人" prop="requested_by">
          <el-input v-model="requestForm.requested_by" placeholder="请输入申请人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRequest">提交申请</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="申请详情" width="600px">
      <el-descriptions v-if="currentRequest" :column="2" border>
        <el-descriptions-item label="申请单号" :span="2">{{ currentRequest.request_no }}</el-descriptions-item>
        <el-descriptions-item label="患者">{{ currentRequest.patient_name }}</el-descriptions-item>
        <el-descriptions-item label="患者ID">{{ currentRequest.patient_id }}</el-descriptions-item>
        <el-descriptions-item label="原陪护人">{{ currentRequest.old_caregiver_name }}</el-descriptions-item>
        <el-descriptions-item label="新陪护人">{{ currentRequest.new_caregiver_name }}</el-descriptions-item>
        <el-descriptions-item label="关系">{{ currentRequest.new_caregiver_relation }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ currentRequest.new_caregiver_phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请原因" :span="2">{{ currentRequest.reason }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ currentRequest.requested_by }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ formatDate(currentRequest.request_date) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusInfo(currentRequest.status).type">
            {{ getStatusInfo(currentRequest.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="currentRequest.approved_by" label="审批人">{{ currentRequest.approved_by }}</el-descriptions-item>
        <el-descriptions-item v-if="currentRequest.approval_date" label="审批时间">{{ formatDate(currentRequest.approval_date) }}</el-descriptions-item>
        <el-descriptions-item v-if="currentRequest.approval_notes" label="审批备注" :span="2">{{ currentRequest.approval_notes }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" :title="`${reviewAction === 'approved' ? '通过' : '驳回'}申请`" width="500px">
      <el-descriptions v-if="currentRequest" :column="1" border size="small">
        <el-descriptions-item label="申请单号">{{ currentRequest.request_no }}</el-descriptions-item>
        <el-descriptions-item label="患者">{{ currentRequest.patient_name }}</el-descriptions-item>
        <el-descriptions-item label="原陪护人">{{ currentRequest.old_caregiver_name }}</el-descriptions-item>
        <el-descriptions-item label="新陪护人">{{ currentRequest.new_caregiver_name }} ({{ currentRequest.new_caregiver_relation }})</el-descriptions-item>
        <el-descriptions-item label="申请原因">{{ currentRequest.reason }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="100px" style="margin-top: 20px">
        <el-form-item label="审批人">
          <el-input v-model="reviewForm.approved_by" placeholder="请输入审批人姓名" />
        </el-form-item>
        <el-form-item label="审批备注">
          <el-input v-model="reviewForm.approval_notes" type="textarea" :rows="2" placeholder="请输入审批备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button :type="reviewAction === 'approved' ? 'success' : 'danger'" @click="confirmReview">
          确认{{ reviewAction === 'approved' ? '通过' : '驳回' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { replacementStatusMap } from '@/utils/status'
import dayjs from 'dayjs'
import { Plus, Search } from '@element-plus/icons-vue'

const route = useRoute()

const loading = ref(false)
const requests = ref([])
const activeCertificates = ref([])
const allPatients = ref([])
const currentRequest = ref(null)

const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const reviewDialogVisible = ref(false)
const requestFormRef = ref(null)
const reviewAction = ref('')

const searchForm = reactive({
  status: ''
})

const requestForm = reactive({
  certificate_id: null,
  new_caregiver_name: '',
  new_caregiver_id_card: '',
  new_caregiver_relation: '',
  new_caregiver_phone: '',
  reason: '',
  requested_by: '管理员'
})

const reviewForm = reactive({
  approved_by: '护士长',
  approval_notes: ''
})

const requestRules = {
  certificate_id: [{ required: true, message: '请选择证件', trigger: 'change' }],
  new_caregiver_name: [{ required: true, message: '请输入新陪护人姓名', trigger: 'blur' }],
  new_caregiver_id_card: [{ required: true, message: '请输入身份证号', trigger: 'blur' }],
  new_caregiver_relation: [{ required: true, message: '请选择与患者关系', trigger: 'change' }],
  reason: [{ required: true, message: '请输入换人原因', trigger: 'blur' }],
  requested_by: [{ required: true, message: '请输入申请人', trigger: 'blur' }]
}

const selectedCertificate = computed(() => {
  return activeCertificates.value.find(c => c.id === requestForm.certificate_id)
})

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

const getStatusInfo = (status) => replacementStatusMap[status] || { label: status, type: 'info' }

const getPatientName = (patientId) => {
  const p = allPatients.value.find(p => p.patient_id === patientId)
  return p?.name || patientId
}

const loadRequests = async () => {
  loading.value = true
  try {
    const params = {}
    if (searchForm.status) params.status = searchForm.status
    
    const res = await api.replacements.list(params)
    requests.value = res.data
  } catch (error) {
    ElMessage.error('加载申请列表失败')
  } finally {
    loading.value = false
  }
}

const loadCertificates = async () => {
  try {
    const res = await api.certificates.list({ status: 'active' })
    activeCertificates.value = res.data.filter(c => c.status === 'active' || c.status === 'expiring_soon')
  } catch (error) {
    console.error('加载证件列表失败')
  }
}

const loadPatients = async () => {
  try {
    const res = await api.patients.list()
    allPatients.value = res.data
  } catch (error) {
    console.error('加载患者列表失败')
  }
}

const resetSearch = () => {
  searchForm.status = ''
  loadRequests()
}

const openCreateDialog = () => {
  Object.assign(requestForm, {
    certificate_id: null,
    new_caregiver_name: '',
    new_caregiver_id_card: '',
    new_caregiver_relation: '',
    new_caregiver_phone: '',
    reason: '',
    requested_by: '管理员'
  })
  createDialogVisible.value = true
}

const onCertificateChange = () => {}

const submitRequest = async () => {
  try {
    await requestFormRef.value.validate()
    await api.replacements.create(requestForm)
    ElMessage.success('申请提交成功')
    createDialogVisible.value = false
    loadRequests()
  } catch (error) {
    if (error !== false) {
      let msg = '提交失败'
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail
        if (typeof detail === 'object') {
          msg = detail.message || detail.error_code || '提交失败'
        } else {
          msg = detail
        }
      }
      ElMessage.error(msg)
    }
  }
}

const viewDetail = (row) => {
  currentRequest.value = row
  detailDialogVisible.value = true
}

const reviewRequest = (row, action) => {
  currentRequest.value = row
  reviewAction.value = action
  reviewForm.approved_by = '护士长'
  reviewForm.approval_notes = ''
  reviewDialogVisible.value = true
}

const confirmReview = async () => {
  if (!reviewForm.approved_by) {
    ElMessage.warning('请输入审批人姓名')
    return
  }
  
  try {
    await api.replacements.review(currentRequest.value.id, {
      status: reviewAction.value,
      approved_by: reviewForm.approved_by,
      approval_notes: reviewForm.approval_notes
    })
    ElMessage.success(reviewAction.value === 'approved' ? '审批通过' : '已驳回')
    reviewDialogVisible.value = false
    loadRequests()
  } catch (error) {
    ElMessage.error('审批失败')
  }
}

onMounted(() => {
  loadPatients()
  loadCertificates()
  loadRequests()
  
  if (route.query.certificate_id) {
    requestForm.certificate_id = parseInt(route.query.certificate_id)
    createDialogVisible.value = true
  }
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

.cert-info {
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
</style>
