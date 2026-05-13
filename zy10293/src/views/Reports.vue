<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>转化报表</span>
          <div>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="margin-right: 12px"
            />
            <el-button type="primary" @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-card total">
            <div class="stat-icon">
              <el-icon size="40"><Coffee /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total_tastings || 0 }}</div>
              <div class="stat-label">总试饮次数</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card feedback">
            <div class="stat-icon">
              <el-icon size="40"><ChatDotRound /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total_feedbacks || 0 }}</div>
              <div class="stat-label">有效反馈</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card good">
            <div class="stat-icon">
              <el-icon size="40"><Star /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.good_feedback_count || 0 }}</div>
              <div class="stat-label">好评（4-5星）</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card sale">
            <div class="stat-icon">
              <el-icon size="40"><ShoppingCart /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.actual_sales || 0 }}</div>
              <div class="stat-label">实际成交</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="12">
          <el-card title="转化率分析">
            <div class="rate-cards">
              <div class="rate-card">
                <div class="rate-value">{{ feedbackRate.toFixed(1) }}%</div>
                <div class="rate-label">反馈率</div>
                <div class="rate-desc">反馈数 / 试饮数</div>
              </div>
              <div class="rate-card">
                <div class="rate-value">{{ goodFeedbackRate.toFixed(1) }}%</div>
                <div class="rate-label">好评率</div>
                <div class="rate-desc">4-5星 / 总反馈数</div>
              </div>
              <div class="rate-card">
                <div class="rate-value">{{ purchaseIntentRate.toFixed(1) }}%</div>
                <div class="rate-label">购买意愿率</div>
                <div class="rate-desc">愿意购买 / 总反馈</div>
              </div>
              <div class="rate-card highlight">
                <div class="rate-value">{{ conversionRate.toFixed(1) }}%</div>
                <div class="rate-label">实际转化率</div>
                <div class="rate-desc">成交数 / 试饮数</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card title="转化漏斗">
            <div ref="funnelChartRef" style="height: 280px"></div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="24">
          <el-card title="各方案转化对比">
            <el-table :data="schemePerformance" border stripe>
              <el-table-column prop="name" label="方案名称" min-width="180" />
              <el-table-column prop="tasting_count" label="试饮数" width="90" align="center" />
              <el-table-column prop="feedback_count" label="反馈数" width="90" align="center" />
              <el-table-column label="平均评分" width="120">
                <template #default="{ row }">
                  <el-rate v-if="row.avg_rating" :model-value="row.avg_rating" disabled show-score text-color="#ff9900" />
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column prop="good_feedback_count" label="好评数" width="90" align="center" />
              <el-table-column prop="product_count" label="产品数" width="90" align="center" />
              <el-table-column prop="total_sold_quantity" label="销量" width="90" align="center" />
              <el-table-column prop="total_sales_amount" label="销售额" width="120" align="right">
                <template #default="{ row }">
                  <strong>¥{{ (row.total_sales_amount || 0).toFixed(2) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="转化情况" width="120">
                <template #default="{ row }">
                  <div v-if="row.tasting_count > 0">
                    <el-tag :type="getConversionType(row)" size="small">
                      {{ ((row.total_sold_quantity || 0) / row.tasting_count * 100).toFixed(1) }}%
                    </el-tag>
                  </div>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="12">
          <el-card title="评分分布">
            <div ref="ratingChartRef" style="height: 300px"></div>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card title="方案销售排行">
            <div ref="salesChartRef" style="height: 300px"></div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { statsApi } from '../api'

const dateRange = ref<string[]>([])
const stats = ref<any>({})
const schemePerformance = ref<any[]>([])
const funnelChartRef = ref()
const ratingChartRef = ref()
const salesChartRef = ref()

const filters = reactive({
  start_date: '',
  end_date: ''
})

const feedbackRate = computed(() => {
  if (!stats.value.total_tastings) return 0
  return (stats.value.total_feedbacks || 0) / stats.value.total_tastings * 100
})

const goodFeedbackRate = computed(() => {
  if (!stats.value.total_feedbacks) return 0
  return (stats.value.good_feedback_count || 0) / stats.value.total_feedbacks * 100
})

const purchaseIntentRate = computed(() => {
  return (stats.value.purchase_intention_rate || 0) * 100
})

const conversionRate = computed(() => {
  return (stats.value.conversion_rate || 0) * 100
})

const getConversionType = (row: any) => {
  if (row.tasting_count === 0) return 'info'
  const rate = (row.total_sold_quantity || 0) / row.tasting_count
  if (rate >= 0.3) return 'success'
  if (rate >= 0.15) return 'warning'
  return 'danger'
}

const loadData = async () => {
  try {
    if (dateRange.value && dateRange.value.length === 2) {
      filters.start_date = dateRange.value[0]
      filters.end_date = dateRange.value[1]
    }
    
    const [convRes, perfRes] = await Promise.all([
      statsApi.conversion(filters),
      statsApi.schemePerformance()
    ])
    
    stats.value = convRes.data
    schemePerformance.value = perfRes.data
    
    initCharts()
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

const initCharts = () => {
  // 漏斗图
  if (funnelChartRef.value) {
    const funnelChart = echarts.init(funnelChartRef.value)
    const funnelData = [
      { value: stats.value.total_tastings || 0, name: '试饮' },
      { value: stats.value.total_feedbacks || 0, name: '反馈' },
      { value: stats.value.good_feedback_count || 0, name: '好评' },
      { value: stats.value.will_buy_count || 0, name: '购买意愿' },
      { value: stats.value.actual_sales || 0, name: '实际成交' }
    ]
    funnelChart.setOption({
      series: [{
        type: 'funnel',
        left: '10%',
        width: '80%',
        label: {
          formatter: '{b}: {c}',
          fontSize: 12
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2
        },
        data: funnelData
      }],
      color: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']
    })
  }

  // 评分分布
  if (ratingChartRef.value) {
    const ratingChart = echarts.init(ratingChartRef.value)
    const ratingCounts = [0, 0, 0, 0, 0]
    schemePerformance.value.forEach((s: any) => {
      if (s.avg_rating) {
        const idx = Math.min(Math.floor(s.avg_rating) - 1, 4)
        ratingCounts[idx]++
      }
    })
    ratingChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['1星', '2星', '3星', '4星', '5星']
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        type: 'bar',
        data: ratingCounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 1, color: '#188df0' }
          ])
        }
      }]
    })
  }

  // 销售排行
  if (salesChartRef.value) {
    const salesChart = echarts.init(salesChartRef.value)
    const topSchemes = schemePerformance.value
      .filter((s: any) => s.total_sales_amount > 0)
      .sort((a: any, b: any) => b.total_sales_amount - a.total_sales_amount)
      .slice(0, 5)
    
    salesChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: '¥{value}'
        }
      },
      yAxis: {
        type: 'category',
        data: topSchemes.map((s: any) => s.name)
      },
      series: [{
        type: 'bar',
        data: topSchemes.map((s: any) => s.total_sales_amount),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#67C23A' },
            { offset: 1, color: '#85CE61' }
          ])
        },
        label: {
          show: true,
          position: 'right',
          formatter: '¥{c}'
        }
      }]
    })
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-card {
  padding: 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: white;
}

.stat-card.total {
  background: linear-gradient(135deg, #409EFF 0%, #66B1FF 100%);
}

.stat-card.feedback {
  background: linear-gradient(135deg, #67C23A 0%, #85CE61 100%);
}

.stat-card.good {
  background: linear-gradient(135deg, #E6A23C 0%, #EEBE77 100%);
}

.stat-card.sale {
  background: linear-gradient(135deg, #F56C6C 0%, #F78989 100%);
}

.stat-icon {
  opacity: 0.9;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 4px;
}

.rate-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.rate-card {
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  text-align: center;
}

.rate-card.highlight {
  background: linear-gradient(135deg, #67C23A20 0%, #85CE6120 100%);
  border: 1px solid #67C23A40;
}

.rate-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

.rate-card.highlight .rate-value {
  color: #67C23A;
}

.rate-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.rate-desc {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.text-muted {
  color: #909399;
}
</style>
