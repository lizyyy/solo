<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card pending">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ dashboardData.summary?.pending || 0 }}</div>
              <div class="stat-label">待确认任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card partial">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><Loading /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ dashboardData.summary?.partial_confirmed || 0 }}</div>
              <div class="stat-label">部分确认</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card confirmed">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><CircleCheckFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ dashboardData.summary?.confirmed || 0 }}</div>
              <div class="stat-label">已完成任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card exception">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><WarningFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ dashboardData.summary?.has_exception || 0 }}</div>
              <div class="stat-label">存在异常</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>各区域任务进度</span>
              <div class="header-actions">
                <el-select v-model="selectedRegion" placeholder="选择区域" clearable style="width: 150px; margin-right: 10px;">
                  <el-option
                    v-for="region in regions"
                    :key="region.id"
                    :label="region.name"
                    :value="region.id"
                  />
                </el-select>
                <el-button type="primary" :icon="Download" @click="exportPriceDifferences">
                  导出价格差异
                </el-button>
              </div>
            </div>
          </template>
          
          <el-table :data="regionStats" border style="width: 100%">
            <el-table-column prop="name" label="区域" width="120" />
            <el-table-column prop="total_tasks" label="总任务数" width="100" align="center" />
            <el-table-column label="任务进度" min-width="300">
              <template #default="scope">
                <div style="display: flex; align-items: center;">
                  <el-progress
                    :percentage="getProgressPercent(scope.row)"
                    :color="getProgressColor(scope.row)"
                    :stroke-width="20"
                  >
                    <template #default="{ percentage }">
                      <span class="progress-text">{{ scope.row.confirmed }}/{{ scope.row.total_tasks }}</span>
                    </template>
                  </el-progress>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态分布" min-width="250">
              <template #default="scope">
                <el-tag v-if="scope.row.pending > 0" type="warning" size="small" style="margin-right: 5px;">
                  待确认 {{ scope.row.pending }}
                </el-tag>
                <el-tag v-if="scope.row.partial_confirmed > 0" type="info" size="small" style="margin-right: 5px;">
                  部分确认 {{ scope.row.partial_confirmed }}
                </el-tag>
                <el-tag v-if="scope.row.has_exception > 0" type="danger" size="small">
                  异常 {{ scope.row.has_exception }}
                </el-tag>
                <span v-if="!scope.row.pending && !scope.row.partial_confirmed && !scope.row.has_exception" style="color: #67c23a;">
                  全部完成
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="scope">
                <el-button 
                  type="primary" 
                  link 
                  size="small"
                  @click="viewRegionTasks(scope.row.id)"
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
            <span>待处理门店</span>
          </template>
          <div v-loading="loading" class="pending-stores">
            <div 
              v-for="task in pendingTasks" 
              :key="task.id" 
              class="pending-item"
              @click="goToTask(task.id)"
            >
              <div class="pending-item-header">
                <span class="store-name">{{ task.store_name }}</span>
                <el-tag :type="getStatusType(task.status)" size="small">
                  {{ getStatusText(task.status) }}
                </el-tag>
              </div>
              <div class="pending-item-info">
                <el-icon><Document /></el-icon>
                <span>{{ task.adjustment_title }}</span>
              </div>
              <div class="pending-item-info">
                <el-icon><Clock /></el-icon>
                <span>生效时间: {{ formatTime(task.effect_time) }}</span>
              </div>
              <div class="pending-item-info">
                <el-icon><Location /></el-icon>
                <span>{{ task.region_name }}</span>
              </div>
              <el-progress
                :percentage="Math.round((task.confirmed_items || 0) / (task.total_items || 1) * 100)"
                :stroke-width="8"
                style="margin-top: 10px;"
              />
            </div>
            <div v-if="pendingTasks.length === 0" class="empty-state">
              <el-empty description="暂无待处理门店" />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>异常概览</span>
        <el-button type="danger" link style="float: right;" @click="goToExceptions">
          查看全部异常
        </el-button>
      </template>
      <el-table :data="openExceptions" border v-loading="loading">
        <el-table-column prop="store_name" label="门店" width="150" />
        <el-table-column prop="product_name" label="商品" width="200">
          <template #default="scope">
            <span v-if="scope.row.product_name">{{ scope.row.product_name }}</span>
            <span v-else style="color: #909399;">全单异常</span>
          </template>
        </el-table-column>
        <el-table-column prop="adjustment_title" label="调价单" min-width="200" />
        <el-table-column label="异常类型" width="120">
          <template #default="scope">
            <el-tag :type="getExceptionTypeTag(scope.row.type)">
              {{ getExceptionTypeText(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
        <el-table-column prop="reporter_name" label="上报人" width="100" />
        <el-table-column prop="created_at" label="上报时间" width="160">
          <template #default="scope">
            {{ formatTime(scope.row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Document, Clock, Location } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { storeTasksAPI, exceptionsAPI, regionsAPI } from '@/api'

const router = useRouter()

const loading = ref(false)
const dashboardData = ref({ summary: {}, byRegion: [] })
const pendingTasks = ref([])
const openExceptions = ref([])
const regions = ref([])
const selectedRegion = ref(null)

const regionStats = computed(() => {
  return dashboardData.value.byRegion || []
})

const loadDashboard = async () => {
  loading.value = true
  try {
    const [dashboard, tasks, exceptions, regionsData] = await Promise.all([
      storeTasksAPI.getDashboardSummary({ regionId: selectedRegion.value }),
      storeTasksAPI.list({ status: 'pending', limit: 10 }),
      exceptionsAPI.list({ status: 'open' }),
      regionsAPI.list()
    ])
    
    dashboardData.value = dashboard
    pendingTasks.value = tasks.slice(0, 5)
    openExceptions.value = exceptions.slice(0, 5)
    regions.value = regionsData
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

const getProgressPercent = (row) => {
  if (!row.total_tasks) return 0
  return Math.round((row.confirmed || 0) / row.total_tasks * 100)
}

const getProgressColor = (row) => {
  if (row.has_exception > 0) return '#f56c6c'
  const percent = getProgressPercent(row)
  if (percent >= 100) return '#67c23a'
  if (percent >= 50) return '#409eff'
  return '#e6a23c'
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    partial_confirmed: 'info',
    confirmed: 'success',
    has_exception: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待确认',
    partial_confirmed: '部分确认',
    confirmed: '已确认',
    has_exception: '有异常'
  }
  return map[status] || status
}

const getExceptionTypeText = (type) => {
  const map = {
    tag_missing: '价签缺失',
    price_mismatch: '价格不符',
    damaged_tag: '价签损坏',
    wrong_location: '位置错误',
    other: '其他'
  }
  return map[type] || type
}

const getExceptionTypeTag = (type) => {
  const map = {
    tag_missing: 'danger',
    price_mismatch: 'warning',
    damaged_tag: 'info',
    wrong_location: '',
    other: 'info'
  }
  return map[type] || ''
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const viewRegionTasks = (regionId) => {
  router.push({ path: '/store-tasks', query: { regionId } })
}

const goToTask = (taskId) => {
  router.push(`/store-tasks/${taskId}`)
}

const goToExceptions = () => {
  router.push('/exceptions')
}

const exportPriceDifferences = async () => {
  try {
    const blob = await storeTasksAPI.exportPriceDifferences({ regionId: selectedRegion.value })
    const url = window.URL.createObjectURL(new Blob([blob]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `price-differences-${dayjs().format('YYYYMMDD')}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

onMounted(() => {
  loadDashboard()
})
</script>

<style scoped>
.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  padding: 10px 0;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
}

.pending .stat-icon {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
}

.partial .stat-icon {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}

.confirmed .stat-icon {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.exception .stat-icon {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  line-height: 1.2;
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

.header-actions {
  display: flex;
  align-items: center;
}

.progress-text {
  font-size: 12px;
  color: #606266;
}

.pending-stores {
  max-height: 500px;
  overflow-y: auto;
}

.pending-item {
  padding: 15px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.pending-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-color: #409eff;
}

.pending-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.store-name {
  font-weight: 500;
  font-size: 15px;
  color: #303133;
}

.pending-item-info {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #606266;
  margin-top: 5px;
}

.pending-item-info .el-icon {
  margin-right: 6px;
}

.empty-state {
  padding: 40px 0;
}
</style>
