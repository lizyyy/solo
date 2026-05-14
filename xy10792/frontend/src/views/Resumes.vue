<template>
  <div class="resumes-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>简历列表</span>
          <div>
            <el-select
              v-model="filterStatus"
              placeholder="筛选状态"
              style="width: 150px; margin-right: 10px"
              clearable
              @change="fetchResumes"
            >
              <el-option label="待解析" value="待解析" />
              <el-option label="解析成功" value="解析成功" />
              <el-option label="解析拦截" value="解析拦截" />
              <el-option label="解析补偿" value="解析补偿" />
              <el-option label="待人工复核" value="待人工复核" />
              <el-option label="复核完成" value="复核完成" />
              <el-option label="已导出" value="已导出" />
            </el-select>
            <el-upload
              :show-file-list="false"
              :before-upload="handleUpload"
              accept=".pdf,.doc,.docx,.txt"
            >
              <el-button type="primary">
                <el-icon><Upload /></el-icon>
                上传简历
              </el-button>
            </el-upload>
          </div>
        </div>
      </template>

      <el-table :data="resumes" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="latest_parse_name" label="姓名" width="100" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="matched_job_name" label="匹配岗位" width="150" show-overflow-tooltip />
        <el-table-column prop="match_score" label="匹配度" width="100">
          <template #default="{ row }">
            <el-progress
              :percentage="row.match_score"
              :color="getScoreColor(row.match_score)"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="上传时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="goToDetail(row.id)">查看</el-button>
            <el-button size="small" type="primary" @click="handleParse(row.id)" :disabled="row.status !== '待解析'">解析</el-button>
            <el-button size="small" type="success" @click="handleMatch(row.id)">匹配</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useResumeStore } from '@/store/resume'
import { ElMessage } from 'element-plus'

const router = useRouter()
const resumeStore = useResumeStore()

const resumes = ref([])
const loading = ref(false)
const filterStatus = ref('')

const fetchResumes = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterStatus.value) {
      params.status = filterStatus.value
    }
    resumes.value = await resumeStore.fetchResumes(params)
  } finally {
    loading.value = false
  }
}

const handleUpload = async (file) => {
  try {
    await resumeStore.uploadResume(file)
    ElMessage.success('上传成功')
    await fetchResumes()
  } catch (error) {
    ElMessage.error('上传失败')
  }
  return false
}

const handleParse = async (id) => {
  try {
    await resumeStore.parseResume(id)
    ElMessage.success('解析完成')
    await fetchResumes()
  } catch (error) {
    ElMessage.error('解析失败')
  }
}

const handleMatch = async (id) => {
  try {
    await resumeStore.matchResume(id)
    ElMessage.success('匹配完成')
    await fetchResumes()
  } catch (error) {
    ElMessage.error('匹配失败')
  }
}

const goToDetail = (id) => {
  router.push(`/resumes/${id}`)
}

const getStatusType = (status) => {
  const types = {
    '待解析': 'info',
    '解析成功': 'success',
    '解析拦截': 'warning',
    '解析补偿': 'warning',
    '待人工复核': 'info',
    '复核完成': 'success',
    '已导出': 'success'
  }
  return types[status] || 'info'
}

const getScoreColor = (score) => {
  if (score >= 80) return '#67c23a'
  if (score >= 60) return '#e6a23c'
  return '#f56c6c'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchResumes()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
