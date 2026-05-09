<template>
  <div class="dashboard-container">
    <el-card class="header-card">
      <div class="card-header">
        <h2>备料看板</h2>
        <div class="header-actions">
          <el-button @click="refreshData" :icon="Refresh">
            刷新
          </el-button>
          <el-button type="primary" @click="exportReport" :icon="Download">
            导出报表
          </el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon orders">
            <el-icon><ShoppingCart /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ planningData.summary.totalOrders }}</div>
            <div class="stat-label">预售订单</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon bouquets">
            <el-icon><Flower /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ planningData.summary.totalBouquets }}</div>
            <div class="stat-label">花束总量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon materials">
            <el-icon><Box /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ materials.length }}</div>
            <div class="stat-label">花材种类</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon warnings" :class="{ 'has-warnings': planningData.warnings.length > 0 }">
            <el-icon><Warning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value" :class="{ 'warning-value': planningData.warnings.length > 0 }">
              {{ planningData.warnings.length }}
            </div>
            <div class="stat-label">预警信息</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="planningData.warnings.length > 0" class="warnings-card">
      <div class="warnings-header">
        <el-icon class="warning-icon"><Warning /></el-icon>
        <span>预警信息</span>
      </div>
      <el-alert
        v-for="(warning, index) in planningData.warnings"
        :key="index"
        :title="warning.message"
        :type="warning.type === 'material_shortage' ? 'error' : 'warning'"
        :closable="false"
        style="margin-bottom: 8px"
      />
    </el-card>

    <el-card class="table-card">
      <div class="table-header">
        <h3>备料需求分析</h3>
        <div class="legend">
          <el-tag type="success">充足</el-tag>
          <el-tag type="warning">待到货</el-tag>
          <el-tag type="danger">缺口</el-tag>
        </div>
      </div>
      <el-table :data="planningData.materialRequirements" stripe style="width: 100%">
        <el-table-column prop="materialName" label="花材名称" width="150">
          <template #default="scope">
            <div class="material-cell">
              <span class="material-name">{{ scope.row.materialName }}</span>
              <el-tag v-if="scope.row.substitute" type="info" size="small">
                可替代
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="materialCategory" label="分类" width="100">
          <template #default="scope">
            <el-tag :type="getCategoryType(scope.row.materialCategory)" size="small">
              {{ scope.row.materialCategory }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="需求分析" width="280">
          <template #default="scope">
            <div class="demand-analysis">
              <div class="demand-row">
                <span class="demand-label">基础需求:</span>
                <span class="demand-value">{{ scope.row.baseQuantity }} {{ scope.row.unit }}</span>
              </div>
              <div class="demand-row">
                <span class="demand-label">损耗预估:</span>
                <span class="demand-value loss">{{ scope.row.lossQuantity }} {{ scope.row.unit }}</span>
              </div>
              <div class="demand-row total">
                <span class="demand-label">总需求:</span>
                <span class="demand-value">{{ scope.row.totalNeeded }} {{ scope.row.unit }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="库存情况" width="200">
          <template #default="scope">
            <div class="inventory-analysis">
              <div class="inv-row">
                <span class="inv-label">现有:</span>
                <span class="inv-value" :class="scope.row.available >= scope.row.totalNeeded ? 'sufficient' : ''">
                  {{ scope.row.available }} {{ scope.row.unit }}
                </span>
              </div>
              <div class="inv-row" v-if="scope.row.pending > 0">
                <span class="inv-label">待到货:</span>
                <span class="inv-value pending">{{ scope.row.pending }} {{ scope.row.unit }}</span>
              </div>
              <div class="inv-row" v-if="scope.row.shortage > 0">
                <span class="inv-label">缺口:</span>
                <span class="inv-value shortage">{{ scope.row.shortage }} {{ scope.row.unit }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="替换方案" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.substitute">
              <div class="substitute-info">
                <span class="substitute-label">替代:</span>
                <span class="substitute-value">
                  {{ getMaterialName(scope.row.substitute.substituteMaterialId) }}
                </span>
              </div>
              <div class="substitute-ratio">
                比例: {{ scope.row.substitute.substituteRatio }}:1
              </div>
              <el-tag type="info" size="small" effect="plain">
                {{ scope.row.substitute.reason }}
              </el-tag>
            </div>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" fixed="right">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="table-card">
      <div class="table-header">
        <h3>库存状态总览</h3>
      </div>
      <el-table :data="planningData.inventoryStatus" stripe style="width: 100%">
        <el-table-column prop="materialName" label="花材名称" width="150" />
        <el-table-column prop="category" label="分类" width="100">
          <template #default="scope">
            <el-tag :type="getCategoryType(scope.row.category)" size="small">
              {{ scope.row.category }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="库存分布" width="300">
          <template #default="scope">
            <el-progress
              :percentage="getInventoryPercentage(scope.row)"
              :status="getProgressStatus(scope.row)"
              :stroke-width="12"
            >
              <template #default="{ percentage }">
                <span class="progress-text">
                  {{ scope.row.available }} / {{ scope.row.total }}
                </span>
              </template>
            </el-progress>
          </template>
        </el-table-column>
        <el-table-column prop="pending" label="待到货" width="100">
          <template #default="scope">
            <span v-if="scope.row.pending > 0" class="pending-text">
              {{ scope.row.pending }} {{ scope.row.unit }}
            </span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="loss" label="已确认损耗" width="100">
          <template #default="scope">
            <span v-if="scope.row.loss > 0" class="loss-text">
              {{ scope.row.loss }} {{ scope.row.unit }}
            </span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  ShoppingCart, Flower, Box, Warning, Refresh, Download 
} from '@element-plus/icons-vue'
import { calculateMaterialPlanning } from '../utils/planning.js'

const props = defineProps({
  materials: {
    type: Array,
    default: () => []
  },
  recipes: {
    type: Array,
    default: () => []
  },
  preorders: {
    type: Array,
    default: () => []
  },
  inventory: {
    type: Array,
    default: () => []
  },
  lossRecords: {
    type: Array,
    default: () => []
  },
  substitutePlans: {
    type: Array,
    default: () => []
  }
})

const planningData = ref({
  summary: {
    totalOrders: 0,
    totalBouquets: 0,
    confirmedOrders: 0,
    pendingOrders: 0
  },
  materialRequirements: [],
  inventoryStatus: [],
  substituteSuggestions: [],
  warnings: []
})

function refreshData() {
  planningData.value = calculateMaterialPlanning(
    props.preorders,
    props.recipes,
    props.materials,
    props.inventory,
    props.lossRecords,
    props.substitutePlans
  )
  ElMessage.success('数据已刷新')
}

function getMaterialName(materialId) {
  const mat = props.materials.find(m => m.id === materialId)
  return mat ? mat.name : '未知花材'
}

function getCategoryType(category) {
  const types = {
    '主花': 'danger',
    '配花': 'success',
    '叶材': 'info'
  }
  return types[category] || ''
}

function getStatusType(status) {
  const types = {
    sufficient: 'success',
    pending: 'warning',
    shortage: 'danger'
  }
  return types[status] || 'info'
}

function getStatusText(status) {
  const texts = {
    sufficient: '充足',
    pending: '待到货',
    shortage: '缺口'
  }
  return texts[status] || status
}

function getInventoryPercentage(row) {
  if (row.total === 0) return 0
  return Math.round((row.available / row.total) * 100)
}

function getProgressStatus(row) {
  const percentage = getInventoryPercentage(row)
  if (percentage >= 70) return 'success'
  if (percentage >= 30) return ''
  return 'exception'
}

function exportReport() {
  try {
    const XLSX = require('xlsx')
    const wb = XLSX.utils.book_new()
    
    const summaryData = [
      ['统计指标', '数值'],
      ['预售订单数', planningData.value.summary.totalOrders],
      ['花束总量', planningData.value.summary.totalBouquets],
      ['已确认订单', planningData.value.summary.confirmedOrders],
      ['待确认订单', planningData.value.summary.pendingOrders],
      ['预警信息数', planningData.value.warnings.length]
    ]
    const ws0 = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, ws0, '统计概览')
    
    if (planningData.value.materialRequirements.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(planningData.value.materialRequirements.map(item => ({
        '花材名称': item.materialName,
        '分类': item.materialCategory,
        '单位': item.unit,
        '基础需求': item.baseQuantity,
        '损耗预估': item.lossQuantity,
        '总需求': item.totalNeeded,
        '现有库存': item.available,
        '待到货': item.pending,
        '缺口': item.shortage,
        '状态': item.status === 'sufficient' ? '充足' : item.status === 'pending' ? '待到货' : '缺口',
        '替换花材': item.substitute ? getMaterialName(item.substitute.substituteMaterialId) : '',
        '替换比例': item.substitute ? item.substitute.substituteRatio + ':1' : ''
      })))
      XLSX.utils.book_append_sheet(wb, ws1, '备料需求')
    }

    if (planningData.value.inventoryStatus.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(planningData.value.inventoryStatus.map(item => ({
        '花材名称': item.materialName,
        '分类': item.category,
        '单位': item.unit,
        '现有库存': item.available,
        '待到货': item.pending,
        '已确认损耗': item.loss,
        '总计': item.total
      })))
      XLSX.utils.book_append_sheet(wb, ws2, '库存状态')
    }

    if (planningData.value.warnings.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(planningData.value.warnings.map(item => ({
        '类型': item.type,
        '消息': item.message
      })))
      XLSX.utils.book_append_sheet(wb, ws3, '预警信息')
    }

    const dateStr = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `花店备料报表_${dateStr}.xlsx`)
    ElMessage.success('报表导出成功')
  } catch (e) {
    console.error('导出失败:', e)
    ElMessage.error('导出失败，请稍后重试')
  }
}

watch(
  () => [props.preorders, props.recipes, props.materials, props.inventory, props.lossRecords, props.substitutePlans],
  () => {
    refreshData()
  },
  { deep: true }
)

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-card h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
  margin-right: 16px;
}

