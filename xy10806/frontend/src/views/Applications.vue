<template>
  <div>
    <a-page-header title="应用管理" sub-title="第三方应用列表" />
    
    <a-table
      :columns="columns"
      :data-source="applications"
      :loading="loading"
      :pagination="{ pageSize: 10 }"
      style="margin-top: 24px"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'is_active'">
          <a-tag :color="record.is_active ? 'green' : 'red'">
            {{ record.is_active ? '启用' : '禁用' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="viewDetail(record)">
              详情
            </a-button>
            <a-button type="link" size="small" @click="viewConsents(record)">
              授权
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="detailModalVisible"
      title="应用详情"
      :footer="null"
      width="600px"
    >
      <a-descriptions v-if="currentApp" :column="1" bordered>
        <a-descriptions-item label="应用ID">{{ currentApp.id }}</a-descriptions-item>
        <a-descriptions-item label="应用名称">{{ currentApp.name }}</a-descriptions-item>
        <a-descriptions-item label="Client ID">{{ currentApp.client_id }}</a-descriptions-item>
        <a-descriptions-item label="描述">{{ currentApp.description }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ currentApp.created_at }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const applications = ref([])
const loading = ref(false)
const detailModalVisible = ref(false)
const currentApp = ref(null)

const columns = [
  { title: '应用名称', dataIndex: 'name', key: 'name' },
  { title: 'Client ID', dataIndex: 'client_id', key: 'client_id' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '状态', dataIndex: 'is_active', key: 'is_active' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'action', fixed: 'right', width: 150 }
]

const fetchApplications = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/applications')
    applications.value = res.data.items
  } catch (err) {
    console.error('Failed to fetch applications:', err)
  } finally {
    loading.value = false
  }
}

const handleTableChange = () => {
}

const viewDetail = (record) => {
  currentApp.value = record
  detailModalVisible.value = true
}

const viewConsents = (record) => {
  router.push({ path: '/consents', query: { application_id: record.id } })
}

onMounted(() => {
  fetchApplications()
})
</script>
