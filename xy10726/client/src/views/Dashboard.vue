<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon blue">
              <el-icon size="28"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.todayStats?.today_count || 0 }}</div>
              <div class="stat-label">今日上传</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon orange">
              <el-icon size="28"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ getStatusCount('review_pending') }}</div>
              <div class="stat-label">待审核</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon green">
              <el-icon size="28"><Check /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ formatAmount(statistics.todayStats?.today_amount || 0) }}</div>
              <div class="stat-label">今日导出金额</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon red">
              <el-icon size="28"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ getStatusCount('ocr_failed') + getStatusCount('duplicate_found') }}</div>
              <div class="stat-label">异常票据</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="14">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>30日趋势</span>
            </div>
          </template>
          <v-chart :option="trendChartOption" class="trend-chart" autoresize />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card class="chart-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>状态分布</span>
            </div>
          </template>
          <v-chart :option="statusChartOption" class="pie-chart" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="action-row">
      <el-col :span="24">
        <el-card class="action-card" shadow="hover">
          <div class="action-bar">
            <el-button type="primary" size="large" @click="showUpload = true">
              <el-icon><Upload /></el-icon>
              上传发票
            </el-button>
            <el-button type="success" size="large" @click="handleExport">
              <el-icon><Download /></el-icon>
              财务导出
            </el-button>
            <el-button size="large" @click="loadData">
              <el-icon><Refresh /></el-icon>
              刷新数据
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="table-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>发票列表</span>
              <el-select v-model="filterStatus" placeholder="筛选状态" style="width: 150px" @change="loadInvoices">
                <el-option label="全部" value="" />
                <el-option label="待审核" value="review_pending" />
                <el-option label="待导出" value="export_ready" />
                <el-option label="已导出" value="exported" />
                <el-option label="OCR失败" value="ocr_failed" />
                <el-option label="重复票据" value="duplicate_found" />
              </el-select>
            </div>
          </template>
          <el-table :data="invoices" stripe style="width: 100%" v-loading="loading">
            <el-table-column prop="invoice_number" label="发票号码" width="130" />
            <el-table-column prop="invoice_code" label="发票代码" width="130" />
            <el-table-column prop="amount" label="金额" width="100">
              <template #default="{ row }">
                <span class="amount">¥{{ formatAmount(row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="seller_name" label="销售方" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="confidence" label="置信度" width="100">
              <template #default="{ row }">
                <el-progress 
                  :percentage="Math.round((row.confidence || 0) * 100)" 
                  :stroke-width="8"
                  :color="getConfidenceColor(row.confidence)"
                />
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="160" />
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="viewDetail(row)">查看</el-button>
                <el-button 
                  v-if="row.status === 'ocr_failed' && row.retry_count < row.max_retries" 
                  link type="warning" size="small" 
                  @click="retryOCR(row)"
                >
                  重试({{ row.retry_count }}/{{ row.max_retries }})
                </el-button>
                <el-button 
                  v-if="row.status === 'review_pending'" 
                  link type="success" size="small" 
                  @click="openReview(row)"
                >
                  审核
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination 
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.limit"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="loadInvoices"
            @size-change="loadInvoices"
            class="pagination"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showUpload" title="上传发票" width="500px">
      <el-upload
        class="upload-demo"
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
        accept="image/*"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 jpg/png 图片格式</div>
        </template>
      </el-upload>
      <div v-if="uploadFile" class="file-preview">
        <img :src="uploadUrl" style="max-width: 100%; max-height: 200px; object-fit: contain" />
        <p>{{ uploadFile.name }}</p>
      </div>
      <template #footer>
        <el-button @click="showUpload = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="confirmUpload">确认上传</el-button>
      </template>
    </el-dialog>

    <InvoiceDetail 
      v-model:visible="showDetail" 
      :invoice="selectedInvoice"
      @updated="loadData"
    />

    <ReviewDrawer 
      v-model:visible="showReview" 
      :invoice="reviewInvoice"
      @reviewed="loadData"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, LineChart } from 'echarts/charts'
import { 
  TitleComponent, TooltipComponent, LegendComponent, 
  GridComponent 
} from 'echarts/components'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  getInvoices, getStatistics, uploadInvoice, exportInvoices 
} from '../api'
import InvoiceDetail from '../components/InvoiceDetail.vue'
import ReviewDrawer from '../components/ReviewDrawer.vue'

use([
  CanvasRenderer,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const loading = ref(false)
const statistics = ref({})
const invoices = ref([])
const filterStatus = ref('')
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const showUpload = ref(false)
const uploading = ref(false)
const uploadFile = ref(null)
const uploadUrl = ref('')

const showDetail = ref(false)
const selectedInvoice = ref(null)

const showReview = ref(false)
const reviewInvoice = ref(null)

const statusMap = {
  pending: { text: '待处理', type: 'info' },
  uploaded: { text: '已上传', type: 'info' },
  ocr_processing: { text: '识别中', type: 'warning' },
  ocr_failed: { text: '识别失败', type: 'danger' },
  ocr_success: { text: '识别成功', type: 'success' },
  tax_validating: { text: '校验中', type: 'warning' },
  tax_invalid: { text: '税号无效', type: 'danger' },
  duplicate_checking: { text: '查重中', type: 'warning' },
  duplicate_found: { text: '重复票据', type: 'danger' },
  review_pending: { text: '待审核', type: 'warning' },
  review_approved: { text: '审核通过', type: 'success' },
  review_rejected: { text: '审核驳回', type: 'danger' },
  export_ready: { text: '待导出', type: 'success' },
  exported: { text: '已导出', type: 'success' }
}

const trendChartOption = computed(() => {
  const data = statistics.value.dailyTrend || []
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['数量', '金额'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: data.map(d => d.date) },
    yAxis: [
      { type: 'value', name: '数量', position: 'left' },
      { type: 'value', name: '金额(万)', position: 'right', axisLabel: { formatter: '{value}' } }
    ],
    series: [
      {
        name: '数量',
        type: 'line',
        smooth: true,
        data: data.map(d => d.count),
        itemStyle: { color: '#667eea' }
      },
      {
        name: '金额',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: data.map(d => (d.amount / 10000).toFixed(2)),
        itemStyle: { color: '#f56c6c' }
      }
    ]
  }
})

const statusChartOption = computed(() => {
  const stats = statistics.value.statusStats || []
  const colors = {
    review_pending: '#e6a23c',
    export_ready: '#67c23a',
    exported: '#409eff',
    ocr_failed: '#f56c6c',
    duplicate_found: '#f56c6c',
    tax_invalid: '#e6a23c'
  }
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: stats.map(s => ({
        value: s.count,
        name: getStatusText(s.status),
        itemStyle: { color: colors[s.status] || '#909399' }
      }))
    }]
  }
})

