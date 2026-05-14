<template>
  <div class="version-page">
    <div class="page-header">
      <h2 class="page-title">版本复核</h2>
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>创建版本
      </el-button>
    </div>

    <el-card class="table-card">
      <el-table :data="versions" stripe>
        <el-table-column prop="version" label="版本号" width="160" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reviewedBy" label="复核人" width="120" />
        <el-table-column prop="reviewReason" label="复核意见" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" type="success" link size="small" @click="handleApprove(row.id)">通过</el-button>
            <el-button v-if="row.status === 'pending'" type="danger" link size="small" @click="handleReject(row.id)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="创建版本" width="500">
      <el-form :model="versionForm" label-width="100px">
        <el-form-item label="版本号" required>
          <el-input v-model="versionForm.version" placeholder="例如: v2.1.0" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="versionForm.description" type="textarea" :rows="3" placeholder="版本描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createVersion">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" title="版本复核" width="500">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="复核人">
          <el-input v-model="reviewForm.reviewer" placeholder="请输入复核人姓名" />
        </el-form-item>
        <el-form-item label="复核意见">
          <el-input v-model="reviewForm.reason" type="textarea" :rows="3" placeholder="请输入复核意见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReview">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { versionAPI } from '@/api'

const versions = ref([])
const createDialogVisible = ref(false)
const reviewDialogVisible = ref(false)
const reviewAction = ref('')
const currentVersionId = ref(null)
const versionForm = reactive({ version: '', description: '' })
const reviewForm = reactive({ reviewer: '', reason: '' })

const loadVersions = async () => {
  const res = await versionAPI.getVersions()
  versions.value = res.data
}

const showCreateDialog = () => {
  versionForm.version = ''
  versionForm.description = ''
  createDialogVisible.value = true
}

const createVersion = async () => {
  if (!versionForm.version) {
    ElMessage.warning('请输入版本号')
    return
  }
  await versionAPI.create(versionForm)
  ElMessage.success('版本创建成功')
  createDialogVisible.value = false
  loadVersions()
}

const handleApprove = (id) => {
  currentVersionId.value = id
  reviewAction.value = 'approve'
  reviewForm.reviewer = ''
  reviewForm.reason = ''
  reviewDialogVisible.value = true
}

const handleReject = (id) => {
  currentVersionId.value = id
  reviewAction.value = 'reject'
  reviewForm.reviewer = ''
  reviewForm.reason = ''
  reviewDialogVisible.value = true
}

const submitReview = async () => {
  if (reviewAction.value === 'approve') {
    await versionAPI.approve(currentVersionId.value, reviewForm)
    ElMessage.success('版本已通过')
  } else {
    await versionAPI.reject(currentVersionId.value, reviewForm)
    ElMessage.success('版本已驳回')
  }
  reviewDialogVisible.value = false
  loadVersions()
}

const getStatusType = (status) => {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待复核', approved: '已通过', rejected: '已驳回' }
  return map[status] || status
}

const formatDate = (date) => new Date(date).toLocaleString('zh-CN')

onMounted(loadVersions)
</script>

<style scoped>
.version-page { padding: 0; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title { font-size: 24px; color: #303133; margin: 0; }
.table-card { border-radius: 12px; }
</style>