.stat-icon.orders {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.bouquets {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.materials {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.warnings {
  background: linear-gradient(135deg, #c3cfe2 0%, #c3cfe2 100%);
}

.stat-icon.warnings.has-warnings {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-value.warning-value {
  color: #f56c6c;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.warnings-card {
  background-color: #fdf6ec;
}

.warnings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: bold;
  color: #e6a23c;
}

.warning-icon {
  font-size: 20px;
}

.table-card {
  flex: 1;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.legend {
  display: flex;
  gap: 8px;
}

.material-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.material-name {
  font-weight: 500;
}

.demand-analysis {
  font-size: 13px;
}

.demand-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.demand-row.total {
  border-top: 1px solid #ebeef5;
  padding-top: 4px;
  margin-top: 4px;
}

.demand-label {
  color: #909399;
}

.demand-value {
  font-weight: 500;
}

.demand-value.loss {
  color: #f56c6c;
}

.inventory-analysis {
  font-size: 13px;
}

.inv-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.inv-label {
  color: #909399;
}

.inv-value.sufficient {
  color: #67c23a;
}

.inv-value.pending {
  color: #e6a23c;
}

.inv-value.shortage {
  color: #f56c6c;
  font-weight: bold;
}

.substitute-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.substitute-label {
  color: #909399;
  font-size: 13px;
}

.substitute-value {
  font-weight: 500;
  color: #409eff;
}

.substitute-ratio {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.pending-text {
  color: #e6a23c;
}

.loss-text {
  color: #f56c6c;
}

.progress-text {
  font-size: 12px;
  color: #606266;
}
</style>