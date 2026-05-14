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
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openConfirmDialog(row)">
              <el-icon><Edit /></el-icon>
              人工确认
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
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { certificateApi } from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const confirmDialogVisible = ref(false)
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

const confirmForm = reactive({
  eligibility_id: null,
  is_eligible: true,
  confirmed_by: '',
  confirmation_notes: ''
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

.confirm-content {
  padding: 10px 0;
}
</style>
