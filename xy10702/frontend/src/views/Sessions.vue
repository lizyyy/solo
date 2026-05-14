<template>
  <div class="sessions-page">
    <div class="page-header">
      <h2>会话列表</h2>
      <el-button type="primary" @click="$router.push('/session/new')">
        <el-icon><Plus /></el-icon> 新建会话
      </el-button>
    </div>

    <el-card>
      <el-table :data="sessions" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="state" label="State参数" min-width="200" show-overflow-tooltip />
        <el-table-column prop="client_id" label="Client ID" min-width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status_path" label="路径" width="120">
          <template #default="{ row }">
            <el-tag :type="getPathType(row.status_path)">{{ getPathLabel(row.status_path) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push(`/session/${row.id}`)">
              查看详情
            </el-button>
            <el-button size="small" type="primary" @click="recalculate(row.id)">
              重算状态
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { Plus } from '@element-plus/icons-vue'

const loading = ref(false)
const sessions = ref([])

const loadSessions = async () => {
  loading.value = true
  try {
    const res = await api.getSessions()
    sessions.value = res.data
  } catch (e) {
    ElMessage.error('加载会话列表失败')
  } finally {
    loading.value = false
  }
}

const recalculate = async (id) => {
  try {
    await api.recalculateSession(id)
    ElMessage.success('状态重算成功')
    loadSessions()
  } catch (e) {
    ElMessage.error('重算失败')
  }
}

const getStatusType = (status) => {
  const map = { completed: 'success', failed: 'danger', callback_received: 'warning' }
  return map[status] || 'info'
}

const getPathType = (path) => {
  const map = { success: 'success', blocked: 'danger', compensation: 'warning', review: 'info' }
  return map[path] || 'info'
}

const getPathLabel = (path) => {
  const map = { success: '成功', blocked: '拦截', compensation: '补偿', review: '复核', pending: '待处理' }
  return map[path] || path
}

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadSessions()
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
  color: #303133;
}
</style>
