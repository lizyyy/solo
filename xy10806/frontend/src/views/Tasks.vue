<template>
  <div>
    <a-page-header title="任务管理" sub-title="后台任务列表" />
    
    <a-card style="margin-top: 24px">
      <a-form layout="inline" :model="filters">
        <a-form-item label="用户ID">
          <a-input v-model:value="filters.user_id" placeholder="输入用户ID" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="filters.status" placeholder="选择状态" allow-clear>
            <a-select-option value="pending">待执行</a-select-option>
            <a-select-option value="running">执行中</a-select-option>
            <a-select-option value="intercepted">已拦截</a-select-option>
            <a-select-option value="completed">已完成</a-select-option>
            <a-select-option value="failed">失败</a-select-option>
            <a-select-option value="cancelled">已取消</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="fetchTasks">
              <template #icon><SearchOutlined /></template>
              搜索
            </a-button>
            <a-button @click="resetFilters">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-table
      :columns="columns"
      :data-source="tasks"
      :loading="loading"
      :pagination="{ pageSize: 10, total: total }"
      style="margin-top: 16px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status)">
            {{ getStatusText(record.status) }}
          </a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="record.status === 'pending'"
              type="link"
              size="small"
              @click="executeTask(record)"
            >
              执行
            </a-button>
            <a-button type="link" size="small" @click="viewDetail(record)">
              详情
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import axios from 'axios'
import { SearchOutlined } from '@ant-design/icons-vue'

const tasks = ref([])
const loading = ref(false)
const total = ref(0)

const filters = ref({
  user_id: '',
  status: undefined
})

const columns = [
  { title: '任务ID', dataIndex: 'id', key: 'id', width: 120 },
  { title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 120 },
  { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '完成时间', dataIndex: 'completed_at', key: 'completed_at', width: 180 },
  { title: '拦截时间', dataIndex: 'intercepted_at', key: 'intercepted_at', width: 180 },
  { title: '操作', key: 'action', fixed: 'right', width: 150 }
]

const getStatusColor = (status) => {
  const colors = {
    pending: 'blue',
    running: 'orange',
    intercepted: 'red',
    completed: 'green',
    failed: 'red',
    cancelled: 'default'
  }
  return colors[status] || 'default'
}

const getStatusText = (status) => {
  const texts = {
    pending: '待执行',
    running: '执行中',
    intercepted: '已拦截',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const fetchTasks = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.user_id) params.user_id = filters.value.user_id
    if (filters.value.status) params.status = filters.value.status
    const res = await axios.get('/api/tasks', { params })
    tasks.value = res.data.items
    total.value = res.data.total
  } catch (err) {
    message.error('获取任务列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = { user_id: '', status: undefined }
  fetchTasks()
}

const executeTask = async (record) => {
  try {
    const res = await axios.post(`/api/tasks/${record.id}/execute`)
    if (res.data.intercepted) {
      message.warning('任务已被拦截，因关联授权已撤回')
    } else {
      message.success('任务执行成功')
    }
    fetchTasks()
  } catch (err) {
    message.error('任务执行失败')
  }
}

const viewDetail = (record) => {
  console.log('View detail:', record)
}

onMounted(() => {
  fetchTasks()
})
</script>
