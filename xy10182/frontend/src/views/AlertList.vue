<template>
  <div class="alert-list">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card danger">
          <div class="stat-icon">
            <el-icon :size="28"><CircleCloseFilled /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ alertStats?.expired || 0 }}</div>
            <div class="stat-label">已过期</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card warning">
          <div class="stat-icon">
            <el-icon :size="28"><Clock /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ alertStats?.expiring || 0 }}</div>
            <div class="stat-label">即将过期</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card warning">
          <div class="stat-icon">
            <el-icon :size="28"><Minus /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ alertStats?.lowStock || 0 }}</div>
            <div class="stat-label">库存不足</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card primary">
          <div class="stat-icon">
            <el-icon :size="28"><Bell /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ alertStats?.total || 0 }}</div>
            <div class="stat-label">总告警</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top: 16px;">
      <template #header>
        <div class="card-header">
          <span>告警列表</span>
          <el-button @click="refreshData">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column label="级别" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.severity" effect="dark">
              {{ severityMap[scope.row.severity] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="scope">
            <el-tag :type="getTypeTag(scope.row.type)">
              {{ typeMap[scope.row.type] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reagentName" label="试剂名称" min-width="150" />
        <el-table-column prop="reagentCode" label="试剂编码" width="120" />
        <el-table-column prop="batchNo" label="批次号" width="180" />
        <el-table-column prop="message" label="告警信息" min-width="200" />
        <el-table-column label="详情" width="150">
          <template #default="scope">
            <div v-if="scope.row.type === 'expired' || scope.row.type === 'expiring'">
              <span>剩余天数: </span>
              <span :class="{ 'text-danger': scope.row.type === 'expired' }">
                {{ scope.row.daysToExpiry }} 天
              </span>
            </div>
            <div v-else-if="scope.row.type === 'low_stock' || scope.row.type === 'reagent_low_stock'">
              剩余: {{ scope.row.remainingQuantity }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="storageLocation" label="存储位置" width="120" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button
              v-if="scope.row.batchId"
              link
              type="primary"
              @click="goToBatch(scope.row.batchId)"
            >
              查看批次
            </el-button>
            <el-button
              v-else-if="scope.row.reagentId"
              link
              type="primary"
              @click="goToReagent(scope.row.reagentId)"
            >
              查看试剂
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
import { useAppStore } from '../store/app'

const router = useRouter()
const appStore = useAppStore()

const loading = ref(false)
const tableData = ref([])
const alertStats = ref({})

const severityMap = {
  danger: '严重',
  warning: '警告',
  info: '提示'
}

const typeMap = {
  expired: '已过期',
  expiring: '即将过期',
  low_stock: '库存不足',
  reagent_low_stock: '试剂低库存',
  empty: '已空库'
}

function getTypeTag(type) {
  if (type === 'expired' || type === 'empty') return 'danger'
  if (type === 'expiring' || type === 'low_stock' || type === 'reagent_low_stock') return 'warning'
  return 'info'
}

async function fetchData() {
  loading.value = true
  try {
    await appStore.fetchAlerts()
    tableData.value = appStore.alerts
    alertStats.value = appStore.alertStats
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function refreshData() {
  appStore.refreshAll()
  fetchData()
}

function goToBatch(batchId) {
  if (batchId) {
    router.push(`/batches/${batchId}`)
  }
}

function goToReagent(reagentId) {
  if (reagentId) {
    router.push(`/reagents/${reagentId}`)
  }
}

onMounted(() => {
  if (appStore.alerts.length > 0) {
    tableData.value = appStore.alerts
    alertStats.value = appStore.alertStats
  } else {
    fetchData()
  }
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  padding: 20px !important;
}

.stat-card.danger {
  border-left: 4px solid #f56c6c;
}

.stat-card.warning {
  border-left: 4px solid #e6a23c;
}

.stat-card.primary {
  border-left: 4px solid #409EFF;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-card.danger .stat-icon {
  background: #fef0f0;
  color: #f56c6c;
}

.stat-card.warning .stat-icon {
  background: #fdf6ec;
  color: #e6a23c;
}

.stat-card.primary .stat-icon {
  background: #ecf5ff;
  color: #409EFF;
}

.stat-content {
  margin-left: 16px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-danger {
  color: #f56c6c;
  font-weight: 500;
}
</style>
