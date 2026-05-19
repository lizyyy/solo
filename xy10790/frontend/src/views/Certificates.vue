<template>
  <div class="certificates-page">
    <h2 class="page-title">证书资格管理</h2>
    
    <el-card class="filter-card">
      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="学员ID">
          <el-input v-model="filters.student_id" placeholder="请输入学员ID" clearable />
        </el-form-item>
        <el-form-item label="课程ID">
          <el-input v-model="filters.course_id" placeholder="请输入课程ID" clearable />
        </el-form-item>
        <el-form-item label="是否符合资格">
          <el-select v-model="filters.is_eligible" placeholder="请选择" clearable>
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="人工确认">
          <el-select v-model="filters.manual_confirmation" placeholder="请选择" clearable>
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
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
          <el-button type="success" @click="showCreateDialog">
            <el-icon><Plus /></el-icon>
            新建证书
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table
        :data="tableData"
        v-loading="loading"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column prop="student_id" label="学员ID" width="120" />
        <el-table-column prop="student_name" label="学员姓名" width="120" />
        <el-table-column prop="course_id" label="课程ID" width="120" />
        <el-table-column prop="course_name" label="课程名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="is_eligible" label="是否符合资格" width="130">
          <template #default="{ row }">
            <el-tag :type="row.is_eligible ? 'success' : 'danger'">
              {{ row.is_eligible ? '符合' : '不符合' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="manual_confirmation" label="人工确认" width="120">
          <template #default="{ row }">
            <el-tag :type="row.manual_confirmation ? 'success' : 'info'">
              {{ row.manual_confirmation ? '已确认' : '未确认' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confirmed_by" label="确认人" width="120" />
        <el-table-column prop="certificate_issued" label="是否已颁发" width="130">
          <template #default="{ row }">
            <el-tag :type="row.certificate_issued ? 'success' : 'warning'">
              {{ row.certificate_issued ? '已颁发' : '未颁发' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openConfirmDialog(row)" v-if="!row.manual_confirmation">
              <el-icon><Edit /></el-icon>
              人工确认
            </el-button>
            <el-button link type="success" @click="showIssueDialog(row)" v-if="row.is_eligible && !row.certificate_issued">
              <el-icon><Medal /></el-icon>
              颁发证书
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        class="pagination"
      />
    </el-card>

    <el-dialog
      v-model="createDialogVisible"
      title="新建证书资格"
      width="650px"
    >
      <el-form :model="createForm" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="学员ID" required>
              <el-input v-model="createForm.student_id" placeholder="请输入学员ID" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学员姓名" required>
              <el-input v-model="createForm.student_name" placeholder="请输入学员姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="课程ID" required>
              <el-input v-model="createForm.course_id" placeholder="请输入课程ID" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="课程名称" required>
              <el-input v-model="createForm.course_name" placeholder="请输入课程名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="是否符合资格">
          <el-radio-group v-model="createForm.is_eligible">
            <el-radio :value="true">符合资格</el-radio>
            <el-radio :value="false">不符合资格</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="是否人工确认">
          <el-switch v-model="createForm.manual_confirmation" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-row :gutter="20" v-if="createForm.manual_confirmation">
          <el-col :span="12">
            <el-form-item label="确认人" required>
              <el-input v-model="createForm.confirmed_by" placeholder="请输入确认人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="证书编号">
              <el-input v-model="createForm.certificate_number" placeholder="如：CERT202405001" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="资格判定依据">
          <el-input
            v-model="criteriaText"
            type="textarea"
            :rows="3"
            placeholder="例如：完成进度100%，测验平均分85"
          />
        </el-form-item>
        <el-form-item label="备注说明">
          <el-input
            v-model="createForm.confirmation_notes"
            type="textarea"
            :rows="2"
            placeholder="请输入备注说明（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="confirmDialogVisible"
      title="证书资格人工确认"
      width="600px"
    >
      <div v-if="currentCertificate" class="confirm-content">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="学员ID">{{ currentCertificate.student_id }}</el-descriptions-item>
          <el-descriptions-item label="学员姓名">{{ currentCertificate.student_name }}</el-descriptions-item>
          <el-descriptions-item label="课程ID">{{ currentCertificate.course_id }}</el-descriptions-item>
          <el-descriptions-item label="课程名称">{{ currentCertificate.course_name }}</el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <el-form :model="confirmForm" label-width="120px">
          <el-form-item label="是否符合资格" required>
            <el-radio-group v-model="confirmForm.is_eligible">
              <el-radio :value="true">符合资格</el-radio>
              <el-radio :value="false">不符合资格</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="确认人" required>
            <el-input v-model="confirmForm.confirmed_by" placeholder="请输入确认人姓名" />
          </el-form-item>
          <el-form-item label="确认备注">
            <el-input
              v-model="confirmForm.confirmation_notes"
              type="textarea"
              :rows="4"
              placeholder="请输入确认备注"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitConfirm">提交确认</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="issueDialogVisible"
      title="颁发证书"
      width="500px"
    >
      <div v-if="currentCertificate" class="issue-content">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="学员ID">{{ currentCertificate.student_id }}</el-descriptions-item>
          <el-descriptions-item label="学员姓名">{{ currentCertificate.student_name }}</el-descriptions-item>
          <el-descriptions-item label="课程ID" :span="2">{{ currentCertificate.course_id }}</el-descriptions-item>
          <el-descriptions-item label="课程名称" :span="2">{{ currentCertificate.course_name }}</el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <el-form :model="issueForm" label-width="120px">
          <el-form-item label="证书编号" required>
            <el-input v-model="issueForm.certificate_number" placeholder="请输入证书编号，如：CERT202405001" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="issueDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitIssue">颁发证书</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { certificateApi } from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const createDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const issueDialogVisible = ref(false)
const currentCertificate = ref(null)

const filters = reactive({
  student_id: '',
  course_id: '',
  is_eligible: '',
  manual_confirmation: ''
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const createForm = reactive({
  student_id: '',
  student_name: '',
  course_id: '',
  course_name: '',
  is_eligible: false,
  manual_confirmation: false,
  confirmed_by: '',
  confirmation_notes: '',
  certificate_issued: false,
  certificate_number: ''
})

const criteriaText = ref('')

const confirmForm = reactive({
  eligibility_id: null,
  is_eligible: true,
  confirmed_by: '',
  confirmation_notes: ''
})

const issueForm = reactive({
  eligibility_id: null,
  certificate_number: ''
})

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...filters,
      page: pagination.page,
      page_size: pagination.page_size
    }
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) {
        delete params[key]
      }
    })

    const response = await certificateApi.getList(params)
    if (response.data.success) {
      tableData.value = response.data.data.items
      pagination.total = response.data.data.total
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  Object.assign(filters, {
    student_id: '',
    course_id: '',
    is_eligible: '',
    manual_confirmation: ''
  })
  pagination.page = 1
  loadData()
}

const showCreateDialog = () => {
  Object.assign(createForm, {
    student_id: '',
    student_name: '',
    course_id: '',
    course_name: '',
    is_eligible: false,
    manual_confirmation: false,
    confirmed_by: '',
    confirmation_notes: '',
    certificate_issued: false,
    certificate_number: ''
  })
  criteriaText.value = ''
  createDialogVisible.value = true
}

const submitCreate = async () => {
  if (!createForm.student_id || !createForm.student_name || !createForm.course_id || !createForm.course_name) {
    ElMessage.warning('请填写必填项')
    return
  }

  if (createForm.manual_confirmation && !createForm.confirmed_by) {
    ElMessage.warning('请输入确认人姓名')
    return
  }

  try {
    const eligibility_criteria = criteriaText.value ? { description: criteriaText.value } : null
    const submitData = {
      ...createForm,
      eligibility_criteria,
      certificate_issued: !!createForm.certificate_number
    }

    const response = await certificateApi.create(submitData)
    
    if (response.data.success) {
      ElMessage.success('证书资格创建成功')
      createDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    ElMessage.error('创建失败: ' + (error.response?.data?.detail || error.message || '未知错误'))
  }
}

const openConfirmDialog = (row) => {
  currentCertificate.value = row
  Object.assign(confirmForm, {
    eligibility_id: row.id,
    is_eligible: row.is_eligible,
    confirmed_by: '',
    confirmation_notes: row.confirmation_notes || ''
  })
  confirmDialogVisible.value = true
}

const submitConfirm = async () => {
  if (!confirmForm.confirmed_by) {
    ElMessage.warning('请输入确认人')
    return
  }

  try {
    const response = await certificateApi.confirm(confirmForm)
    if (response.data.success) {
      ElMessage.success('证书资格确认成功')
      confirmDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    ElMessage.error('确认失败')
  }
}

const showIssueDialog = (row) => {
  currentCertificate.value = row
  Object.assign(issueForm, {
    eligibility_id: row.id,
    certificate_number: ''
  })
  issueDialogVisible.value = true
}

const submitIssue = async () => {
  if (!issueForm.certificate_number) {
    ElMessage.warning('请输入证书编号')
    return
  }

  try {
    const response = await certificateApi.issue(issueForm)
    if (response.data.success) {
      ElMessage.success('证书颁发成功')
      issueDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    ElMessage.error('颁发失败')
  }
}

loadData()
</script>

<style scoped>
.certificates-page {
  padding: 0;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
}

.table-card {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.confirm-content,
.issue-content {
  padding: 10px 0;
}
</style>
