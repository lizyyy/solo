<template>
  <div>
    <div class="page-header">
      <div class="page-title">转诊单管理</div>
      <div>
        <el-button @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          导入
        </el-button>
        <el-button @click="handleExport('xlsx')">
          <el-icon><Download /></el-icon>
          导出Excel
        </el-button>
        <el-button @click="handleExport('csv')">
          <el-icon><Document /></el-icon>
          导出CSV
        </el-button>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新建转诊单
        </el-button>
      </div>
    </div>

    <div class="filter-panel">
      <el-form :inline="true" :model="filters">
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="转诊单号/患者姓名/电话" clearable style="width: 200px" @keyup.enter="loadData" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px">
            <el-option label="待接诊" value="pending" />
            <el-option label="已接诊" value="accepted" />
            <el-option label="检查中" value="checking" />
            <el-option label="已出报告" value="reported" />
            <el-option label="已闭环" value="closed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源医院">
          <el-select v-model="filters.source_hospital" placeholder="全部" clearable filterable style="width: 160px">
            <el-option v-for="h in sourceHospitals" :key="h" :label="h" :value="h" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标医院">
          <el-select v-model="filters.target_hospital" placeholder="全部" clearable filterable style="width: 160px">
            <el-option v-for="h in targetHospitals" :key="h" :label="h" :value="h" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilters">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="referral_no" label="转诊单号" width="180" />
        <el-table-column prop="patient_name" label="患者姓名" width="100" />
        <el-table-column label="性别/年龄" width="100">
          <template #default="{ row }">
            {{ row.patient_gender || '-' }} / {{ row.patient_age || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="source_hospital" label="来源医院" width="150" />
        <el-table-column prop="target_hospital" label="目标医院" width="150" />
        <el-table-column prop="target_department" label="目标科室" width="120" />
        <el-table-column prop="referral_reason" label="转诊原因" min-width="150" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="['status-tag', `status-${row.status}`]">{{ getStatusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="创建时间" width="180" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row.id)">详情</el-button>
            <el-button type="success" link @click="handleAccept(row)" v-if="row.status === 'pending'">接诊</el-button>
            <el-button type="warning" link @click="handleStatus(row, 'checking')" v-if="row.status === 'accepted'">开始检查</el-button>
            <el-button type="info" link @click="handleStatus(row, 'reported')" v-if="row.status === 'checking'">报告完成</el-button>
            <el-button type="success" link @click="handleStatus(row, 'closed')" v-if="row.status === 'reported'">闭环</el-button>
            <el-button type="danger" link @click="handleCancel(row)" v-if="['pending', 'accepted', 'checking'].includes(row.status)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 16px; text-align: right;">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </div>

    <el-dialog v-model="createDialogVisible" :title="isEdit ? '编辑转诊单' : '新建转诊单'" width="800px" destroy-on-close>
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
        <el-divider content-position="left">患者信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="患者姓名" prop="patient_info.name">
              <el-input v-model="formData.patient_info.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="身份证号">
              <el-input v-model="formData.patient_info.id_card" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别">
              <el-select v-model="formData.patient_info.gender" style="width: 100%">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年龄">
              <el-input-number v-model="formData.patient_info.age" :min="0" :max="150" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="patient_info.phone">
              <el-input v-model="formData.patient_info.phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="地址">
              <el-input v-model="formData.patient_info.address" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-divider content-position="left">转诊信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="来源医院" prop="source_hospital">
              <el-select v-model="formData.source_hospital" filterable allow-create style="width: 100%">
                <el-option v-for="h in sourceHospitals" :key="h" :label="h" :value="h" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源科室">
              <el-select v-model="formData.source_department" filterable allow-create style="width: 100%">
                <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源医生">
              <el-input v-model="formData.source_doctor" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标医院" prop="target_hospital">
              <el-select v-model="formData.target_hospital" filterable allow-create style="width: 100%">
                <el-option v-for="h in targetHospitals" :key="h" :label="h" :value="h" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标科室" prop="target_department">
              <el-select v-model="formData.target_department" filterable allow-create style="width: 100%">
                <el-option v-for="d in departments" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标医生">
              <el-input v-model="formData.target_doctor" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="转诊时间" prop="referral_time">
              <el-date-picker
                v-model="formData.referral_time"
                type="datetime"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="转诊原因" prop="referral_reason">
          <el-input v-model="formData.referral_reason" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="初步诊断" prop="initial_diagnosis">
          <el-input v-model="formData.initial_diagnosis" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showImportDialog" title="导入转诊单" width="500px">
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="true"
        :on-change="handleImportFileChange"
        accept=".xlsx,.xls,.csv"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 .xlsx, .xls, .csv 格式文件</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="submitImport" :disabled="!importFile">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const formRef = ref(null)
const createDialogVisible = ref(false)
const showImportDialog = ref(false)
const importFile = ref(null)
const loading = ref(false)
const isEdit = ref(false)

const tableData = ref([])
const sourceHospitals = ref(['基层社区卫生服务中心', '区人民医院', '中医医院', '妇幼保健院'])
const targetHospitals = ref(['市人民医院', '市中心医院', '医科大学附属医院', '省人民医院'])
const departments = ref(['内科', '外科', '妇产科', '儿科', '骨科', '神经内科', '心血管内科', '消化内科', '呼吸内科', '肿瘤科'])

const filters = reactive({
  keyword: '',
  status: '',
  source_hospital: '',
  target_hospital: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const formData = reactive({
  patient_info: {
    name: '',
    id_card: '',
    gender: '男',
    age: 0,
    phone: '',
    address: ''
  },
  source_hospital: '',
  source_department: '',
  source_doctor: '',
  target_hospital: '',
  target_department: '',
  target_doctor: '',
  referral_time: '',
  referral_reason: '',
  initial_diagnosis: ''
})

const formRules = {
  'patient_info.name': [{ required: true, message: '请输入患者姓名', trigger: 'blur' }],
  'patient_info.phone': [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  source_hospital: [{ required: true, message: '请选择来源医院', trigger: 'change' }],
  target_hospital: [{ required: true, message: '请选择目标医院', trigger: 'change' }],
  target_department: [{ required: true, message: '请选择目标科室', trigger: 'change' }],
  referral_time: [{ required: true, message: '请选择转诊时间', trigger: 'change' }],
  referral_reason: [{ required: true, message: '请输入转诊原因', trigger: 'blur' }],
  initial_diagnosis: [{ required: true, message: '请输入初步诊断', trigger: 'blur' }]
}

const getStatusText = (status) => {
  const map = {
    'pending': '待接诊',
    'accepted': '已接诊',
    'checking': '检查中',
    'reported': '已出报告',
    'closed': '已闭环',
    'cancelled': '已取消'
  }
  return map[status] || status
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...filters,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    Object.keys(params).forEach(key => {
      if (!params[key]) delete params[key]
    })

    const res = await axios.get('/api/referral-orders', { params })
    if (res.data.success) {
      tableData.value = res.data.data
      pagination.total = res.data.total
    }
  } catch (e) {
    console.error('加载数据失败:', e)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  Object.assign(filters, {
    keyword: '',
    status: '',
    source_hospital: '',
    target_hospital: ''
  })
  pagination.page = 1
  loadData()
}

const handleCreate = () => {
  isEdit.value = false
  Object.assign(formData, {
    patient_info: {
      name: '',
      id_card: '',
      gender: '男',
      age: 0,
      phone: '',
      address: ''
    },
    source_hospital: '',
    source_department: '',
    source_doctor: '',
    target_hospital: '',
    target_department: '',
    target_doctor: '',
    referral_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
    referral_reason: '',
    initial_diagnosis: ''
  })
  createDialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    const res = await axios.post('/api/referral-orders', formData)
    if (res.data.success) {
      ElMessage.success('创建成功')
      createDialogVisible.value = false
      loadData()
    }
  } catch (e) {
    if (e?.message) ElMessage.error(e.message)
  }
}

const viewDetail = (id) => {
  router.push(`/referral-orders/${id}`)
}

const handleAccept = async (row) => {
  try {
    await ElMessageBox.confirm('确定接诊该转诊单？', '提示', { type: 'warning' })
    const res = await axios.put(`/api/referral-orders/${row.id}/status`, {
      status: 'accepted',
      visit_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    })
    if (res.data.success) {
      ElMessage.success('接诊成功')
      loadData()
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '操作失败')
  }
}

const handleStatus = async (row, status) => {
  try {
    const timeField = status === 'checking' ? 'check_time' : (status === 'reported' ? 'report_time' : 'close_time')
    const data = { status }
    data[timeField] = new Date().toISOString().slice(0, 19).replace('T', ' ')
    
    const res = await axios.put(`/api/referral-orders/${row.id}/status`, data)
    if (res.data.success) {
      ElMessage.success('操作成功')
      loadData()
    }
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const handleCancel = async (row) => {
  try {
    await ElMessageBox.confirm('确定取消该转诊单？', '提示', { type: 'warning' })
    const res = await axios.put(`/api/referral-orders/${row.id}/status`, { status: 'cancelled' })
    if (res.data.success) {
      ElMessage.success('取消成功')
      loadData()
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '操作失败')
  }
}

const handleExport = (format) => {
  const params = new URLSearchParams({
    format,
    ...filters
  }).toString()
  window.open(`/api/export/referral-orders?${params}`, '_blank')
}

const handleImportFileChange = (file) => {
  importFile.value = file.raw
}

const submitImport = async () => {
  if (!importFile.value) return
  
  const formData = new FormData()
  formData.append('file', importFile.value)
  
  try {
    const res = await axios.post('/api/import/referral-orders', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    if (res.data.success) {
      const { successCount, failCount, errors } = res.data.data
      if (errors && errors.length > 0) {
        ElMessage.warning(`导入完成：成功${successCount}条，失败${failCount}条`)
      } else {
        ElMessage.success(`导入成功，共${successCount}条`)
      }
      showImportDialog.value = false
      importFile.value = null
      loadData()
    }
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
