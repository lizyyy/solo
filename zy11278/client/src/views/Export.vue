<template>
  <div class="export">
    <div class="page-header">
      <h2 class="page-title">复盘报告导出</h2>
      <div class="action-bar">
        <el-button type="primary" @click="previewReport">
          <el-icon><View /></el-icon>
          预览报告
        </el-button>
      </div>
    </div>

    <el-row :gutter="15">
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>导出选项</span>
          </template>

          <el-form :model="exportForm" label-width="100px">
            <el-form-item label="交易日">
              <el-select v-model="exportForm.trading_day_id" placeholder="选择交易日" style="width: 100%">
                <el-option
                  v-for="day in tradingDays"
                  :key="day.id"
                  :label="day.date"
                  :value="day.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="导出类型">
              <el-radio-group v-model="exportForm.type">
                <el-radio value="single">单日报告</el-radio>
                <el-radio value="range">区间报告</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="exportForm.type === 'range'" label="日期范围">
              <el-date-picker
                v-model="exportForm.date_range"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="报告包含">
              <el-checkbox-group v-model="exportForm.include_sections">
                <el-checkbox label="overview">交易概览</el-checkbox>
                <el-checkbox label="positions">持仓变化</el-checkbox>
                <el-checkbox label="risks">风险命中</el-checkbox>
                <el-checkbox label="pnl">盈亏归因</el-checkbox>
                <el-checkbox label="orders">复盘订单</el-checkbox>
                <el-checkbox label="notes">复盘笔记</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="导出格式">
              <el-radio-group v-model="exportForm.format">
                <el-radio value="markdown">
                  <el-icon><Document /></el-icon>
                  Markdown
                </el-radio>
                <el-radio value="html">
                  <el-icon><Picture /></el-icon>
                  HTML
                </el-radio>
                <el-radio value="csv">
                  <el-icon><Grid /></el-icon>
                  CSV
                </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="exportReport" :loading="exporting" style="width: 100%">
                <el-icon><Download /></el-icon>
                导出报告
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card style="margin-top: 15px">
          <template #header>
            <span>快速统计</span>
          </template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="交易日数">{{ tradingDays.length }}</el-descriptions-item>
            <el-descriptions-item label="总订单数">{{ stats.total_orders || 0 }}</el-descriptions-item>
            <el-descriptions-item label="成交订单">{{ stats.filled_orders || 0 }}</el-descriptions-item>
            <el-descriptions-item label="预警总数">{{ stats.total_alerts || 0 }}</el-descriptions-item>
            <el-descriptions-item label="持仓数量">{{ stats.position_count || 0 }}</el-descriptions-item>
            <el-descriptions-item label="复盘笔记">{{ stats.note_count || 0 }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>报告预览</span>
              <div>
                <el-radio-group v-model="previewFormat" size="small" style="margin-right: 10px" @change="handlePreviewFormatChange">
                  <el-radio-button value="markdown">Markdown</el-radio-button>
                  <el-radio-button value="html">HTML</el-radio-button>
                </el-radio-group>
                <el-button text size="small" @click="copyPreviewContent">
                  <el-icon><CopyDocument /></el-icon>
                  复制
                </el-button>
              </div>
            </div>
          </template>

          <div class="preview-container">
            <template v-if="previewLoading">
              <div class="loading-placeholder">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>加载预览...</span>
              </div>
            </template>
            <template v-else-if="previewContent">
              <template v-if="previewFormat === 'html'">
                <div class="html-preview" v-html="previewContent"></div>
              </template>
              <template v-else>
                <div class="markdown-preview">
                  <pre>{{ previewContent }}</pre>
                </div>
              </template>
            </template>
            <template v-else>
              <el-empty description="请先选择导出选项，然后点击预览报告" />
            </template>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { exportApi, tradingDayApi } from '@/api'
import { ElMessage } from 'element-plus'

const tradingDays = ref([])
const exporting = ref(false)
const previewLoading = ref(false)
const previewFormat = ref('markdown')
const previewContent = ref('')

const stats = ref({
  total_orders: 0,
  filled_orders: 0,
  total_alerts: 0,
  position_count: 0,
  note_count: 0
})

const exportForm = ref({
  trading_day_id: null,
  type: 'single',
  date_range: [],
  include_sections: ['overview', 'positions', 'risks', 'pnl', 'orders', 'notes'],
  format: 'markdown'
})

async function loadTradingDays() {
  try {
    const res = await tradingDayApi.list({ pageSize: 50 })
    tradingDays.value = res.data?.list || []
    if (tradingDays.value.length > 0) {
      const active = tradingDays.value.find(d => d.status === 'active')
      exportForm.value.trading_day_id = active?.id || tradingDays.value[0].id
    }
  } catch (error) {
    console.error('加载交易日失败:', error)
  }
}

async function loadStats() {
  try {
    const res = await exportApi.getStats()
    stats.value = res.data || stats.value
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

async function previewReport() {
  if (exportForm.value.type === 'single' && !exportForm.value.trading_day_id) {
    ElMessage.warning('请选择交易日')
    return
  }
  
  if (exportForm.value.type === 'range' && (!exportForm.value.date_range || exportForm.value.date_range.length === 0)) {
    ElMessage.warning('请选择日期范围')
    return
  }
  
  try {
    previewLoading.value = true
    previewContent.value = ''
    
    const params = {
      trading_day_id: exportForm.value.type === 'single' ? exportForm.value.trading_day_id : null,
      start_date: exportForm.value.type === 'range' ? exportForm.value.date_range[0] : null,
      end_date: exportForm.value.type === 'range' ? exportForm.value.date_range[1] : null,
      include_sections: exportForm.value.include_sections.join(','),
      format: previewFormat.value
    }
    
    const res = await exportApi.preview(params)
    previewContent.value = res.data?.content || ''
  } catch (error) {
    console.error('预览失败:', error)
    ElMessage.error('预览失败')
  } finally {
    previewLoading.value = false
  }
}

function handlePreviewFormatChange() {
  if (previewContent.value) {
    previewReport()
  }
}

function copyPreviewContent() {
  if (!previewContent.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(previewContent.value).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

async function exportReport() {
  if (exportForm.value.type === 'single' && !exportForm.value.trading_day_id) {
    ElMessage.warning('请选择交易日')
    return
  }
  
  if (exportForm.value.type === 'range' && (!exportForm.value.date_range || exportForm.value.date_range.length === 0)) {
    ElMessage.warning('请选择日期范围')
    return
  }
  
  if (exportForm.value.include_sections.length === 0) {
    ElMessage.warning('请至少选择一个报告内容')
    return
  }
  
  try {
    exporting.value = true
    
    const params = {
      trading_day_id: exportForm.value.type === 'single' ? exportForm.value.trading_day_id : null,
      start_date: exportForm.value.type === 'range' ? exportForm.value.date_range[0] : null,
      end_date: exportForm.value.type === 'range' ? exportForm.value.date_range[1] : null,
      include_sections: exportForm.value.include_sections.join(','),
      format: exportForm.value.format
    }
    
    const res = await exportApi.export(params)
    
    if (res.data?.content) {
      const blob = new Blob([res.data.content], { type: getMimeType(exportForm.value.format) })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getFileName(exportForm.value.format)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      ElMessage.success('导出成功')
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

function getMimeType(format) {
  const map = {
    markdown: 'text/markdown',
    html: 'text/html',
    csv: 'text/csv'
  }
  return map[format] || 'text/plain'
}

function getFileName(format) {
  const timestamp = new Date().toISOString().slice(0, 10)
  const extMap = {
    markdown: 'md',
    html: 'html',
    csv: 'csv'
  }
  return `trading-review-${timestamp}.${extMap[format] || 'txt'}`
}

onMounted(async () => {
  await loadTradingDays()
  await loadStats()
})
</script>

<style scoped>
.export {
  height: 100%;
}

.preview-container {
  min-height: 400px;
  max-height: 600px;
  overflow-y: auto;
}

.loading-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: #909399;
}

.loading-placeholder .el-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.markdown-preview {
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
}

.markdown-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
}

.html-preview {
  padding: 15px;
}

.html-preview h1 {
  font-size: 24px;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #409eff;
}

.html-preview h2 {
  font-size: 18px;
  margin-top: 20px;
  margin-bottom: 10px;
  color: #606266;
}

.html-preview table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.html-preview th,
.html-preview td {
  border: 1px solid #dcdfe6;
  padding: 8px 12px;
  text-align: left;
}

.html-preview th {
  background-color: #f5f7fa;
  font-weight: bold;
}

.html-preview .highlight {
  color: #409eff;
  font-weight: bold;
}

.html-preview .positive {
  color: #67c23a;
}

.html-preview .negative {
  color: #f56c6c;
}
</style>
