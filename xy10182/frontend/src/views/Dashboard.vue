<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background: #e6f7ff;">
            <el-icon :size="32" style="color: #1890ff;"><Box /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ overview?.overview?.totalReagents || 0 }}</div>
            <div class="stat-label">试剂种类</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background: #f6ffed;">
            <el-icon :size="32" style="color: #52c41a;"><ShoppingBag /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ overview?.overview?.totalBatches || 0 }}</div>
            <div class="stat-label">入库批次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background: #fff7e6;">
            <el-icon :size="32" style="color: #fa8c16;"><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ overview?.overview?.totalRecords || 0 }}</div>
            <div class="stat-label">操作记录</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon" style="background: #f9f0ff;">
            <el-icon :size="32" style="color: #722ed1;"><Calendar /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ overview?.overview?.todayRecords || 0 }}</div>
            <div class="stat-label">今日操作</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>库存概况</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="stock-item">
                <div class="stock-label">总库存</div>
                <div class="stock-value">{{ overview?.stock?.totalStock || 0 }}</div>
                <div class="stock-unit">单位</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stock-item">
                <div class="stock-label">已使用</div>
                <div class="stock-value">{{ overview?.stock?.totalUsed || 0 }}</div>
                <div class="stock-unit">单位</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stock-item">
                <div class="stock-label">利用率</div>
                <div class="stock-value">{{ overview?.stock?.utilizationRate || 0 }}%</div>
                <el-progress :percentage="overview?.stock?.utilizationRate || 0" :show-text="false" style="margin-top: 8px;" />
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>预警统计</span>
              <el-button type="primary" link @click="goToAlerts">查看全部</el-button>
            </div>
          </template>
          <div class="alert-stats">
            <el-row :gutter="10">
              <el-col :span="12">
                <div class="alert-stat-item danger">
                  <el-icon><WarningFilled /></el-icon>
                  <span>{{ overview?.alerts?.expired || 0 }} 已过期</span>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="alert-stat-item warning">
                  <el-icon><Clock /></el-icon>
                  <span>{{ overview?.alerts?.expiring || 0 }} 即将过期</span>
                </div>
              </el-col>
              <el-col :span="12" style="margin-top: 10px;">
                <div class="alert-stat-item warning">
                  <el-icon><Minus /></el-icon>
                  <span>{{ overview?.alerts?.lowStock || 0 }} 库存不足</span>
                </div>
              </el-col>
              <el-col :span="12" style="margin-top: 10px;">
                <div class="alert-stat-item danger">
                  <el-icon><CircleCloseFilled /></el-icon>
                  <span>{{ overview?.alerts?.empty || 0 }} 已空库</span>
                </div>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>最近操作</span>
              <el-button type="primary" link @click="goToRecords">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentRecords" style="width: 100%">
            <el-table-column prop="typeLabel" label="操作类型" width="100">
              <template #default="scope">
                <el-tag :type="getTypeTagType(scope.row.type)">{{ scope.row.typeLabel || scope.row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="scanCode" label="扫码标识" width="200" />
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column prop="operator" label="操作员" width="100" />
            <el-table-column prop="location" label="操作地点" width="150" />
            <el-table-column prop="remark" label="备注" show-overflow-tooltip />
            <el-table-column prop="createdAt" label="操作时间" width="180">
              <template #default="scope">
                {{ formatTime(scope.row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../store/app'
import dayjs from 'dayjs'

const router = useRouter()
const appStore = useAppStore()

const overview = computed(() => appStore.overview)
const recentRecords = computed(() => {
  const records = overview.value?.recentRecords || []
  return records.map(r => ({
    ...r,
    typeLabel: getTypeLabel(r.type)
  }))
})

const typeMap = {
  stock_in: '入库',
  open: '开封',
  claim: '领用',
  subpackage: '分装',
  return: '归还',
  discard: '报废'
}

function getTypeLabel(type) {
  return typeMap[type] || type
}

function getTypeTagType(type) {
  const map = {
    stock_in: 'success',
    open: 'info',
    claim: 'primary',
    subpackage: 'warning',
    return: 'info',
    discard: 'danger'
  }
  return map[type] || ''
}

function formatTime(time) {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

function goToAlerts() {
  router.push('/alerts')
}

function goToRecords() {
  router.push('/records')
}

onMounted(() => {
  if (!appStore.overview) {
    appStore.fetchOverview()
  }
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  padding: 20px !important;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
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

.stock-item {
  text-align: center;
  padding: 20px 0;
}

.stock-label {
  font-size: 14px;
  color: #909399;
}

.stock-value {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  margin: 8px 0;
}

.stock-unit {
  font-size: 12px;
  color: #c0c4cc;
}

.alert-stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
}

.alert-stat-item.danger {
  background: #fef0f0;
  color: #f56c6c;
}

.alert-stat-item.warning {
  background: #fdf6ec;
  color: #e6a23c;
}
</style>
