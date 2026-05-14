<template>
  <div>
    <a-page-header title="令牌管理" sub-title="访问令牌列表" />
    
    <a-card style="margin-top: 24px">
      <a-form layout="inline" :model="filters">
        <a-form-item label="用户ID">
          <a-input v-model:value="filters.user_id" placeholder="输入用户ID" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="filters.status" placeholder="选择状态" allow-clear>
            <a-select-option value="valid">有效</a-select-option>
            <a-select-option value="revoked">已撤回</a-select-option>
            <a-select-option value="expired">已过期</a-select-option>
            <a-select-option value="invalidated">已失效</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="fetchTokens">
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
      :data-source="tokens"
      :loading="loading"
      :pagination="{ pageSize: 10, total: total }"
      style="margin-top: 16px"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status)">
            {{ getStatusText(record.status) }}
          </a-tag>
        </template>
        <template v-if="column.key === 'token_hash'">
          <span style="font-family: monospace">{{ record.token_hash }}</span>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
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
import axios from 'axios'
import { SearchOutlined } from '@ant-design/icons-vue'

const tokens = ref([])
const loading = ref(false)
const total = ref(0)
const filters = ref({
  user_id: '',
  status: undefined
})

const columns = [
  { title: '令牌哈希', dataIndex: 'token_hash', key: 'token_hash', width: 200 },
  { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 120 },
  { title: '应用名称', dataIndex: 'application_name', key: 'application_name' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '签发时间', dataIndex: 'issued_at', key: 'issued_at', width: 180 },
  { title: '过期时间', dataIndex: 'expires_at', key: 'expires_at', width: 180 },
  { title: '撤回时间', dataIndex: 'revoked_at', key: 'revoked_at', width: 180 },
  { title: '操作', key: 'action', fixed: 'right', width: 100 }
]

const getStatusColor = (status) => {
  const colors = {
    valid: 'green',
    revoked: 'orange',
    expired: 'red',
    invalidated: 'default'
  }
  return colors[status] || 'default'
}

const getStatusText = (status) => {
  const texts = {
    valid: '有效',
    revoked: '已撤回',
    expired: '已过期',
    invalidated: '已失效'
  }
  return texts[status] || status
}

const fetchTokens = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.user_id) params.user_id = filters.value.user_id
    if (filters.value.status) params.status = filters.value.status
    const res = await axios.get('/api/tokens', { params })
    tokens.value = res.data.items
    total.value = res.data.total
  } catch (err) {
    console.error('Failed to fetch tokens:', err)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = { user_id: '', status: undefined }
  fetchTokens()
}

const handleTableChange = () => {
}

const viewDetail = (record) => {
  console.log('View detail:', record)
}

onMounted(() => {
  fetchTokens()
})
</script>
