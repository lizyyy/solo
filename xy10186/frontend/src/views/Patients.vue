<template>
  <div>
    <div class="page-header">
      <div class="page-title">患者管理</div>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新增患者
      </el-button>
    </div>

    <div class="filter-panel">
      <el-form :inline="true" :model="filters">
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="姓名/电话/身份证" clearable style="width: 200px" @keyup.enter="loadData" />
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
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="id_card" label="身份证号" width="180" />
        <el-table-column prop="gender" label="性别" width="80" />
        <el-table-column prop="age" label="年龄" width="80" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
        <el-table-column prop="create_time" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewHistory(row.id)">历史转诊</el-button>
            <el-button link @click="editPatient(row)">编辑</el-button>
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

    <el-dialog v-model="showCreateDialog" :title="isEdit ? '编辑患者' : '新增患者'" width="500px">
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item label="身份证号" prop="id_card">
          <el-input v-model="formData.id_card" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-select v-model="formData.gender" style="width: 100%">
            <el-option label="男" value="男" />
            <el-option label="女" value="女" />
          </el-select>
        </el-form-item>
        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="formData.age" :min="0" :max="150" style="width: 100%" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="formData.phone" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="formData.address" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showHistoryDialog" title="历史转诊记录" width="800px">
      <el-table :data="historyData" stripe style="width: 100%">
        <el-table-column prop="referral_no" label="转诊单号" width="180" />
        <el-table-column prop="source_hospital" label="来源医院" width="150" />
        <el-table-column prop="target_hospital" label="目标医院" width="150" />
        <el-table-column prop="target_department" label="目标科室" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="['status-tag', `status-${row.status}`]">{{ getStatusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="创建时间" width="180" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewReferral(row.id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 16px; text-align: right;">
        <el-pagination
          v-model:current-page="historyPagination.page"
          v-model:page-size="historyPagination.pageSize"
          :page-sizes="[5, 10, 20]"
          :total="historyPagination.total"
          layout="total, sizes, prev, pager, next"
          @size-change="loadHistory"
          @current-change="loadHistory"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const formRef = ref(null)
const showCreateDialog = ref(false)
const showHistoryDialog = ref(false)
const isEdit = ref(false)
const currentPatientId = ref(null)
const historyData = ref([])

const filters = reactive({
  keyword: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const historyPagination = reactive({
  page: 1,
  pageSize: 5,
  total: 0
})

const formData = reactive({
  name: '',
  id_card: '',
  gender: '男',
  age: 0,
  phone: '',
  address: ''
})

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }]
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

    const res = await axios.get('/api/patients', { params })
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
  filters.keyword = ''
  pagination.page = 1
  loadData()
}

const editPatient = (row) => {
  isEdit.value = true
  currentPatientId.value = row.id
  Object.assign(formData, row)
  showCreateDialog.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    if (isEdit.value) {
      ElMessage.info('编辑功能请在后端扩展实现')
    } else {
      const res = await axios.post('/api/patients', formData)
      if (res.data.success) {
        ElMessage.success('创建成功')
        showCreateDialog.value = false
        loadData()
      }
    }
  } catch (e) {
    if (e?.message) ElMessage.error(e.message)
  }
}

const viewHistory = (patientId) => {
  currentPatientId.value = patientId
  historyPagination.page = 1
  loadHistory()
  showHistoryDialog.value = true
}

const loadHistory = async () => {
  try {
    const res = await axios.get(`/api/patient-history/${currentPatientId.value}`, {
      params: {
        page: historyPagination.page,
        pageSize: historyPagination.pageSize
      }
    })
    if (res.data.success) {
      historyData.value = res.data.data
      historyPagination.total = res.data.total
    }
  } catch (e) {
    console.error('加载历史记录失败:', e)
  }
}

const viewReferral = (id) => {
  router.push(`/referral-orders/${id}`)
}

onMounted(() => {
  loadData()
})
</script>
