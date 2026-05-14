<template>
  <div>
    <a-page-header title="撤回记录" sub-title="授权撤回事件列表">
      <template #extra>
        <a-button type="primary" @click="showRevokeModal">
          <template #icon><PlusOutlined /></template>
          发起撤回
        </a-button>
      </template>
    </a-page-header>
    
    <a-card style="margin-top: 24px">
      <a-form layout="inline" :model="filters">
        <a-form-item label="用户ID">
          <a-input v-model:value="filters.user_id" placeholder="输入用户ID" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="filters.status" placeholder="选择状态" allow-clear>
            <a-select-option value="initiated">已发起</a-select-option>
            <a-select-option value="propagating">传播中</a-select-option>
            <a-select-option value="completed">已完成</a-select-option>
            <a-select-option value="failed">失败</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="fetchRevocations">
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
      :data-source="revocations"
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
              v-if="record.status === 'initiated'"
              type="link"
              size="small"
              @click="propagateRevocation(record)"
            >
              执行传播
            </a-button>
            <a-button type="link" size="small" @click="viewDetail(record)">
              详情
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="revokeModalVisible"
      title="发起授权撤回"
      @ok="handleRevoke"
      @cancel="revokeModalVisible = false"
      :confirmLoading="revokeLoading"
    >
      <a-form :model="revokeForm" label-col="{ span: 6 }">
        <a-form-item label="授权ID" required>
          <a-input v-model:value="revokeForm.consent_id" placeholder="请输入授权ID" />
        </a-form-item>
        <a-form-item label="用户ID" required>
          <a-input v-model:value="revokeForm.user_id" placeholder="请输入用户ID" />
        </a-form-item>
        <a-form-item label="撤回原因" required>
          <a-textarea v-model:value="revokeForm.reason" placeholder="请输入撤回原因" :rows="3" />
        </a-form-item>
        <a-form-item label="发起者">
          <a-input v-model:value="revokeForm.initiated_by" placeholder="请输入发起者" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="detailModalVisible"
      title="撤回事件详情"
      :footer="null"
      width="700px"
    >
      <a-descriptions v-if="currentEvent" :column="1" bordered>
        <a-descriptions-item label="事件ID">{{ currentEvent.id }}</a-descriptions-item>
        <a-descriptions-item label="请求ID">{{ currentEvent.request_id }}</a-descriptions-item>
        <a-descriptions-item label="授权ID">{{ currentEvent.consent_id }}</a-descriptions-item>
        <a-descriptions-item label="用户ID">{{ currentEvent.user_id }}</a-descriptions-item>
        <a-descriptions-item label="撤回原因">{{ currentEvent.reason }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="getStatusColor(currentEvent.status)">{{ getStatusText(currentEvent.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="发起者">{{ currentEvent.initiated_by }}</a-descriptions-item>
        <a-descriptions-item label="发起时间">{{ currentEvent.initiated_at }}</a-descriptions-item>
        <a-descriptions-item label="完成时间">{{ currentEvent.completed_at || '-' }}</a-descriptions-item>
        <a-descriptions-item label="撤回令牌数">{{ currentEvent.tokens_revoked }}</a-descriptions-item>
        <a-descriptions-item label="拦截任务数">{{ currentEvent.tasks_intercepted }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import axios from 'axios'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'

const revocations = ref([])
const loading = ref(false)
const total = ref(0)
const revokeModalVisible = ref(false)
const detailModalVisible = ref(false)
const revokeLoading = ref(false)
const currentEvent = ref(null)

const filters = ref({
  user_id: '',
  status: undefined
})

const revokeForm = ref({
  consent_id: '',
  user_id: '',
  reason: '',
  initiated_by: 'admin'
})

const columns = [
  { title: '事件ID', dataIndex: 'id', key: 'id', width: 120 },
  { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 100 },
  { title: '撤回原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '发起者', dataIndex: 'initiated_by', key: 'initiated_by', width: 100 },
  { title: '发起时间', dataIndex: 'initiated_at', key: 'initiated_at', width: 180 },
  { title: '撤回令牌数', dataIndex: 'tokens_revoked', key: 'tokens_revoked', width: 100 },
  { title: '拦截任务数', dataIndex: 'tasks_intercepted', key: 'tasks_intercepted', width: 100 },
  { title: '操作', key: 'action', fixed: 'right', width: 150 }
]

const getStatusColor = (status) => {
  const colors = {
    initiated: 'blue',
    propagating: 'orange',
    completed: 'green',
    failed: 'red'
  }
  return colors[status] || 'default'
}

const getStatusText = (status) => {
  const texts = {
    initiated: '已发起',
    propagating: '传播中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || status
}

const fetchRevocations = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.user_id) params.user_id = filters.value.user_id
    if (filters.value.status) params.status = filters.value.status
    const res = await axios.get('/api/revocations', { params })
    revocations.value = res.data.items
    total.value = res.data.total
  } catch (err) {
    message.error('获取撤回记录失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = { user_id: '', status: undefined }
  fetchRevocations()
}

const showRevokeModal = () => {
  revokeForm.value = {
    consent_id: '',
    user_id: '',
    reason: '',
    initiated_by: 'admin'
  }
  revokeModalVisible.value = true
}

const handleRevoke = async () => {
  if (!revokeForm.value.consent_id || !revokeForm.value.user_id || !revokeForm.value.reason) {
    message.warning('请填写完整信息')
    return
  }

  revokeLoading.value = true
  try {
    const res = await axios.post('/api/revocations', revokeForm.value)
    if (res.data.idempotent) {
      message.info('该撤回已存在，幂等处理')
    } else {
      message.success('撤回发起成功')
    }
    revokeModalVisible.value = false
    fetchRevocations()
  } catch (err) {
    message.error('撤回发起失败')
  } finally {
    revokeLoading.value = false
  }
}

const propagateRevocation = async (record) => {
  try {
    await axios.post(`/api/revocations/${record.id}/propagate`)
    message.success('撤回传播成功')
    fetchRevocations()
  } catch (err) {
    message.error('撤回传播失败')
  }
}

const viewDetail = (record) => {
  currentEvent.value = record
  detailModalVisible.value = true
}

onMounted(() => {
  fetchRevocations()
})
</script>
