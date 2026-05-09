<template>
  <div class="project-list">
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 140px">
            <el-option label="进行中" value="active" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索项目名称、供应商"
            clearable
            style="width: 300px"
            @keyup.enter="loadProjects"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadProjects" :icon="Search">
            搜索
          </el-button>
          <el-button @click="resetSearch" :icon="Refresh">
            重置
          </el-button>
        </el-form-item>
        <el-form-item style="margin-left: auto">
          <el-button type="primary" @click="openCreateDialog" :icon="Plus">
            新建项目
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="stats-card">
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-icon" style="background: #e6f7ff">
              <el-icon :size="28" color="#1890ff"><Folder /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">项目总数</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-icon" style="background: #f6ffed">
              <el-icon :size="28" color="#52c41a"><CircleCheck /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.active }}</div>
              <div class="stat-label">进行中</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-icon" style="background: #fff7e6">
              <el-icon :size="28" color="#fa8c16"><Promotion /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-icon" style="background: #fff1f0">
              <el-icon :size="28" color="#f5222d"><Money /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">¥{{ stats.totalAmount.toLocaleString() }}</div>
              <div class="stat-label">项目总金额</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="table-card">
      <el-table
        :data="projects"
        v-loading="loading"
        style="width: 100%"
        stripe
        empty-text="暂无数据"
      >
        <el-table-column prop="name" label="项目名称" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="goToDetail(row.id)">
              {{ row.name }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="vendor" label="供应商" min-width="150" />
        <el-table-column label="里程碑" width="160" align="center">
          <template #default="{ row }">
            <el-progress
              :percentage="row.milestone_count > 0 ? Math.round((row.completed_milestones / row.milestone_count) * 100) : 0"
              :stroke-width="10"
            />
            <div class="milestone-text">
              {{ row.completed_milestones }}/{{ row.milestone_count }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="项目金额" width="140">
          <template #default="{ row }">
            <span class="amount">¥{{ (row.total_amount || 0).toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始日期" width="120" />
        <el-table-column prop="end_date" label="结束日期" width="120" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">
              详情
            </el-button>
            <el-button type="primary" link @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button type="danger" link @click="confirmDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑项目' : '新建项目'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入项目名称" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="供应商" prop="vendor">
          <el-input v-model="formData.vendor" placeholder="请输入供应商名称" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入项目描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="项目金额">
          <el-input-number
            v-model="formData.total_amount"
            :min="0"
            :precision="2"
            :controls="false"
            style="width: 100%"
            placeholder="请输入项目金额"
          />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="formData.start_date"
            type="date"
            placeholder="选择开始日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker
            v-model="formData.end_date"
            type="date"
            placeholder="选择结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="项目状态" v-if="isEdit">
          <el-select v-model="formData.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="进行中" value="active" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Folder, CircleCheck, Promotion, Money } from '@element-plus/icons-vue'
import { getProjects, createProject, updateProject, deleteProject } from '@/api/projects'

const router = useRouter()

const loading = ref(false)
const projects = ref([])
const dialogVisible = ref(false)
const formRef = ref(null)
const isEdit = ref(false)
const submitting = ref(false)

const searchForm = reactive({
  status: '',
  keyword: ''
})

const stats = computed(() => {
  const list = projects.value || []
  return {
    total: list.length,
    active: list.filter(p => p.status === 'active').length,
    completed: list.filter(p => p.status === 'completed').length,
    totalAmount: list.reduce((sum, p) => sum + (p.total_amount || 0), 0)
  }
})

const formData = reactive({
  id: '',
  name: '',
  vendor: '',
  description: '',
  start_date: '',
  end_date: '',
  total_amount: 0,
  status: 'active'
})

const formRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  vendor: [
    { required: true, message: '请输入供应商名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ]
}

function getStatusType(status) {
  const map = {
    active: 'primary',
    completed: 'success',
    cancelled: 'info'
  }
  return map[status] || 'info'
}

function getStatusText(status) {
  const map = {
    active: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

async function loadProjects() {
  loading.value = true
  try {
    const params = {}
    if (searchForm.status) params.status = searchForm.status
    if (searchForm.keyword) params.keyword = searchForm.keyword
    projects.value = await getProjects(params)
  } catch (error) {
    console.error('加载项目失败:', error)
  } finally {
    loading.value = false
  }
}

function resetSearch() {
  searchForm.status = ''
  searchForm.keyword = ''
  loadProjects()
}

function openCreateDialog() {
  isEdit.value = false
  Object.assign(formData, {
    id: '',
    name: '',
    vendor: '',
    description: '',
    start_date: '',
    end_date: '',
    total_amount: 0,
    status: 'active'
  })
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    vendor: row.vendor,
    description: row.description || '',
    start_date: row.start_date || '',
    end_date: row.end_date || '',
    total_amount: row.total_amount || 0,
    status: row.status || 'active'
  })
  dialogVisible.value = true
}

function validateForm() {
  if (formData.end_date && formData.start_date && formData.end_date < formData.start_date) {
    ElMessage.error('结束日期不能早于开始日期')
    return false
  }
  return true
}

async function submitForm() {
  if (!validateForm()) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    const data = {
      name: formData.name.trim(),
      vendor: formData.vendor.trim(),
      description: formData.description.trim(),
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      total_amount: formData.total_amount || 0,
      status: formData.status
    }
    
    if (isEdit.value) {
      await updateProject(formData.id, data)
      ElMessage.success('项目更新成功')
    } else {
      await createProject(data)
      ElMessage.success('项目创建成功')
    }
    
    dialogVisible.value = false
    loadProjects()
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

function confirmDelete(row) {
  ElMessageBox.confirm(
    `确定要删除项目「${row.name}」吗？删除后所有相关数据将无法恢复。`,
    '删除确认',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await deleteProject(row.id)
      ElMessage.success('删除成功')
      loadProjects()
    } catch (error) {
      console.error('删除失败:', error)
    }
  }).catch(() => {})
}

function goToDetail(id) {
  router.push(`/project/${id}`)
}

onMounted(() => {
  loadProjects()
})

defineExpose({
  loadProjects
})
</script>

<style scoped>
.project-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-card {
  margin-bottom: 8px;
}

.search-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 0;
}

.stats-card {
  margin-bottom: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.table-card {
  flex: 1;
}

.milestone-text {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.amount {
  font-weight: 500;
  color: #f56c6c;
}
</style>