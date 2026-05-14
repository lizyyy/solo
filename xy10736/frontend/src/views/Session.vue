<template>
  <div class="session-page">
    <div class="page-header">
      <h2 class="page-title">调试会话</h2>
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>新建会话
      </el-button>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="版本">
          <el-input v-model="filters.version" placeholder="输入版本号" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="选择状态" clearable>
            <el-option label="进行中" value="active" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadSessions">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="sessions" stripe v-loading="loading">
        <el-table-column prop="sessionId" label="会话ID" width="280" />
        <el-table-column prop="version" label="版本" width="140" />
        <el-table-column prop="operator" label="操作人员" width="140" />
        <el-table-column label="事件数" width="100">
          <template #default="{ row }">
            <el-tag type="info">{{ row._count?.pageEvents || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="漏报数" width="100">
          <template #default="{ row }">
            <el-tag type="danger">{{ row._count?.missingDetections || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row.sessionId)">查看详情</el-button>
            <el-button type="success" link @click="completeSession(row.id)" :disabled="row.status !== 'active'">结束会话</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadSessions"
        @current-change="loadSessions"
        class="pagination"
      />
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新建调试会话" width="500">
      <el-form :model="newSession" label-width="100px">
        <el-form-item label="版本号">
          <el-input v-model="newSession.version" placeholder="例如: v2.1.0" />
        </el-form-item>
        <el-form-item label="操作人员">
          <el-input v-model="newSession.operator" placeholder="输入操作人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createSession">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { sessionAPI } from '@/api'

const router = useRouter()
const loading = ref(false)
const sessions = ref([])
const createDialogVisible = ref(false)
const filters = reactive({ version: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const newSession = reactive({ version: '', operator: '' })

const loadSessions = async () => {
  loading.value = true
  try {
    const res = await sessionAPI.getSessions({
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filters
    })
    sessions.value = res.data.data
    pagination.total = res.data.total
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.version = ''
  filters.status = ''
  loadSessions()
}

const showCreateDialog = () => {
  newSession.version = ''
  newSession.operator = ''
  createDialogVisible.value = true
}

const createSession = async () => {
  if (!newSession.version) {
    ElMessage.warning('请输入版本号')
    return
  }
  await sessionAPI.startSession(newSession)
  ElMessage.success('会话创建成功')
  createDialogVisible.value = false
  loadSessions()
}

const completeSession = async (id) => {
  await sessionAPI.completeSession(id)
  ElMessage.success('会话已结束')
  loadSessions()
}

const getStatusType = (status) => {
  const map = { active: 'success', completed: 'info', cancelled: 'warning' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { active: '进行中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

const formatDate = (date) => new Date(date).toLocaleString('zh-CN')

const viewDetail = (id) => router.push(`/session/${id}`)

onMounted(loadSessions)
</script>

<style scoped>
.session-page { padding: 0; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title { font-size: 24px; color: #303133; margin: 0; }
.filter-card { margin-bottom: 24px; border-radius: 12px; }
.filter-form { margin: 0; }
.table-card { border-radius: 12px; }
.pagination { margin-top: 24px; text-align: right; }
</style>
