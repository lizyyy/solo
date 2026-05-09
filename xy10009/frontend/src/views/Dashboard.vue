<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #409eff">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalTasks }}</div>
            <div class="stat-label">总盘点任务</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #e6a23c">
            <el-icon><Loading /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.inProgressTasks }}</div>
            <div class="stat-label">进行中任务</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #67c23a">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.completedTasks }}</div>
            <div class="stat-label">已完成任务</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #f56c6c">
            <el-icon><Warning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.unsyncedCount }}</div>
            <div class="stat-label">待同步数据</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近的盘点任务</span>
              <el-button type="primary" size="small" @click="$router.push('/count-tasks')">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="recentTasks" style="width: 100%">
            <el-table-column prop="taskNo" label="任务编号" width="180" />
            <el-table-column prop="name" label="任务名称" />
            <el-table-column prop="Warehouse.name" label="仓库" width="150" />
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)">
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="scope">
                <el-button 
                  type="primary" 
                  size="small" 
                  link
                  @click="goToTask(scope.row.id)"
                >
                  查看
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>系统状态</span>
          </template>
          <div class="status-list">
            <div class="status-item">
              <div class="status-label">网络状态</div>
              <div class="status-value">
                <el-tag :type="isOnline ? 'success' : 'warning'">
                  {{ isOnline ? '已连接' : '已断开' }}
                </el-tag>
              </div>
            </div>
            <div class="status-item">
              <div class="status-label">离线数据</div>
              <div class="status-value">
                {{ offlineData.pendingQueue }} 条待同步
              </div>
            </div>
            <div class="status-item">
              <div class="status-label">本地计数</div>
              <div class="status-value">
                {{ offlineData.localCounts }} 条
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { countTaskApi } from '@/services/api'
import offlineStorage from '@/services/offlineStorage'
import { 
  Document, Loading, CircleCheck, Warning 
} from '@element-plus/icons-vue'

export default {
  name: 'Dashboard',
  components: {
    Document, Loading, CircleCheck, Warning
  },
  setup() {
    const router = useRouter()
    const store = useStore()
    
    const stats = ref({
      totalTasks: 0,
      inProgressTasks: 0,
      completedTasks: 0,
      unsyncedCount: 0
    })
    
    const recentTasks = ref([])
    
    const isOnline = computed(() => store.state.isOnline)
    
    const offlineData = ref({
      pendingQueue: 0,
      localCounts: 0
    })
    
    const loadStats = async () => {
      try {
        const [allResponse, inProgressResponse, completedResponse] = await Promise.all([
          countTaskApi.list({ page: 1, pageSize: 1 }),
          countTaskApi.list({ page: 1, pageSize: 1, status: 'in_progress' }),
          countTaskApi.list({ page: 1, pageSize: 1, status: 'completed' })
        ])
        
        stats.value.totalTasks = allResponse.data.pagination.total
        stats.value.inProgressTasks = inProgressResponse.data.pagination.total
        stats.value.completedTasks = completedResponse.data.pagination.total
      } catch (error) {
        console.error('加载统计数据失败:', error)
      }
    }
    
    const loadRecentTasks = async () => {
      try {
        const response = await countTaskApi.list({ page: 1, pageSize: 5 })
        recentTasks.value = response.data.tasks
      } catch (error) {
        console.error('加载最近任务失败:', error)
      }
    }
    
    const loadOfflineStats = async () => {
      try {
        const [pendingQueue, localCounts] = await Promise.all([
          offlineStorage.getPendingQueue(),
          offlineStorage.getUnsyncedCounts()
        ])
        
        offlineData.value.pendingQueue = pendingQueue.length
        offlineData.value.localCounts = localCounts.length
        stats.value.unsyncedCount = pendingQueue.length + localCounts.length
      } catch (error) {
        console.error('加载离线统计失败:', error)
      }
    }
    
    const getStatusType = (status) => {
      const map = {
        draft: 'info',
        in_progress: 'warning',
        completed: 'success',
        cancelled: 'danger'
      }
      return map[status] || 'info'
    }
    
    const getStatusText = (status) => {
      const map = {
        draft: '草稿',
        in_progress: '进行中',
        completed: '已完成',
        cancelled: '已取消'
      }
      return map[status] || status
    }
    
    const formatDate = (date) => {
      if (!date) return '-'
      const d = new Date(date)
      return d.toLocaleString('zh-CN')
    }
    
    const goToTask = (id) => {
      router.push(`/count-tasks/${id}`)
    }
    
    onMounted(async () => {
      await Promise.all([
        loadStats(),
        loadRecentTasks(),
        loadOfflineStats()
      ])
    })
    
    return {
      stats,
      recentTasks,
      isOnline,
      offlineData,
      getStatusType,
      getStatusText,
      formatDate,
      goToTask
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.stat-card {
  margin-bottom: 20px;
}

.stat-card .el-card__body {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 28px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-list {
  padding: 10px 0;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.status-item:last-child {
  border-bottom: none;
}

.status-label {
  color: #606266;
}

.status-value {
  font-weight: 500;
}
</style>
