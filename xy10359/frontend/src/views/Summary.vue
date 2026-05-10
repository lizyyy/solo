<template>
  <div class="summary-page">
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilter">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button type="success" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出完整报表
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16" class="overview-row">
      <el-col :span="6">
        <el-card class="stat-card total-card" shadow="never">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ summaryData?.overview?.total || 0 }}</div>
              <div class="stat-label">处方总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card pass-card" shadow="never">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ summaryData?.overview?.passRate || 0 }}%</div>
              <div class="stat-label">通过率</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card time-card" shadow="never">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ summaryData?.overview?.avgReviewTime || 0 }} <span class="unit">分钟</span></div>
              <div class="stat-label">平均复核时间</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card risk-card" shadow="never">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon :size="32"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ summaryData?.overview?.highRiskCount || 0 }}</div>
              <div class="stat-label">高风险处方</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><DataAnalysis /></el-icon>
              <span>处方状态分布</span>
            </div>
          </template>
          <div ref="statusChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><Warning /></el-icon>
              <span>风险类型分布</span>
            </div>
          </template>
          <div ref="riskChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <el-card class="table-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><Clock /></el-icon>
              <span>待办处方</span>
              <el-tag type="warning" size="small">
                共 {{ summaryData?.pendingPrescriptions?.length || 0 }} 张
              </el-tag>
            </div>
          </template>
          <el-table :data="summaryData?.pendingPrescriptions || []" style="width: 100%">
            <el-table-column prop="prescriptionNo" label="处方编号" width="200">
              <template #default="{ row }">
                <el-button type="primary" link @click="viewPrescription(row._id)">
                  {{ row.prescriptionNo }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="patientName" label="患者" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="风险" width="100">
              <template #default="{ row }">
                <el-tag
                  v-if="row.risks?.some(r => r.severity === '高')"
                  type="danger"
                  size="small"
                  effect="dark"
                >
                  高风险
                </el-tag>
                <el-tag
                  v-else-if="row.risks?.some(r => r.severity === '中')"
                  type="warning"
                  size="small"
                >
                  中风险
                </el-tag>
                <el-tag v-else-if="row.risks?.length > 0" type="info" size="small">
                  低风险
                </el-tag>
                <el-tag v-else type="success" size="small">
                  无风险
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="table-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><WarningFilled /></el-icon>
              <span>高风险处方</span>
              <el-tag type="danger" size="small">
                共 {{ summaryData?.highRiskPrescriptions?.length || 0 }} 张
              </el-tag>
            </div>
          </template>
          <el-table :data="summaryData?.highRiskPrescriptions || []" style="width: 100%">
            <el-table-column prop="prescriptionNo" label="处方编号" width="200">
              <template #default="{ row }">
                <el-button type="primary" link @click="viewPrescription(row._id)">
                  {{ row.prescriptionNo }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="patientName" label="患者" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="风险原因" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.risks?.length">
                  {{ row.risks.find(r => r.severity === '高')?.description || '存在高风险' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="24">
        <el-card class="detail-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><DataLine /></el-icon>
              <span>详细统计</span>
            </div>
          </template>
          <el-row :gutter="24">
            <el-col :span="8">
              <div class="detail-section">
                <h4>按状态统计</h4>
                <div class="detail-list">
                  <div class="detail-item">
                    <span class="label">待复核</span>
                    <span class="value">{{ summaryData?.statusSummary?.待复核 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">已通过</span>
                    <span class="value success">{{ summaryData?.statusSummary?.已通过 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">已退回</span>
                    <span class="value danger">{{ summaryData?.statusSummary?.已退回 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">需补充</span>
                    <span class="value warning">{{ summaryData?.statusSummary?.需补充 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">已发药</span>
                    <span class="value primary">{{ summaryData?.statusSummary?.已发药 || 0 }}</span>
                  </div>
                </div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="detail-section">
                <h4>按风险类型统计</h4>
                <div class="detail-list">
                  <div class="detail-item">
                    <span class="label">过敏风险</span>
                    <span class="value danger">{{ summaryData?.riskSummary?.过敏风险 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">重复成分</span>
                    <span class="value warning">{{ summaryData?.riskSummary?.重复成分 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">剂量超限</span>
                    <span class="value danger">{{ summaryData?.riskSummary?.剂量超限 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">其他风险</span>
                    <span class="value">{{ summaryData?.riskSummary?.其他 || 0 }}</span>
                  </div>
                </div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="detail-section">
                <h4>按风险等级统计</h4>
                <div class="detail-list">
                  <div class="detail-item">
                    <span class="label">高风险</span>
                    <span class="value danger">{{ summaryData?.severitySummary?.高 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">中风险</span>
                    <span class="value warning">{{ summaryData?.severitySummary?.中 || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">低风险</span>
                    <span class="value">{{ summaryData?.severitySummary?.低 || 0 }}</span>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { getSummary, exportReport } from '../api'

const router = useRouter()

const summaryData = ref(null)
const statusChartRef = ref(null)
const riskChartRef = ref(null)
const statusChart = ref(null)
const riskChart = ref(null)

const filterForm = reactive({
  dateRange: []
})

const getStatusType = (status) => {
  const map = {
    '待复核': 'warning',
    '已通过': 'success',
    '已退回': 'danger',
    '需补充': 'info',
    '已发药': 'primary'
  }
  return map[status] || 'info'
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const initCharts = () => {
  if (statusChartRef.value) {
    statusChart.value = echarts.init(statusChartRef.value)
  }
  if (riskChartRef.value) {
    riskChart.value = echarts.init(riskChartRef.value)
  }
}

const updateCharts = () => {
  if (!summaryData.value) return

  if (statusChart.value) {
    const statusData = summaryData.value.statusSummary || {}
    const option = {
      tooltip: {
        trigger: 'item'
      },
      legend: {
        bottom: '0',
        left: 'center'
      },
      series: [
        {
          name: '处方状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {c}'
          },
          data: [
            { value: statusData.待复核 || 0, name: '待复核', itemStyle: { color: '#e6a23c' } },
            { value: statusData.已通过 || 0, name: '已通过', itemStyle: { color: '#67c23a' } },
            { value: statusData.已退回 || 0, name: '已退回', itemStyle: { color: '#f56c6c' } },
            { value: statusData.需补充 || 0, name: '需补充', itemStyle: { color: '#909399' } },
            { value: statusData.已发药 || 0, name: '已发药', itemStyle: { color: '#409eff' } }
          ]
        }
      ]
    }
    statusChart.value.setOption(option)
  }

  if (riskChart.value) {
    const riskData = summaryData.value.riskSummary || {}
    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['过敏风险', '重复成分', '剂量超限', '其他']
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '数量',
          type: 'bar',
          barWidth: '50%',
          data: [
            { value: riskData.过敏风险 || 0, itemStyle: { color: '#f56c6c' } },
            { value: riskData.重复成分 || 0, itemStyle: { color: '#e6a23c' } },
            { value: riskData.剂量超限 || 0, itemStyle: { color: '#c00' } },
            { value: riskData.其他 || 0, itemStyle: { color: '#909399' } }
          ]
        }
      ]
    }
    riskChart.value.setOption(option)
  }
}

const loadData = async () => {
  try {
    const params = {}
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }
    const res = await getSummary(params)
    summaryData.value = res.data
    await nextTick()
    updateCharts()
  } catch (error) {
    ElMessage.error('加载汇总数据失败')
  }
}

const resetFilter = () => {
  filterForm.dateRange = []
  loadData()
}

const viewPrescription = (id) => {
  router.push(`/prescriptions/${id}`)
}

const handleExport = async () => {
  try {
    const params = {}
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }

    const res = await exportReport(params)
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `处方复核报表_${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('报表导出成功')
  } catch (error) {
    ElMessage.error('导出报表失败')
  }
}

const handleResize = () => {
  statusChart.value?.resize()
  riskChart.value?.resize()
}

onMounted(async () => {
  await nextTick()
  initCharts()
  loadData()
  window.addEventListener('resize', handleResize)
})

watch(
  () => filterForm.dateRange,
  () => {
    loadData()
  }
)
</script>

<style scoped>
.summary-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  border-radius: 8px;
}

.overview-row {
  margin-bottom: 16px;
}

.stat-card {
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.total-card .stat-icon {
  background: #ecf5ff;
  color: #409eff;
}

.pass-card .stat-icon {
  background: #f0f9eb;
  color: #67c23a;
}

.time-card .stat-icon {
  background: #fdf6ec;
  color: #e6a23c;
}

.risk-card .stat-icon {
  background: #fef0f0;
  color: #f56c6c;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-value .unit {
  font-size: 14px;
  color: #909399;
  font-weight: 400;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.chart-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.chart-container {
  height: 300px;
  width: 100%;
}

.table-card {
  border-radius: 8px;
}

.detail-card {
  border-radius: 8px;
}

.detail-section {
  padding: 8px 0;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.detail-item .label {
  font-size: 14px;
  color: #606266;
}

.detail-item .value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.detail-item .value.success {
  color: #67c23a;
}

.detail-item .value.warning {
  color: #e6a23c;
}

.detail-item .value.danger {
  color: #f56c6c;
}

.detail-item .value.primary {
  color: #409eff;
}
</style>
