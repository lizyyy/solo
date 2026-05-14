<template>
  <div>
    <a-page-header title="审计日志" sub-title="API请求审计日志" />
    
    <a-card style="margin-top: 24px">
      <a-form layout="inline" :model="filters">
        <a-form-item label="请求ID">
          <a-input v-model:value="filters.request_id" placeholder="输入请求ID" />
        </a-form-item>
        <a-form-item label="节点">
          <a-select v-model:value="filters.responsible_node" placeholder="选择节点" allow-clear>
            <a-select-option value="api-gateway">API网关</a-select-option>
            <a-select-option value="revocation-service">撤回服务</a-select-option>
            <a-select-option value="propagation-service">传播服务</a-select-option>
            <a-select-option value="compensation-service">补偿服务</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="fetchLogs">
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
      :data-source="logs"
      :loading="loading"
      :pagination="{ pageSize: 10, total: total }"
      style="margin-top: 16px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status_code'">
          <a-tag :color="record.status_code < 400 ? 'green' : 'red'">
            {{ record.status_code }}
          </a-tag>
        </template>
        <template v-if="column.key === 'result'">
          <a-button type="link" size="small" @click="showResult(record)">
            查看
          </a-button>
        </template>
        <template v-if="column.key === 'error'">
          <span v-if="record.error" style="color: red">{{ record.error }}</span>
          <span v-else>-</span>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="resultModalVisible"
      title="API响应结果"
      :footer="null"
      width="700px"
    >
      <pre style="background: #f5f5f5; padding: 16px; border-radius: 4px; max-height: 500px; overflow: auto;">
{{ currentResult }}
      </pre>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import axios from 'axios'
import { SearchOutlined } from '@ant-design/icons-vue'

const logs = ref([])
const loading = ref(false)
const total = ref(0)
const resultModalVisible = ref(false)
const currentResult = ref('')

const filters = ref({
  request_id: '',
  responsible_node: undefined
})

const columns = [
  { title: '日志ID', dataIndex: 'id', key: 'id', width: 120 },
  { title: '请求ID', dataIndex: 'request_id', key: 'request_id', width: 120 },
  { title: '端点', dataIndex: 'endpoint', key: 'endpoint', width: 200 },
  { title: '方法', dataIndex: 'method', key: 'method', width: 80 },
  { title: '状态码', dataIndex: 'status_code', key: 'status_code', width: 100 },
  { title: '响应结果', key: 'result', width: 80 },
  { title: '错误', dataIndex: 'error', key: 'error', width: 150, ellipsis: true },
  { title: '责任节点', dataIndex: 'responsible_node', key: 'responsible_node', width: 120 },
  { title: '耗时(ms)', dataIndex: 'duration_ms', key: 'duration_ms', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
]

const fetchLogs = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.request_id) params.request_id = filters.value.request_id
    if (filters.value.responsible_node) params.responsible_node = filters.value.responsible_node
    const res = await axios.get('/api/audit-logs', { params })
    logs.value = res.data.items
    total.value = res.data.total
  } catch (err) {
    message.error('获取审计日志失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = { request_id: '', responsible_node: undefined }
  fetchLogs()
}

const showResult = (record) => {
  if (record.result) {
    currentResult.value = JSON.stringify(record.result, null, 2)
  } else {
    currentResult.value = '无响应数据'
  }
  resultModalVisible.value = true
}

onMounted(() => {
  fetchLogs()
})
</script>
