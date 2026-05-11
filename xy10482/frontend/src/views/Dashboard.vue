<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon icon-green">
            <el-icon size="32"><Box /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.summary?.total_batches || 0 }}</div>
            <div class="stat-label">总批次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon icon-blue">
            <el-icon size="32"><Check /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatNumber(stats.summary?.available_quantity) }}</div>
            <div class="stat-label">可售库存(kg)</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon icon-orange">
            <el-icon size="32"><Warning /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatNumber(stats.summary?.pending_quantity) }}</div>
            <div class="stat-label">待质检(kg)</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon icon-red">
            <el-icon size="32"><CircleClose /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatNumber(stats.summary?.quarantined_quantity) }}</div>
            <div class="stat-label">隔离库存(kg)</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>地块产量统计</span>
              <el-button type="primary" size="small" @click="exportReport">导出报表</el-button>
            </div>
          </template>
          <el-table :data="stats.plots || []" border>
            <el-table-column prop="plot_name" label="地块" width="120"></el-table-column>
            <el-table-column prop="crop_type" label="作物" width="100"></el-table-column>
            <el-table-column prop="task_count" label="采收次数" width="100"></el-table-column>
            <el-table-column prop="total_production" label="总产量(kg)" width="120">
              <template #default="{ row }">{{ formatNumber(row.total_production) }}</template>
            </el-table-column>
            <el-table-column prop="net_production" label="净产量(kg)" width="120">
              <template #default="{ row }">{{ formatNumber(row.net_production) }}</template>
            </el-table-column>
            <el-table-column prop="total_loss" label="损耗(kg)" width="100">
              <template #default="{ row }">{{ formatNumber(row.total_loss) }}</template>
            </el-table-column>
            <el-table-column prop="loss_rate" label="损耗率" width="100">
              <template #default="{ row }">
                <el-tag :type="row.loss_rate > 10 ? 'danger' : row.loss_rate > 5 ? 'warning' : 'success'">
                  {{ row.loss_rate }}%
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="available_stock" label="可售库存" width="120">
              <template #default="{ row }">{{ formatNumber(row.available_stock) }} kg</template>
            </el-table-column>
            <el-table-column prop="quarantined_stock" label="隔离库存" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.quarantined_stock > 0" type="danger">{{ formatNumber(row.quarantined_stock) }} kg</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>等级库存分布</span>
          </template>
          <el-table :data="stats.grades || []" border>
            <el-table-column prop="grade_name" label="等级"></el-table-column>
            <el-table-column prop="code" label="编码" width="80"></el-table-column>
            <el-table-column prop="quantity" label="数量(kg)" width="120">
              <template #default="{ row }">{{ formatNumber(row.quantity) }}</template>
            </el-table-column>
            <el-table-column prop="batch_count" label="批次" width="80"></el-table-column>
          </el-table>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <span>损耗统计</span>
          </template>
          <div class="loss-summary">
            <div class="loss-item">
              <span class="loss-label">总损耗</span>
              <span class="loss-value">{{ formatNumber(stats.summary?.total_loss) }} kg</span>
            </div>
            <div class="loss-item">
              <span class="loss-label">总采收</span>
              <span class="loss-value">{{ formatNumber(stats.summary?.total_harvested) }} kg</span>
            </div>
            <div class="loss-item">
              <span class="loss-label">平均损耗率</span>
              <span class="loss-value">{{ calcAvgLossRate }}%</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>可售库存批次</span>
          </template>
          <el-table :data="availableStock" border max-height="300">
            <el-table-column prop="batch_no" label="批次号" width="180"></el-table-column>
            <el-table-column prop="plot_name" label="地块" width="100"></el-table-column>
            <el-table-column prop="grade_name" label="等级" width="80"></el-table-column>
            <el-table-column prop="quantity" label="数量" width="100">
              <template #default="{ row }">{{ row.quantity }} kg</template>
            </el-table-column>
            <el-table-column prop="manager_name" label="采收人"></el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>隔离库存批次</span>
          </template>
          <el-table :data="quarantinedStock" border max-height="300">
            <el-table-column prop="batch_no" label="批次号" width="180"></el-table-column>
            <el-table-column prop="plot_name" label="地块" width="100"></el-table-column>
            <el-table-column prop="grade_name" label="等级" width="80"></el-table-column>
            <el-table-column prop="quantity" label="数量" width="100">
              <template #default="{ row }">{{ row.quantity }} kg</template>
            </el-table-column>
            <el-table-column prop="defects" label="缺陷"></el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { dashboardApi } from '../api'

const stats = ref({ summary: {}, plots: [], grades: [] })
const availableStock = ref([])
const quarantinedStock = ref([])

const formatNumber = (num) => {
  if (!num) return '0'
  return Number(num).toFixed(2)
}

const calcAvgLossRate = computed(() => {
  const total = stats.value.summary?.total_harvested || 0
  const loss = stats.value.summary?.total_loss || 0
  if (total <= 0) return '0.00'
  return ((loss / total) * 100).toFixed(2)
})

const loadData = async () => {
  try {
    const statsRes = await dashboardApi.getStats()
    if (statsRes.data.success) {
      stats.value = statsRes.data.data
    }

    const availableRes = await dashboardApi.getAvailableStock()
    if (availableRes.data.success) {
      availableStock.value = availableRes.data.data
    }

    const quarantinedRes = await dashboardApi.getQuarantinedStock()
    if (quarantinedRes.data.success) {
      quarantinedStock.value = quarantinedRes.data.data
    }
  } catch (err) {
    console.error('加载数据失败:', err)
  }
}

const exportReport = async () => {
  try {
    const res = await dashboardApi.exportReport()
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', '采收入库报表.xlsx')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('报表导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
    console.error(err)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stats-row {
  margin-bottom: 0;
}

.stat-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.stat-card :deep(.el-card__body) {
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
  margin-right: 16px;
  color: #fff;
}

.icon-green {
  background: #52c41a;
}

.icon-blue {
  background: #1890ff;
}

.icon-orange {
  background: #fa8c16;
}

.icon-red {
  background: #f5222d;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loss-summary {
  padding: 10px 0;
}

.loss-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.loss-item:last-child {
  border-bottom: none;
}

.loss-label {
  color: #666;
}

.loss-value {
  font-weight: 600;
  color: #333;
}
</style>
