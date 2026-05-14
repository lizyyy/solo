<template>
  <div class="migration-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>迁移脚本列表</span>
          <el-button type="primary" @click="$router.push('/create')">
            <el-icon><Plus /></el-icon>
            新建
          </el-button>
        </div>
      </template>

      <el-table :data="migrations" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="database_type" label="数据库类型" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_by" label="创建人" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewDetail(row.id)">
              查看
            </el-button>
            <el-button type="success" size="small" @click="exportData(row.id)">
              导出
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row.id)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useMigrationStore } from '@/stores/migration'

const router = useRouter()
const migrationStore = useMigrationStore()

const migrations = ref([])
const loading = ref(false)

const loadMigrations = async () => {
  loading.value = true
  await migrationStore.fetchMigrations()
  migrations.value = migrationStore.migrations
  loading.value = false
}

const getStatusType = (status) => {
  const statusMap = {
    'draft': 'info',
    'pending_approval': 'warning',
    'approved': 'success',
    'rejected': 'danger',
    'executing': 'primary',
    'success': 'success',
    'failed': 'danger',
    'rolled_back': 'warning'
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status) => {
  const statusMap = {
    'draft': '草稿',
    'pending_approval': '待审批',
    'approved': '已审批',
    'rejected': '已驳回',
    'executing': '执行中',
    'success': '成功',
    'failed': '失败',
    'rolled_back': '已回滚'
  }
  return statusMap[status] || status
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const viewDetail = (id) => {
  router.push(`/detail/${id}`)
}

const exportData = (id) => {
  migrationStore.exportExcel(id)
  ElMessage.success('导出请求已发送')
}

const handleDelete = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个迁移脚本吗？', '确认删除', {
      type: 'warning'
    })
    await migrationStore.deleteMigration(id)
    ElMessage.success('删除成功')
    loadMigrations()
  } catch {
  }
}

onMounted(() => {
  loadMigrations()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>