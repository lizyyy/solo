<template>
  <div class="detail-container">
    <el-card v-if="job" class="overview-card">
      <template #header>
        <div class="card-header">
          <div>
            <el-button link @click="router.back()" style="margin-right: 12px;">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <span class="title">{{ job.name }}</span>
            <el-tag :type="getStatusType(job.status)" style="margin-left: 12px;">
              {{ getStatusLabel(job.status) }}
            </el-tag>
          </div>
          <div>
            <el-dropdown @command="handleExport">
              <el-button type="primary">
                导出报告
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="csv">导出为 CSV</el-dropdown-item>
                  <el-dropdown-item command="json">导出为 JSON</el-dropdown-item>
                  <el-dropdown-item command="xlsx">导出为 Excel</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button 
              v-if="job.failedCount > 0" 
              type="warning" 
              style="margin-left: 12px;"
              @click="retryAll"
            >
              重试失败行
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-card total">
            <div class="stat-value">{{ job.totalRows }}</div>
            <div class="stat-label">总记录数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card success">
            <div class="stat-value">{{ job.successCount }}</div>
            <div class="stat-label">成功</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card failed">
            <div class="stat-value">{{ job.failedCount }}</div>
            <div class="stat-label">失败</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card rate">
            <div class="stat-value">
              {{ job.totalRows > 0 
                ? ((job.successCount / job.totalRows) * 100).toFixed(1) 
                : 0 }}%
            </div>
            <div class="stat-label">成功率</div>
          </div>
        </el-col>
      </el-row>

      <el-divider />

      <el-descriptions :column="4" border>
        <el-descriptions-item label="任务ID">{{ job.id }}</el-descriptions-item>
        <el-descriptions-item label="导入类型">{{ getTypeLabel(job.type) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(job.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDate(job.updatedAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="summary" class="error-stats-card">
      <template #header>
        <span>错误统计</span>
      </template>
      <el-table :data="summary.failedDetails" v-if="summary.failedDetails.length > 0" stripe>
        <el-table-column prop="field" label="字段" width="150" />
        <el-table-column prop="rule" label="规则" width="120" />
        <el-table-column prop="message" label="错误信息" />
        <el-table-column prop="value" label="影响行数" width="120" />
      </el-table>
      <el-empty v-else description="无错误" />
    </el-card>

    <el-card class="rows-card">
      <template #header>
        <div class="card-header">
          <el-tabs v-model="activeTab" class="tabs-header">
            <el-tab-pane label="全部" name="all" />
            <el-tab-pane :label="`失败 (${failedRows.length})`" name="failed" />
            <el-tab-pane :label="`成功 (${successRows.length})`" name="success" />
          </el-tabs>
          <div>
            <el-input 
              v-model="searchText" 
              placeholder="搜索数据..." 
              style="width: 200px; margin-right: 12px;"
              clearable
            />
          </div>
        </div>
      </template>

      <el-table 
        :data="filteredRows" 
        v-loading="loadingRows" 
        stripe
        max-height="500"
      >
        <el-table-column type="selection" width="55" v-if="activeTab === 'failed'" />
        <el-table-column prop="rowIndex" label="行号" width="80" fixed="left" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column 
          v-for="col in dynamicColumns" 
          :key="col" 
          :prop="`data.${col}`" 
          :label="col"
          min-width="120"
          show-overflow-tooltip
        />

        <el-table-column label="错误信息" min-width="300">
          <template #default="{ row }">
            <div v-if="row.errors.length > 0">
              <el-alert
                v-for="(error, idx) in row.errors.slice(0, 3)"
                :key="idx"
                :title="error.message"
                type="error"
                :closable="false"
                style="margin-bottom: 4px;"
              />
              <el-tag v-if="row.errors.length > 3" type="info" effect="plain" size="small">
                还有 {{ row.errors.length - 3 }} 个错误
              </el-tag>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>

        <el-table-column label="重试次数" width="100">
          <template #default="{ row }">
            <span v-if="row.retryCount > 0">{{ row.retryCount }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'failed'">
              <el-button type="primary" link @click="retryRow(row)">
                重试
              </el-button>
              <el-button type="warning" link @click="editRow(row)">
                编辑
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="activeTab === 'failed' && failedRows.length > 0" class="batch-actions">
        <el-button 
          type="primary" 
          :disabled="selectedRows.length === 0"
          @click="batchRetry"
        >
          批量重试 {{ selectedRows.length }} 条
        </el-button>
      </div>
    </el-card>

    <el-dialog v-model="editDialogVisible" title="编辑行数据" width="600px">
      <el-form :model="editForm" label-width="120px">
        <el-form-item 
          v-for="col in dynamicColumns" 
          :key="col" 
          :label="col"
        >
          <el-input v-model="editForm[col]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAndRetry">保存并重试</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowDown } from '@element-plus/icons-vue'
import { jobsApi, type ImportJob, type ImportSummary, type RowResult } from './api'

const router = useRouter()
const route = useRoute()

const loadingRows = ref(false)
const job = ref<ImportJob | null>(null)
const summary = ref<ImportSummary | null>(null)
const allRows = ref<RowResult[]>([])
const activeTab = ref('all')
const searchText = ref('')
const editDialogVisible = ref(false)
const editingRow = ref<RowResult | null>(null)
const editForm = ref<Record<string, any>>({})
const selectedRows = ref<RowResult[]>([])

const typeLabels: Record<string, string> = {
  user: '用户',
  product: '商品',
  order: '订单',
  custom: '自定义'
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  validating: '校验中',
  completed: '已完成',
  failed: '失败'
}

const failedRows = computed(() => allRows.value.filter(r => r.status === 'failed'))
const successRows = computed(() => allRows.value.filter(r => r.status === 'success'))

const dynamicColumns = computed(() => {
  if (allRows.value.length === 0) return []
  const cols = new Set<string>()
  for (const row of allRows.value) {
    for (const key of Object.keys(row.data)) {
      cols.add(key)
    }
  }
  return Array.from(cols)
})

const filteredRows = computed(() => {
  let rows = allRows.value
  
  if (activeTab.value === 'failed') {
    rows = failedRows.value
  } else if (activeTab.value === 'success') {
    rows = successRows.value
  }
  
  if (searchText.value) {
    const keyword = searchText.value.toLowerCase()
    rows = rows.filter(r => {
      return Object.values(r.data).some(v => 
        String(v).toLowerCase().includes(keyword)
      ) || r.errors.some(e => 
        e.message.toLowerCase().includes(keyword)
      )
    })
  }
  
  return rows
})

onMounted(() => loadData())

async function loadData() {
  const jobId = route.params.id as string
  if (!jobId) return

  try {
    const [{ data: jobData }, { data: rowsData }] = await Promise.all([
      jobsApi.get(jobId),
      jobsApi.getRows(jobId)
    ])
    
    job.value = jobData.job
    summary.value = jobData.summary
    allRows.value = rowsData.rows
  } catch (e: any) {
    ElMessage.error('加载任务详情失败: ' + e.message)
  }
}

function getTypeLabel(type: string) {
  return typeLabels[type] || type
}

function getStatusLabel(status: string) {
  return statusLabels[status] || status
}

function getStatusType(status: string) {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'validating': return 'warning'
    default: return 'info'
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('zh-CN')
}

async function handleExport(format: string) {
  const jobId = route.params.id as string
  try {
    const { data } = await jobsApi.createReport(jobId, format as any)
    ElMessage.success('报告生成成功')
    
    const link = document.createElement('a')
    link.href = `/api/reports/${data.report.id}/download`
    link.click()
  } catch (e: any) {
    ElMessage.error('导出失败: ' + e.message)
  }
}

async function retryAll() {
  const jobId = route.params.id as string
  try {
    await ElMessageBox.confirm(
      `将重试全部 ${job.value?.failedCount} 条失败记录，是否继续？`,
      '确认重试',
      { type: 'warning' }
    )

    loadingRows.value = true
    const { data } = await jobsApi.retry(jobId)
    job.value = data.job
    summary.value = data.summary
    await loadRows()
    
    ElMessage.success(`重试完成，${data.summary.success} 条通过`)
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error('重试失败: ' + e.message)
    }
  } finally {
    loadingRows.value = false
  }
}

async function retryRow(row: RowResult) {
  const jobId = route.params.id as string
  try {
    loadingRows.value = true
    const { data } = await jobsApi.retry(jobId, [row.id])
    job.value = data.job
    summary.value = data.summary
    await loadRows()
    
    const updatedRow = allRows.value.find(r => r.id === row.id)
    if (updatedRow?.status === 'success') {
      ElMessage.success('重试成功')
    } else {
      ElMessage.warning('重试后仍有错误')
    }
  } catch (e: any) {
    ElMessage.error('重试失败: ' + e.message)
  } finally {
    loadingRows.value = false
  }
}

async function batchRetry() {
  if (selectedRows.value.length === 0) return
  
  const jobId = route.params.id as string
  const rowIds = selectedRows.value.map(r => r.id)
  
  try {
    loadingRows.value = true
    const { data } = await jobsApi.retry(jobId, rowIds)
    job.value = data.job
    summary.value = data.summary
    await loadRows()
    selectedRows.value = []
    
    ElMessage.success(`批量重试完成`)
  } catch (e: any) {
    ElMessage.error('批量重试失败: ' + e.message)
  } finally {
    loadingRows.value = false
  }
}

function editRow(row: RowResult) {
  editingRow.value = row
  editForm.value = { ...row.data }
  editDialogVisible.value = true
}

async function saveAndRetry() {
  if (!editingRow.value) return
  
  const jobId = route.params.id as string
  try {
    loadingRows.value = true
    editDialogVisible.value = false
    
    const overrideData: Record<string, Record<string, any>> = {}
    overrideData[editingRow.value.id] = editForm.value
    
    const { data } = await jobsApi.retry(jobId, [editingRow.value.id], overrideData)
    job.value = data.job
    summary.value = data.summary
    await loadRows()
    
    const updatedRow = allRows.value.find(r => r.id === editingRow.value!.id)
    if (updatedRow?.status === 'success') {
      ElMessage.success('保存并重试成功')
    } else {
      ElMessage.warning('重试后仍有错误')
    }
  } catch (e: any) {
    ElMessage.error('保存失败: ' + e.message)
  } finally {
    loadingRows.value = false
  }
}

async function loadRows() {
  const jobId = route.params.id as string
  const { data } = await jobsApi.getRows(jobId)
  allRows.value = data.rows
}
</script>

<style scoped>
.detail-container {
  max-width: 1400px;
  margin: 24px auto;
}

.overview-card {
  margin-bottom: 24px;
}

.error-stats-card {
  margin-bottom: 24px;
}

.rows-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.title {
  font-size: 18px;
}

.tabs-header {
  flex: 1;
}

.stats-row {
  margin-top: 16px;
}

.stat-card {
  text-align: center;
  padding: 24px 16px;
  border-radius: 8px;
}

.stat-card.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-card.success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.stat-card.failed {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
  color: white;
}

.stat-card.rate {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.batch-actions {
  margin-top: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.text-muted {
  color: #c0c4cc;
}
</style>