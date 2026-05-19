<template>
  <div class="jobs-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>岗位管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增岗位
          </el-button>
        </div>
      </template>

      <el-table :data="jobs" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="岗位名称" min-width="200" />
        <el-table-column prop="department" label="所属部门" width="150" />
        <el-table-column prop="required_experience" label="经验要求" width="120" />
        <el-table-column prop="required_education" label="学历要求" width="120" />
        <el-table-column prop="required_skills" label="所需技能" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="skill in row.required_skills?.slice(0, 3) || []"
              :key="skill"
              size="small"
              style="margin: 2px"
            >
              {{ skill }}
            </el-tag>
            <span v-if="row.required_skills?.length > 3" style="color: #909399">
              +{{ row.required_skills.length - 3 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑岗位' : '新增岗位'"
      width="700px"
    >
      <el-form :model="jobForm" label-width="100px">
        <el-form-item label="岗位名称" required>
          <el-input v-model="jobForm.name" placeholder="请输入岗位名称" />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-input v-model="jobForm.department" placeholder="请输入所属部门" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="经验要求">
              <el-input v-model="jobForm.required_experience" placeholder="如：3-5年" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学历要求">
              <el-select v-model="jobForm.required_education" placeholder="请选择" style="width: 100%">
                <el-option label="大专" value="大专" />
                <el-option label="本科" value="本科" />
                <el-option label="硕士" value="硕士" />
                <el-option label="博士" value="博士" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="所需技能">
          <el-select
            v-model="jobForm.required_skills"
            multiple
            filterable
            allow-create
            default-first-option
            style="width: 100%"
            placeholder="请选择或输入技能"
          >
            <el-option v-for="skill in commonSkills" :key="skill" :label="skill" :value="skill" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位描述">
          <el-input
            v-model="jobForm.description"
            type="textarea"
            :rows="4"
            placeholder="请输入岗位描述"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="jobForm.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const jobs = ref([])
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const commonSkills = ['Python', 'Java', 'JavaScript', 'C++', 'Go', 'Rust', 'SQL', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Linux', 'Git', 'React', 'Vue', 'Angular']

const jobForm = ref({
  name: '',
  department: '',
  required_skills: [],
  required_experience: '',
  required_education: '',
  description: '',
  is_active: true
})

const fetchJobs = async () => {
  loading.value = true
  try {
    const response = await api.getJobs()
    jobs.value = response.data
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  isEdit.value = false
  editId.value = null
  jobForm.value = {
    name: '',
    department: '',
    required_skills: [],
    required_experience: '',
    required_education: '',
    description: '',
    is_active: true
  }
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  isEdit.value = true
  editId.value = row.id
  jobForm.value = {
    name: row.name,
    department: row.department,
    required_skills: row.required_skills || [],
    required_experience: row.required_experience,
    required_education: row.required_education,
    description: row.description,
    is_active: row.is_active
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!jobForm.value.name) {
    ElMessage.warning('请输入岗位名称')
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await api.updateJob(editId.value, jobForm.value)
      ElMessage.success('更新成功')
    } else {
      await api.createJob(jobForm.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await fetchJobs()
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '创建失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该岗位吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await api.deleteJob(id)
    ElMessage.success('删除成功')
    await fetchJobs()
  } catch {
    // 取消删除
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchJobs()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
