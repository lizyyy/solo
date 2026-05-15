<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <h2>生成请求</h2>
      <el-button type="primary" @click="showCreateDialog = true">新建请求</el-button>
    </div>

    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters" size="small">
        <el-form-item label="成员">
          <el-select v-model="filters.member_id" placeholder="全部" clearable @change="fetchData">
            <el-option v-for="m in members" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable @change="fetchData">
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
            <el-option label="已退费" value="refunded" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="requests" style="width: 100%">
        <el-table-column prop="id" label="ID" width="100" show-overflow-tooltip />
        <el-table-column prop="member_id" label="成员ID" width="120" show-overflow-tooltip />
        <el-table-column prop="project_id" label="项目ID" width="120" show-overflow-tooltip />
        <el-table-column prop="quota_consumed" label="消耗额度" width="120" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="viewDetail(row.id)">查看</el-button>
            <el-button v-if="row.status === 'processing'" type="success" size="small" link @click="handleComplete(row.id)">完成</el-button>
            <el-button v-if="row.status === 'processing'" type="danger" size="small" link @click="handleFail(row.id)">失败</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建生成请求" width="500px">
      <el-form :model="newRequest" label-width="100px">
        <el-form-item label="成员">
          <el-select v-model="newRequest.member_id" placeholder="请选择" style="width: 100%">
            <el-option v-for="m in members" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目">
          <el-select v-model="newRequest.project_id" placeholder="请选择" style="width: 100%">
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="消耗额度">
          <el-input-number v-model="newRequest.quota_amount" :min="1" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="幂等Key">
          <el-input v-model="newRequest.idempotency_key" placeholder="用于重复请求检测" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuotaStore } from '../stores/quota'
import { ElMessage } from 'element-plus'

const router = useRouter()
const store = useQuotaStore()

const showCreateDialog = ref(false)
const filters = ref({ member_id: '', status: '' })
const newRequest = ref({ member_id: '', project_id: '', quota_amount: 10, idempotency_key: '' })

const requests = computed(() => store.requests)
const members = computed(() => store.members)
const projects = computed(() => store.projects)

const getStatusType = (status) => {
  const map = { processing: '', completed: 'success', failed: 'danger', refunded: 'warning' }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = { processing: '处理中', completed: '已完成', failed: '失败', refunded: '已退费' }
  return map[status] || status
}

const fetchData = async () => {
  await store.fetchRequests(filters.value)
}

const viewDetail = (id) => {
  router.push(`/requests/${id}`)
}

const handleComplete = async (id) => {
  await store.completeRequest(id)
  ElMessage.success('已标记为完成')
  fetchData()
}

const handleFail = async (id) => {
  await store.failRequest(id, '手动标记失败')
  ElMessage.success('已标记为失败')
  fetchData()
}

const handleCreate = async () => {
  if (!newRequest.value.member_id || !newRequest.value.project_id) {
    ElMessage.warning('请选择成员和项目')
    return
  }
  try {
    await store.createRequest(newRequest.value)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    fetchData()
    store.fetchStats()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '创建失败')
  }
}

onMounted(async () => {
  await store.fetchMembers()
  await store.fetchProjects()
  fetchData()
})
</script>
