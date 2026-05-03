<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card pending">
          <div class="stat-content">
            <el-icon :size="32"><Clock /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pending }}</div>
              <div class="stat-label">待排作品</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card in-kiln">
          <div class="stat-content">
            <el-icon :size="32"><Box /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.inKiln }}</div>
              <div class="stat-label">已入窑</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card firing">
          <div class="stat-content">
            <el-icon :size="32"><Fire /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.firing }}</div>
              <div class="stat-label">烧成中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card urgent">
          <div class="stat-content">
            <el-icon :size="32"><Warning /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.urgent }}</div>
              <div class="stat-label">交付临近</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="content-row">
      <el-col :span="12">
        <el-card class="card-container">
          <template #header>
            <div class="card-header">
              <span>近期烧窑任务</span>
              <el-button type="primary" link @click="$router.push('/tasks')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentTasks" v-loading="loading.tasks" style="width: 100%">
            <el-table-column prop="name" label="任务名称" />
            <el-table-column prop="kiln_name" label="窑炉" />
            <el-table-column prop="curve_name" label="烧成曲线" />
            <el-table-column prop="artwork_count" label="作品数" width="80" />
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getTaskStatusType(scope.row.status)">
                  {{ getTaskStatusLabel(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="card-container">
          <template #header>
            <div class="card-header">
              <span>交付临近作品</span>
              <el-button type="primary" link @click="$router.push('/artworks')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="urgentArtworks" v-loading="loading.artworks" style="width: 100%">
            <el-table-column prop="name" label="作品名称" />
            <el-table-column prop="customer_name" label="客户" width="100" />
            <el-table-column prop="delivery_date" label="交付日期" width="120">
              <template #default="scope">
                <span :class="getDeliveryDateClass(scope.row.delivery_date)">
                  {{ scope.row.delivery_date }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)">
                  {{ scope.row.status_info?.label || scope.row.status }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="content-row">
      <el-col :span="8">
        <el-card class="card-container">
          <template #header>
            <span>窑炉状态</span>
          </template>
          <div v-loading="loading.kilns">
            <div v-for="kiln in kilns" :key="kiln.id" class="kiln-item">
              <div class="kiln-name">{{ kiln.name }}</div>
              <div class="kiln-info">
                <span>{{ kiln.type }} | {{ kiln.max_temperature }}°C</span>
                <el-tag size="small">{{ kiln.shelf_count }} 层架</el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="card-container">
          <template #header>
            <span>泥料库存</span>
          </template>
          <div v-loading="loading.clays">
            <div v-for="clay in clays" :key="clay.id" class="material-item">
              <div class="material-name">{{ clay.name }}</div>
              <div class="material-info">
                <span>{{ clay.temp_min }}-{{ clay.temp_max }}°C</span>
                <el-tag size="small" type="info">{{ clay.cone }}</el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="card-container">
          <template #header>
            <span>釉料库存</span>
          </template>
          <div v-loading="loading.glazes">
            <div v-for="glaze in glazes" :key="glaze.id" class="material-item">
              <div class="material-name">{{ glaze.name }}</div>
              <div class="material-info">
                <span>{{ glaze.temp_min }}-{{ glaze.temp_max }}°C</span>
                <el-tag size="small" :type="glaze.type === '窑变釉' ? 'warning' : 'info'">
                  {{ glaze.type }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Clock, Box, Fire, Warning } from '@element-plus/icons-vue'
import { artworksApi } from '../api/artworks'
import { firingTasksApi } from '../api/firingTasks'
import { kilnsApi } from '../api/kilns'
import { claysApi, glazesApi } from '../api/materials'

const loading = reactive({
  artworks: false,
  tasks: false,
  kilns: false,
  clays: false,
  glazes: false
})

const stats = reactive({
  pending: 0,
  inKiln: 0,
  firing: 0,
  urgent: 0
})

const recentTasks = ref([])
const urgentArtworks = ref([])
const kilns = ref([])
const clays = ref([])
const glazes = ref([])

const getStatusType = (status) => {
  const types = {
    pending: 'info',
    in_kiln: 'primary',
    firing: 'warning',
    out_kiln: 'success',
    delivered: '',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || ''
}

const getTaskStatusType = (status) => {
  const types = {
    planning: 'info',
    loading: 'primary',
    firing: 'warning',
    cooling: '',
    completed: 'success',
    cancelled: 'info'
  }
  return types[status] || ''
}

const getTaskStatusLabel = (status) => {
  const labels = {
    planning: '计划中',
    loading: '装窑中',
    firing: '烧成中',
    cooling: '冷却中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return labels[status] || status
}

const getDeliveryDateClass = (date) => {
  if (!date) return ''
  const today = new Date()
  const deliveryDate = new Date(date)
  const diff = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'delivery-expired'
  if (diff <= 3) return 'delivery-urgent'
  if (diff <= 7) return 'delivery-soon'
  return ''
}

const loadData = async () => {
  loading.artworks = true
  loading.tasks = true
  loading.kilns = true
  loading.clays = true
  loading.glazes = true

  try {
    const [artworksRes, tasksRes, kilnsRes, claysRes, glazesRes] = await Promise.all([
      artworksApi.getAll(),
      firingTasksApi.getAll(),
      kilnsApi.getAll(),
      claysApi.getAll(),
      glazesApi.getAll()
    ])

    const allArtworks = artworksRes.data
    stats.pending = allArtworks.filter(a => a.status === 'pending').length
    stats.inKiln = allArtworks.filter(a => a.status === 'in_kiln').length
    stats.firing = allArtworks.filter(a => a.status === 'firing').length

    const today = new Date()
    stats.urgent = allArtworks.filter(a => {
      if (!a.delivery_date) return false
      const diff = Math.ceil((new Date(a.delivery_date) - today) / (1000 * 60 * 60 * 24))
      return diff <= 7 && a.status !== 'delivered' && a.status !== 'failed'
    }).length

    urgentArtworks.value = allArtworks
      .filter(a => {
        if (!a.delivery_date) return false
        const diff = Math.ceil((new Date(a.delivery_date) - today) / (1000 * 60 * 60 * 24))
        return diff <= 7 && a.status !== 'delivered' && a.status !== 'failed'
      })
      .sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date))
      .slice(0, 10)

    recentTasks.value = tasksRes.data.slice(0, 5)
    kilns.value = kilnsRes.data
    clays.value = claysRes.data.slice(0, 5)
    glazes.value = glazesRes.data.slice(0, 5)
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.artworks = false
    loading.tasks = false
    loading.kilns = false
    loading.clays = false
    loading.glazes = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.dashboard {
  min-height: 100%;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 8px;
  overflow: hidden;
}

.stat-card :deep(.el-card__body) {
  padding: 20px;
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-content .el-icon {
  margin-right: 16px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-card.pending .stat-value { color: #909399; }
.stat-card.pending .el-icon { color: #909399; }
.stat-card.in-kiln .stat-value { color: #409EFF; }
.stat-card.in-kiln .el-icon { color: #409EFF; }
.stat-card.firing .stat-value { color: #E6A23C; }
.stat-card.firing .el-icon { color: #E6A23C; }
.stat-card.urgent .stat-value { color: #F56C6C; }
.stat-card.urgent .el-icon { color: #F56C6C; }

.content-row {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kiln-item, .material-item {
  padding: 12px 0;
  border-bottom: 1px solid #EBEEF5;
}

.kiln-item:last-child, .material-item:last-child {
  border-bottom: none;
}

.kiln-name, .material-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.kiln-info, .material-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #909399;
}

.delivery-expired { color: #F56C6C; font-weight: 600; }
.delivery-urgent { color: #E6A23C; font-weight: 600; }
.delivery-soon { color: #E6A23C; }
</style>
