<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon material">
              <el-icon><Box /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.materialCount }}</div>
              <div class="stat-label">原料批次</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon scheme">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.schemeCount }}</div>
              <div class="stat-label">拼配方案</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon tasting">
              <el-icon><Coffee /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.tastingCount }}</div>
              <div class="stat-label">试饮次数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon sale">
              <el-icon><ShoppingCart /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatMoney(stats.totalSales) }}</div>
              <div class="stat-label">总销售额</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card title="转化漏斗">
          <div ref="funnelChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card title="方案评分分布">
          <div ref="ratingChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card title="热门方案TOP5">
          <el-table :data="topSchemes" size="small">
            <el-table-column prop="name" label="方案名称" />
            <el-table-column prop="tasting_count" label="试饮数" width="80" />
            <el-table-column label="平均评分" width="100">
              <template #default="{ row }">
                <el-rate :model-value="row.avg_rating" disabled show-score text-color="#ff9900" />
              </template>
            </el-table-column>
            <el-table-column prop="total_sales_amount" label="销售额" width="120">
              <template #default="{ row }">
                ¥{{ (row.total_sales_amount || 0).toFixed(2) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card title="最近试饮">
          <el-table :data="recentTastings" size="small">
            <el-table-column prop="customer_name" label="客户" width="100" />
            <el-table-column prop="scheme_name" label="方案" />
            <el-table-column prop="tasting_date" label="日期" width="110" />
            <el-table-column label="评分" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.rating" :type="getRatingType(row.rating)" size="small">
                  {{ row.rating }}分
                </el-tag>
                <el-tag v-else type="info" size="small">待评</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { statsApi, tastingApi } from '../api'

const funnelChartRef = ref()
const ratingChartRef = ref()
const stats = ref({
  materialCount: 0,
  schemeCount: 0,
  tastingCount: 0,
  totalSales: 0,
  conversionStats: {} as any
})
const topSchemes = ref([])
const recentTastings = ref([])

const formatMoney = (value: number) => `¥${(value || 0).toFixed(2)}`

const getRatingType = (rating: number) => {
  if (rating >= 4) return 'success'
  if (rating >= 3) return 'warning'
  return 'danger'
}

const loadStats = async () => {
  try {
    const [convRes, perfRes, tasteRes] = await Promise.all([
      statsApi.conversion(),
      statsApi.schemePerformance(),
      tastingApi.list()
    ])
    
    stats.value.conversionStats = convRes.data
    stats.value.tastingCount = convRes.data.total_tastings || 0
    stats.value.schemeCount = convRes.data.product_count || 0
    stats.value.totalSales = convRes.data.total_sales_amount || 0
    
    topSchemes.value = perfRes.data.slice(0, 5)
    recentTastings.value = tasteRes.data.slice(0, 5)
    
    initCharts()
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const initCharts = () => {
  const funnelChart = echarts.init(funnelChartRef.value)
  const funnelData = [
    { name: '试饮', value: stats.value.conversionStats.total_tastings || 0 },
    { name: '反馈', value: stats.value.conversionStats.total_feedbacks || 0 },
    { name: '好评', value: stats.value.conversionStats.good_feedback_count || 0 },
    { name: '购买意愿', value: stats.value.conversionStats.will_buy_count || 0 },
    { name: '实际成交', value: stats.value.conversionStats.actual_sales || 0 }
  ]
  funnelChart.setOption({
    series: [{
      type: 'funnel',
      left: '10%',
      width: '80%',
      label: {
        formatter: '{b}: {c}'
      },
      data: funnelData
    }],
    color: ['#67C23A', '#E6A23C', '#F56C6C', '#409EFF', '#909399']
  })

  const ratingChart = echarts.init(ratingChartRef.value)
  const ratingData = [0, 0, 0, 0, 0]
  topSchemes.value.forEach((s: any) => {
    if (s.avg_rating) {
      const idx = Math.min(Math.floor(s.avg_rating) - 1, 4)
      ratingData[idx]++
    }
  })
  ratingChart.setOption({
    xAxis: {
      type: 'category',
      data: ['1星', '2星', '3星', '4星', '5星']
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      type: 'bar',
      data: ratingData,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#83bff6' },
          { offset: 1, color: '#188df0' }
        ])
      }
    }]
  })
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stat-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
}

.stat-icon.material {
  background: linear-gradient(135deg, #67C23A 0%, #85CE61 100%);
}

.stat-icon.scheme {
  background: linear-gradient(135deg, #409EFF 0%, #66B1FF 100%);
}

.stat-icon.tasting {
  background: linear-gradient(135deg, #E6A23C 0%, #EEBE77 100%);
}

.stat-icon.sale {
  background: linear-gradient(135deg, #F56C6C 0%, #F78989 100%);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #333;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}
</style>