function getStatusCount(status) {
  const stats = statistics.value.statusStats || []
  const found = stats.find(s => s.status === status)
  return found ? found.count : 0
}

function getStatusText(status) {
  return statusMap[status]?.text || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

function getConfidenceColor(confidence) {
  if (!confidence) return '#909399'
  if (confidence >= 0.9) return '#67c23a'
  if (confidence >= 0.7) return '#e6a23c'
  return '#f56c6c'
}

function formatAmount(amount) {
  return parseFloat(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function loadData() {
  try {
    const [statsRes] = await Promise.all([
      getStatistics(),
      loadInvoices()
    ])
    statistics.value = statsRes.data
  } catch (error) {
    ElMessage.error('加载数据失败')
  }
}

async function loadInvoices() {
  loading.value = true
  try {
    const res = await getInvoices({
      status: filterStatus.value || undefined,
      page: pagination.page,
      limit: pagination.limit
    })
    invoices.value = res.data.data
    pagination.total = res.data.total
  } finally {
    loading.value = false
  }
}

function handleFileChange(file) {
  uploadFile.value = file.raw
  uploadUrl.value = URL.createObjectURL(file.raw)
}

async function confirmUpload() {
  if (!uploadFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  uploading.value = true
  try {
    await uploadInvoice(uploadFile.value)
    ElMessage.success('上传成功')
    showUpload.value = false
    uploadFile.value = null
    loadData()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function handleExport() {
  try {
    await ElMessageBox.confirm('确定要导出所有待导出的发票吗？', '确认导出', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    const res = await exportInvoices({ createdBy: '质量负责人' })
    ElMessage.success(`导出成功，共 ${res.data.recordCount} 条记录`)
    window.open(res.data.downloadUrl, '_blank')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '导出失败')
    }
  }
}

function viewDetail(row) {
  selectedInvoice.value = row
  showDetail.value = true
}

function openReview(row) {
  reviewInvoice.value = row
  showReview.value = true
}

async function retryOCR(row) {
  try {
    await ElMessageBox.confirm(`确定要重试识别吗？`, '确认重试', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    ElMessage.info('正在重试识别，请稍候...')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('重试失败')
    }
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.dashboard {
  max-width: 1600px;
  margin: 0 auto;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border: none;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.blue {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.orange {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.green {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.red {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.charts-row {
  margin-bottom: 20px;
}

.chart-card {
  height: 350px;
}

.trend-chart, .pie-chart {
  height: 260px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.action-row {
  margin-bottom: 20px;
}

.action-bar {
  display: flex;
  gap: 12px;
}

.amount {
  font-weight: 600;
  color: #f56c6c;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}

.file-preview {
  text-align: center;
  margin-top: 20px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.file-preview p {
  margin-top: 10px;
  color: #606266;
}
</style>
