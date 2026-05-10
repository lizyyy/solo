<template>
  <div class="stats-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="handleDateChange"
        />
        <el-button type="primary" @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <el-row :gutter="20" class="summary-row">
      <el-col :span="6">
        <el-card class="summary-card" shadow="hover">
          <div class="summary-icon" style="background: #e6f7ff">
            <el-icon size="32" color="#1890ff"><Calendar /></el-icon>
          </div>
          <div class="summary-info">
            <div class="summary-value">{{ stats.total_bookings || 0 }}</div>
            <div class="summary-label">总预约数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card" shadow="hover">
          <div class="summary-icon" style="background: #fff7e6">
            <el-icon size="32" color="#fa8c16"><Crown /></el-icon>
          </div>
          <div class="summary-info">
            <div class="summary-value">{{ stats.private_count || 0 }}</div>
            <div class="summary-label">包场场次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card" shadow="hover">
          <div class="summary-icon" style="background: #f6ffed">
            <el-icon size="32" color="#52c41a"><UserFilled /></el-icon>
          </div>
          <div class="summary-info">
            <div class="summary-value">{{ stats.shared_count || 0 }}</div>
            <div class="summary-label">拼桌场次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="summary-card" shadow="hover">
          <div class="summary-icon" style="background: #fff1f0">
            <el-icon size="32" color="#f5222d"><Money /></el-icon>
          </div>
          <div class="summary-info">
            <div class="summary-value">¥{{ (stats.total_revenue || 0).toFixed(2) }}</div>
            <div class="summary-label">总营收</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <span>关键指标</span>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="平均客单价">
              <el-tag type="primary" size="large">
                ¥{{ (stats.avg_order_value || 0).toFixed(2) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="已收定金">
              <el-tag type="success" size="large">
                ¥{{ (stats.total_deposits || 0).toFixed(2) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="包场占比">
              <el-progress 
                :percentage="privatePercentage" 
                :color="privatePercentage > 50 ? '#f5222d' : '#1890ff'"
              />
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <span>业务类型分布</span>
          </template>
          <div class="pie-chart">
            <div class="chart-item">
              <div class="chart-legend">
                <div class="legend-color" style="background: #f5222d"></div>
                <span>包场</span>
              </div>
              <div class="chart-bar">
                <div 
                  class="bar-fill" 
                  style="background: #f5222d; width: {{ privatePercentage }}%"
                ></div>
              </div>
              <span class="chart-value">{{ stats.private_count || 0 }} 场</span>
            </div>
            <div class="chart-item">
              <div class="chart-legend">
                <div class="legend-color" style="background: #52c41a"></div>
                <span>拼桌</span>
              </div>
              <div class="chart-bar">
                <div 
                  class="bar-fill" 
                  style="background: #52c41a; width: {{ sharedPercentage }}%"
                ></div>
              </div>
              <span class="chart-value">{{ stats.shared_count || 0 }} 场</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="tips-card" shadow="hover">
      <template #header>
        <span>
          <el-icon><InfoFilled /></el-icon>
          幂等性测试指南
        </span>
      </template>
      <el-alert
        title="重复操作路径验证"
        type="info"
        :closable="false"
        show-icon
      >
        <p style="margin-top: 10px">系统支持通过 <strong>idempotency_key（幂等键）</strong> 保证重复操作不会重复计算金额或状态。</p>
        <p style="margin-top: 8px"><strong>测试步骤：</strong></p>
        <ol style="margin-top: 8px; padding-left: 24px">
          <li>新建预约时，在"幂等键"字段输入一个唯一标识（如：<code>test-customer-001</code>）</li>
          <li>点击"确认预约"，预约创建成功</li>
          <li>保持相同的表单数据和幂等键，再次点击"确认预约"</li>
          <li>系统会提示"预约已存在（幂等操作）"，不会创建重复预约</li>
          <li>查看营收统计，金额不会重复计算</li>
        </ol>
        <p style="margin-top: 8px"><strong>候补转正同样支持幂等性保护。</strong></p>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { reservationsApi } from '../api'
import dayjs from 'dayjs'

const dateRange = ref([
  dayjs().startOf('month').format('YYYY-MM-DD'),
  dayjs().endOf('month').format('YYYY-MM-DD')
])

const stats = ref({})

const privatePercentage = computed(() => {
  const total = (stats.value.private_count || 0) + (stats.value.shared_count || 0)
  if (total === 0) return 0
  return Math.round((stats.value.private_count || 0) / total * 100)
})

const sharedPercentage = computed(() => {
  return 100 - privatePercentage.value
})

async function loadStats() {
  if (!dateRange.value || dateRange.value.length < 2) return
  
  const res = await reservationsApi.getRevenueStats(
    dateRange.value[0],
    dateRange.value[1]
  )
  if (res.data.success) {
    stats.value = res.data.data || {}
  }
}

function handleDateChange() {
  loadStats()
}

function handleRefresh() {
  loadStats()
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stats-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 12px;
}

.summary-row {
  margin-bottom: 0;
}

.summary-card {
  border-radius: 12px;
}

.summary-card .el-card__body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.summary-info {
  flex: 1;
}

.summary-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.summary-label {
  font-size: 14px;
  color: #909399;
}

.chart-card {
  border-radius: 12px;
  margin-bottom: 0;
}

.pie-chart {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 0;
}

.chart-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 80px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.chart-bar {
  flex: 1;
  height: 24px;
  background: #f5f7fa;
  border-radius: 12px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 12px;
  transition: width 0.3s ease;
}

.chart-value {
  width: 80px;
  text-align: right;
  font-weight: 600;
}

.tips-card {
  border-radius: 12px;
}

.tips-card .el-card__header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
</style>
