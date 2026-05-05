<template>
  <div class="page-container">
    <div class="card-container">
      <div class="page-header">
        <h2>线索列表</h2>
        <div class="header-actions">
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建线索
          </el-button>
        </div>
      </div>

      <div class="filter-section">
        <el-form :inline="true" :model="filterForm" class="filter-form">
          <el-form-item label="状态">
            <el-select 
              v-model="filterForm.status" 
              placeholder="全部状态" 
              clearable
              @change="handleFilterChange"
              style="width: 150px"
            >
              <el-option
                v-for="status in leadsStore.metadata.statuses"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="负责人">
            <el-select 
              v-model="filterForm.responsible" 
              placeholder="全部负责人" 
              clearable
              @change="handleFilterChange"
              style="width: 150px"
            >
              <el-option
                v-for="responsible in leadsStore.metadata.responsibles"
                :key="responsible"
                :label="responsible"
                :value="responsible"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table 
        :data="leadsStore.leads" 
        v-loading="leadsStore.loading"
        style="width: 100%"
        stripe
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="学员姓名" width="120">
          <template #default="scope">
            <span style="font-weight: 600">{{ scope.row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="course" label="课程" min-width="180" />
        <el-table-column prop="appointment_time_formatted" label="预约时间" width="180" />
        <el-table-column prop="status_label" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="leadsStore.getStatusType(scope.row.status)" size="small">
              {{ scope.row.status_label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="responsible" label="负责人" width="100" />
        <el-table-column prop="updated_at_formatted" label="最后更新" width="180" />
        <el-table-column label="操作" fixed="right" width="220">
          <template #default="scope">
            <el-button type="primary" link @click="goToDetail(scope.row.id)">
              详情
            </el-button>
            <el-button type="primary" link @click="goToEdit(scope.row.id)">
              编辑
            </el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-section">
        <el-pagination
          v-model:current-page="leadsStore.pagination.page"
          v-model:page-size="leadsStore.pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="leadsStore.pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <el-dialog
      v-model="showCreateDialog"
      title="新建线索"
      width="600px"
      :close-on-click-modal="false"
      @closed="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="100px"
      >
        <el-form-item label="学员姓名" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入学员姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="createForm.phone" placeholder="请输入手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="课程" prop="course">
          <el-select v-model="createForm.course" placeholder="请选择课程" style="width: 100%">
            <el-option
              v-for="course in leadsStore.metadata.courses"
              :key="course"
              :label="course"
              :value="course"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预约时间" prop="appointment_time">
          <el-date-picker
            v-model="createForm.appointment_time"
            type="datetime"
            placeholder="请选择预约时间"
            style="width: 100%"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="createForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option
              v-for="status in leadsStore.metadata.statuses.filter(s => s.value === 'new')"
              :key="status.value"
              :label="status.label"
              :value="status.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人" prop="responsible">
          <el-select v-model="createForm.responsible" placeholder="请选择负责人" style="width: 100%">
            <el-option
              v-for="responsible in leadsStore.metadata.responsibles"
              :key="responsible"
              :label="responsible"
              :value="responsible"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="notes">
          <el-input
            v-model="createForm.notes"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useLeadsStore } from '@/stores/leads'

const router = useRouter()
const leadsStore = useLeadsStore()

const showCreateDialog = ref(false)
const submitting = ref(false)
const createFormRef = ref(null)

const filterForm = reactive({
  status: '',
  responsible: ''
})

const createForm = reactive({
  name: '',
  phone: '',
  course: '',
  appointment_time: '',
  status: 'new',
  responsible: '',
  notes: ''
})

const createRules = {
  name: [
    { required: true, message: '请输入学员姓名', trigger: 'blur' },
    { min: 1, max: 50, message: '姓名长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号', trigger: 'blur' }
  ],
  course: [
    { required: true, message: '请选择课程', trigger: 'change' }
  ],
  appointment_time: [
    { required: true, message: '请选择预约时间', trigger: 'change' }
  ],
  responsible: [
    { required: true, message: '请选择负责人', trigger: 'change' }
  ]
}

const goToDetail = (id) => {
  router.push(`/leads/${id}`)
}

const goToEdit = (id) => {
  router.push(`/leads/${id}/edit`)
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除线索 "${row.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await leadsStore.deleteLead(row.id)
    ElMessage.success('删除成功')
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

const handleFilterChange = () => {
  leadsStore.setFilters({
    status: filterForm.status,
    responsible: filterForm.responsible
  })
}

const handleSearch = () => {
  leadsStore.setFilters({
    status: filterForm.status,
    responsible: filterForm.responsible
  })
  leadsStore.fetchLeads()
}

const handleReset = () => {
  filterForm.status = ''
  filterForm.responsible = ''
  leadsStore.resetFilters()
  leadsStore.fetchLeads()
}

const handlePageChange = (page) => {
  leadsStore.fetchLeads(null, { page })
}

const handlePageSizeChange = (limit) => {
  leadsStore.fetchLeads(null, { page: 1, limit })
}

const resetCreateForm = () => {
  createForm.name = ''
  createForm.phone = ''
  createForm.course = ''
  createForm.appointment_time = ''
  createForm.status = 'new'
  createForm.responsible = ''
  createForm.notes = ''
  createFormRef.value?.resetFields()
}

const handleCreate = async () => {
  if (!createFormRef.value) return
  
  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await leadsStore.createLead({ ...createForm })
        ElMessage.success('创建成功')
        showCreateDialog.value = false
      } catch (err) {
        ElMessage.error(err.message || '创建失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

onMounted(async () => {
  if (leadsStore.metadata.statuses.length === 0) {
    await leadsStore.fetchMetadata()
  }
  await leadsStore.fetchLeads()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-section {
  background: #fafafa;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.filter-form {
  margin: 0;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
