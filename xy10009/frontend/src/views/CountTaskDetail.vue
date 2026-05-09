<template>
  <div class="count-task-detail">
    <el-card class="header-card">
      <div class="task-header">
        <div class="task-info">
          <h2>{{ task?.name }}</h2>
          <div class="task-meta">
            <el-tag :type="getStatusType(task?.status)">
              {{ getStatusText(task?.status) }}
            </el-tag>
            <span>任务编号: {{ task?.taskNo }}</span>
            <span>仓库: {{ task?.Warehouse?.name }}</span>
            <span>创建人: {{ task?.creator?.fullName }}</span>
          </div>
        </div>
        <div class="task-actions">
          <el-button @click="goBack">
            返回
          </el-button>
          <el-button
            v-if="task?.status === 'in_progress'"
            type="primary"
            @click="performTask"
          >
            执行盘点
          </el-button>
          <el-button
            v-if="task?.status === 'completed'"
            type="success"
            @click="exportReport"
          >
            导出报告
          </el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>任务信息</span>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="任务编号">
              {{ task?.taskNo }}
            </el-descriptions-item>
            <el-descriptions-item label="任务状态">
              <el-tag :type="getStatusType(task?.status)">
                {{ getStatusText(task?.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="仓库">
              {{ task?.Warehouse?.name }}
            </el-descriptions-item>
            <el-descriptions-item label="创建人">
              {{ task?.creator?.fullName }}
            </el-descriptions-item>
            <el-descriptions-item label="开始时间">
              {{ formatDate(task?.startDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="结束时间">
              {{ formatDate(task?.endDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="备注">
              {{ task?.remark || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="版本号">
              v{{ task?.version }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>盘点统计</span>
          </template>
          <el-row :gutter="20">
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-label">总商品数</div>
                <div class="stat-value">{{ statistics?.total || 0 }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-label">已盘点</div>
                <div class="stat-value">{{ statistics?.counted || 0 }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-label">待盘点</div>
                <div class="stat-value">{{ statistics?.pending || 0 }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-label">有差异</div>
                <div class="stat-value difference">
                  {{ statistics?.withDifference || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-label">盘盈</div>
                <div class="stat-value positive">
                  {{ statistics?.overstock || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-label">盘亏</div>
                <div class="stat-value negative">
                  {{ statistics?.understock || 0 }}
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px" v-loading="loading">
      <template #header>
        <span>盘点明细</span>
      </template>
      <el-table :data="details" style="width: 100%">
        <el-table-column prop="Product.code" label="商品编码" width="130" />
        <el-table-column prop="Product.name" label="商品名称" />
        <el-table-column prop="Product.specification" label="规格" width="120" />
        <el-table-column prop="Product.unit" label="单位" width="60" />
        <el-table-column label="系统数量" width="100">
          <template #default="scope">
            {{ formatNumber(scope.row.systemQuantity) }}
          </template>
        </el-table-column>
        <el-table-column label="盘点数量" width="100">
          <template #default="scope">
            {{ formatNumber(scope.row.countQuantity) }}
          </template>
        </el-table-column>
        <el-table-column label="差异数量" width="100">
          <template #default="scope">
            <span
              :class="{
                'positive': parseFloat(scope.row.differenceQuantity) > 0,
                'negative': parseFloat(scope.row.differenceQuantity) < 0
              }"
            >
              {{ formatNumber(scope.row.differenceQuantity) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getDetailStatusType(scope.row.countStatus)">
              {{ getDetailStatusText(scope.row.countStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="盘点人" width="100">
          <template #default="scope">
            {{ scope.row.counter?.fullName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="盘点时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.countedAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { countTaskApi, reportApi } from '@/services/api'

export default {
  name: 'CountTaskDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    
    const task = ref(null)
    const details = ref([])
    const statistics = ref({
      total: 0,
      pending: 0,
      counted: 0,
      withDifference: 0,
      overstock: 0,
      understock: 0
    })
    const loading = ref(false)
    
    const loadTask = async () => {
      try {
        loading.value = true
        const response = await countTaskApi.get(route.params.id)
        task.value = response.data
        details.value = response.data.CountDetails || []
        
        await loadStatistics()
      } catch (error) {
        console.error('加载任务详情失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    const loadStatistics = async () => {
      try {
        const response = await reportApi.getStatistics(route.params.id)
        statistics.value = response.data.statistics
      } catch (error) {
        console.error('加载统计数据失败:', error)
      }
    }
    
    const goBack = () => {
      router.push('/count-tasks')
    }
    
    const performTask = () => {
      router.push(`/count-tasks/${route.params.id}/perform`)
    }
    
    const exportReport = () => {
      const url = reportApi.exportCountTask(route.params.id)
      window.open(url, '_blank')
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
    
    const getDetailStatusType = (status) => {
      const map = {
        pending: 'info',
        counted: 'success',
        approved: 'success',
        rejected: 'danger'
      }
      return map[status] || 'info'
    }
    
    const getDetailStatusText = (status) => {
      const map = {
        pending: '待盘点',
        counted: '已盘点',
        approved: '已确认',
        rejected: '已拒绝'
      }
      return map[status] || status
    }
    
    const formatDate = (date) => {
      if (!date) return '-'
      return new Date(date).toLocaleString('zh-CN')
    }
    
    const formatNumber = (num) => {
      const n = parseFloat(num)
      if (isNaN(n)) return '0'
      return n.toFixed(2)
    }
    
    onMounted(() => {
      loadTask()
    })
    
    return {
      task,
      details,
      statistics,
      loading,
      goBack,
      performTask,
      exportReport,
      getStatusType,
      getStatusText,
      getDetailStatusType,
      getDetailStatusText,
      formatDate,
      formatNumber
    }
  }
}
</script>

<style scoped>
.count-task-detail {
  padding: 0;
}

.header-card {
  margin-bottom: 20px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-info h2 {
  margin: 0 0 10px 0;
  font-size: 20px;
}

.task-meta {
  display: flex;
  gap: 15px;
  align-items: center;
  font-size: 14px;
  color: #606266;
}

.task-actions {
  display: flex;
  gap: 10px;
}

.stat-item {
  text-align: center;
  padding: 15px 0;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-value.positive {
  color: #67c23a;
}

.stat-value.negative {
  color: #f56c6c;
}

.stat-value.difference {
  color: #e6a23c;
}

.positive {
  color: #67c23a;
  font-weight: bold;
}

.negative {
  color: #f56c6c;
  font-weight: bold;
}
</style>
