<template>
  <div class="container">
    <div class="page-header">
      <h2>推送管理</h2>
      <el-button
        v-if="authStore.isOperator"
        type="primary"
        @click="$router.push('/push/create')"
      >
        <el-icon><Plus /></el-icon>
        新建推送
      </el-button>
    </div>
    
    <div class="filter-bar">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="搜索">
          <el-input
            v-model="filterForm.keyword"
            placeholder="搜索标题或内容"
            clearable
            style="width: 200px"
            @keyup.enter="loadMessages"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 130px">
            <el-option label="待处理" value="pending" />
            <el-option label="队列中" value="queued" />
            <el-option label="处理中" value="processing" />
            <el-option label="已发送" value="sent" />
            <el-option label="失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filterForm.pushType" placeholder="全部类型" clearable style="width: 130px">
            <el-option label="广播" value="broadcast" />
            <el-option label="定向" value="targeted" />
            <el-option label="系统" value="system" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadMessages">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <el-card>
      <el-table :data="messages" v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="pushType" label="类型" width="100">
          <template #default="{ row }">
            {{ pushTypeLabels[row.pushType] || row.pushType }}
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.priority > 0 ? 'warning' : row.priority < 0 ? 'info' : ''" size="small">
              {{ row.priority }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :class="`status-tag status-${row.status}`" effect="light">
              {{ statusLabels[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="送达/总数" width="120">
          <template #default="{ row }">
            {{ row.deliveredCount || 0 }} / {{ row.totalRecipients || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" label="重试" width="60">
          <template #default="{ row }">
            {{ row.retryCount }}/{{ row.maxRetries }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="$router.push(`/push/${row._id}`)">
                详情
              </el-button>
              <template v-if="authStore.isOperator">
                <el-button
                  v-if="['pending', 'queued'].includes(row.status)"
                  link
                  type="primary"
                  @click="$router.push(`/push/${row._id}/edit`)"
                >
                  编辑
                </el-button>
                <el-button
                  v-if="['pending', 'queued'].includes(row.status)"
                  link
                  type="warning"
                  @click="handleCancel(row)"
                >
                  取消
                </el-button>
                <el-button
                  v-if="['failed', 'partially_failed'].includes(row.status) && row.retryCount < row.maxRetries"
                  link
                  type="success"
                  @click="handleRetry(row)"
                >
                  重试
                </el-button>
                <el-button
                  link
                  type="danger"
                  @click="handleDelete(row)"
                >
                  删除
                </el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadMessages"
          @current-change="loadMessages"
        />
      </div>
    </el-card>
    
    <el-dialog
      v-model="errorDialogVisible"
      title="错误详情"
      width="500px"
    >
      <el-alert
        :title="currentError"
        type="error"
        show-icon
        :closable="false"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores/auth'
import type { PushMessage } from '@/types'
import {
  listPushMessages,
  cancelPushMessage,
  retryPushMessage,
  deletePushMessage,
} from '@/api/push'

const authStore = useAuthStore()

const loading = ref(false)
const messages = ref<PushMessage[]>([])
const errorDialogVisible = ref(false)
const currentError = ref('')

const filterForm = reactive({
  keyword: '',
  status: '',
  pushType: '',
})

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
})

const statusLabels: Record<string, string> = {
  pending: '待处理',
  queued: '队列中',
  processing: '处理中',
  sent: '已发送',
  failed: '失败',
  partially_failed: '部分失败',
  cancelled: '已取消',
}

const pushTypeLabels: Record<string, string> = {
  broadcast: '广播',
  targeted: '定向',
  system: '系统',
}

function formatDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

async function loadMessages() {
  loading.value = true
  try {
    const result = await listPushMessages({
      page: pagination.page,
      limit: pagination.limit,
      status: filterForm.status || undefined,
      pushType: filterForm.pushType || undefined,
      keyword: filterForm.keyword || undefined,
    })
    messages.value = result.data
    pagination.total = result.pagination.total
  } catch (e) {
    console.error('Failed to load messages:', e)
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filterForm.keyword = ''
  filterForm.status = ''
  filterForm.pushType = ''
  pagination.page = 1
  loadMessages()
}

async function handleCancel(row: PushMessage) {
  try {
    await ElMessageBox.confirm(
      `确定要取消推送 "${row.title}" 吗？`,
      '确认取消',
      { type: 'warning' }
    )
    
    await cancelPushMessage(row._id)
    ElMessage.success('推送已取消')
    loadMessages()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Failed to cancel:', e)
    }
  }
}

async function handleRetry(row: PushMessage) {
  try {
    await ElMessageBox.confirm(
      `确定要重试推送 "${row.title}" 吗？\n这是第 ${row.retryCount + 1}/${row.maxRetries} 次重试`,
      '确认重试',
      { type: 'warning' }
    )
    
    await retryPushMessage(row._id)
    ElMessage.success('重试任务已加入队列')
    loadMessages()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Failed to retry:', e)
    }
  }
}

async function handleDelete(row: PushMessage) {
  try {
    await ElMessageBox.confirm(
      `确定要删除推送 "${row.title}" 吗？此操作不可撤销。`,
      '确认删除',
      { type: 'error' }
    )
    
    await deletePushMessage(row._id)
    ElMessage.success('推送已删除')
    loadMessages()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Failed to delete:', e)
    }
  }
}

onMounted(() => {
  loadMessages()
})
</script>

<style scoped>
.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
