<template>
  <div class="drill-list-page">
    <el-card class="page-header-card">
      <template #header>
        <div class="card-header">
          <span class="title">演练列表</span>
          <el-button type="primary" @click="$router.push('/create')">
            <el-icon><Plus /></el-icon>
            新建演练
          </el-button>
        </div>
      </template>
      
      <div class="intro-section">
        <el-alert
          title="数据库性能调优演练台"
          type="info"
          :closable="false"
        >
          <template #default>
            <p>本演练台帮助您分析数据库性能瓶颈，包括：</p>
            <ul>
              <li>✅ 慢 SQL 分析与优化建议</li>
              <li>✅ 索引问题检测（缺失/过多）</li>
              <li>✅ 连接池配置分析</li>
              <li>✅ 读写分离路由检测</li>
              <li>✅ 分库分表热点识别</li>
              <li>✅ 批量写入合并建议</li>
            </ul>
          </template>
        </el-alert>
      </div>
    </el-card>

    <el-card v-if="loading" class="list-card">
      <div class="loading-container">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p>加载中...</p>
      </div>
    </el-card>

    <el-card v-else-if="drills.length === 0" class="list-card">
      <el-empty description="暂无演练数据">
        <el-button type="primary" @click="$router.push('/create')">
          创建第一个演练
        </el-button>
      </el-empty>
    </el-card>

    <el-card v-else class="list-card">
      <el-table :data="drills" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="演练名称" width="200">
          <template #default="{ row }">
            <router-link :to="`/drill/${row.id}`" class="drill-name">
              {{ row.name }}
            </router-link>
          </template>
        </el-table-column>
        
        <el-table-column prop="description" label="描述" min-width="250">
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="files" label="文件数" width="100">
          <template #default="{ row }">
            {{ row.files?.length || 0 }} 个
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">
              查看
            </el-button>
            <el-button type="danger" link @click="confirmDelete(row)">
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
import { drillApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const router = useRouter()
const loading = ref(false)
const drills = ref([])

const fetchDrills = async () => {
  loading.value = true
  try {
    const response = await drillApi.list()
    drills.value = response.data
  } catch (error) {
    console.error('获取演练列表失败:', error)
  } finally {
    loading.value = false
  }
}

const goToDetail = (id) => {
  router.push(`/drill/${id}`)
}

const confirmDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除演练 "${row.name}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await drillApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchDrills()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

const getStatusType = (status) => {
  const typeMap = {
    pending: 'info',
    uploaded: 'warning',
    analyzed: 'success',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = {
    pending: '待上传',
    uploaded: '已上传',
    analyzed: '已分析',
    failed: '失败'
  }
  return textMap[status] || status
}

const formatDate = (date) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  fetchDrills()
})
</script>

<style scoped>
.drill-list-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.intro-section {
  margin-top: 10px;
}

.intro-section ul {
  margin: 10px 0 0 20px;
  padding: 0;
}

.intro-section li {
  margin: 4px 0;
}

.list-card {
  border-radius: 8px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  gap: 16px;
  color: #909399;
}

.drill-name {
  color: #409eff;
  text-decoration: none;
  font-weight: 500;
}

.drill-name:hover {
  color: #66b1ff;
  text-decoration: underline;
}
</style>
