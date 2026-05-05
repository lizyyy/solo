<template>
  <div class="export-container">
    <el-card>
      <template #header>
        <span class="card-title">数据导出</span>
      </template>

      <el-alert
        title="导出功能说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <p>支持导出以下格式：</p>
        <ul>
          <li><strong>Markdown 交班单</strong>: 适用于交接班记录，包含风险统计和明细</li>
          <li><strong>JSON 明细</strong>: 适用于数据备份和二次分析，包含完整数据结构</li>
        </ul>
      </el-alert>

      <el-form :model="exportForm" label-width="100px" class="export-form">
        <el-divider content-position="left">筛选条件</el-divider>
        
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="站点">
              <el-select v-model="exportForm.station_name" placeholder="全部站点" clearable style="width: 100%">
                <el-option
                  v-for="station in stations"
                  :key="station"
                  :label="station"
                  :value="station"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="扶梯编号">
              <el-input
                v-model="exportForm.escalator_code"
                placeholder="请输入扶梯编号（可选）"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="风险类型">
              <el-select v-model="exportForm.risk_type" placeholder="全部类型" clearable style="width: 100%">
                <el-option label="频繁停梯" value="frequent_stop" />
                <el-option label="超载误报" value="overload_false_alarm" />
                <el-option label="长期未复位" value="long_unreset" />
                <el-option label="维保超时" value="maintenance_timeout" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="风险等级">
              <el-select v-model="exportForm.risk_level" placeholder="全部等级" clearable style="width: 100%">
                <el-option label="严重" value="critical" />
                <el-option label="高" value="high" />
                <el-option label="中" value="medium" />
                <el-option label="低" value="low" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="仅重启后仍存在">
              <el-switch v-model="exportForm.is_reopened" />
              <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                开启后只导出重启后仍然存在的风险
              </span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">导出选项</el-divider>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-card class="export-option-card" :class="{ 'card-selected': selectedExportType === 'markdown' }">
              <div class="export-option-header" @click="selectedExportType = 'markdown'">
                <el-icon size="32" :color="selectedExportType === 'markdown' ? '#409EFF' : '#909399'">
                  <Document />
                </el-icon>
                <div class="export-option-info">
                  <h3>Markdown 交班单</h3>
                  <p>导出格式易读的交班文档，适合打印或分享</p>
                </div>
              </div>
              <div class="export-option-actions">
                <el-button 
                  type="primary" 
                  :loading="exportingMarkdown"
                  @click="exportMarkdown"
                >
                  <el-icon><Download /></el-icon>
                  导出 Markdown
                </el-button>
              </div>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card class="export-option-card" :class="{ 'card-selected': selectedExportType === 'json' }">
              <div class="export-option-header" @click="selectedExportType = 'json'">
                <el-icon size="32" :color="selectedExportType === 'json' ? '#409EFF' : '#909399'">
                  <Share />
                </el-icon>
                <div class="export-option-info">
                  <h3>JSON 明细</h3>
                  <p>导出完整结构化数据，适合备份和程序处理</p>
                </div>
              </div>
              <div class="export-option-actions">
                <el-button 
                  type="success" 
                  :loading="exportingJson"
                  @click="exportJson"
                >
                  <el-icon><Download /></el-icon>
                  导出 JSON
                </el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-divider content-position="left">快捷导出</el-divider>

        <el-row :gutter="20">
          <el-col :span="6">
            <el-button type="primary" plain style="width: 100%" @click="quickExport('all')">
              <el-icon><Document /></el-icon>
              全部待处理风险
            </el-button>
          </el-col>
          <el-col :span="6">
            <el-button type="danger" plain style="width: 100%" @click="quickExport('critical')">
              <el-icon><Warning /></el-icon>
              严重风险
            </el-button>
          </el-col>
          <el-col :span="6">
            <el-button type="warning" plain style="width: 100%" @click="quickExport('reopened')">
              <el-icon><RefreshRight /></el-icon>
              重启后仍存在
            </el-button>
          </el-col>
          <el-col :span="6">
            <el-button type="info" plain style="width: 100%" @click="quickExport('frequent_stop')">
              <el-icon><Clock /></el-icon>
              频繁停梯
            </el-button>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span class="card-title">导出预览</span>
          <el-button type="primary" link @click="loadPreview">
            <el-icon><Refresh /></el-icon>
            刷新预览
          </el-button>
        </div>
      </template>

      <el-table
        :data="previewData"
        v-loading="previewLoading"
        style="width: 100%"
      >
        <el-table-column prop="station_name" label="站点" width="130" />
        <el-table-column prop="escalator_code" label="扶梯编号" width="120" />
        <el-table-column prop="risk_type" label="风险类型" width="130">
          <template #default="{ row }">
            <el-tag :type="getRiskTypeTagType(row.risk_type)" size="small">
              {{ getRiskTypeName(row.risk_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="risk_level" label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag :type="getRiskLevelTagType(row.risk_level)" size="small">
              {{ getRiskLevelName(row.risk_level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_reopened" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_reopened" type="danger" effect="dark" size="small">
              重启后仍在
            </el-tag>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="detected_time" label="检测时间" width="170" />
      </el-table>

      <el-empty v-if="previewData.length === 0 && !previewLoading" description="暂无数据，请调整筛选条件后刷新预览" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { escalatorApi, exportApi, riskApi } from '@/api'

const stations = ref([])
const previewData = ref([])
const previewLoading = ref(false)
const exportingMarkdown = ref(false)
const exportingJson = ref(false)
const selectedExportType = ref('markdown')

const exportForm = reactive({
  station_name: '',
  escalator_code: '',
  risk_type: '',
  risk_level: '',
  is_reopened: false
})

const riskTypeNames = {
  frequent_stop: '频繁停梯',
  overload_false_alarm: '超载误报',
  long_unreset: '长期未复位',
  maintenance_timeout: '维保超时'
}

const riskLevelNames = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低'
}

const loadStations = async () => {
  try {
    const res = await escalatorApi.getStations()
    if (res.data.success) {
      stations.value = res.data.data
    }
  } catch (error) {
    console.error('加载站点列表失败:', error)
  }
}

const loadPreview = async () => {
  previewLoading.value = true
  try {
    const params = {
      page: 1,
      page_size: 50,
      status: 'pending',
      ...exportForm
    }
    
    if (!params.station_name) delete params.station_name
    if (!params.escalator_code) delete params.escalator_code
    if (!params.risk_type) delete params.risk_type
    if (!params.risk_level) delete params.risk_level
    if (!params.is_reopened) delete params.is_reopened

    const res = await riskApi.getList(params)
    if (res.data.success) {
      previewData.value = res.data.data.risks
    }
  } catch (error) {
    console.error('加载预览数据失败:', error)
  } finally {
    previewLoading.value = false
  }
}

const getExportParams = () => {
  const params = {}
  if (exportForm.station_name) params.station_name = exportForm.station_name
  if (exportForm.escalator_code) params.escalator_code = exportForm.escalator_code
  if (exportForm.risk_type) params.risk_type = exportForm.risk_type
  if (exportForm.risk_level) params.risk_level = exportForm.risk_level
  if (exportForm.is_reopened) params.is_reopened = true
  return params
}

const exportMarkdown = async () => {
  exportingMarkdown.value = true
  try {
    const params = getExportParams()
    const res = await exportApi.getHandoverReportMarkdown(params)
    
    const blob = new Blob([res.data], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `handover-report-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    ElMessage.success('Markdown 交班单导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败: ' + (error.message || error))
  } finally {
    exportingMarkdown.value = false
  }
}

const exportJson = async () => {
  exportingJson.value = true
  try {
    const params = getExportParams()
    const res = await exportApi.getHandoverReportJson(params)
    
    if (res.data.success) {
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `handover-report-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      ElMessage.success('JSON 明细导出成功')
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败: ' + (error.message || error))
  } finally {
    exportingJson.value = false
  }
}

const quickExport = (type) => {
  exportForm.station_name = ''
  exportForm.escalator_code = ''
  exportForm.risk_type = ''
  exportForm.risk_level = ''
  exportForm.is_reopened = false

  switch (type) {
    case 'all':
      break
    case 'critical':
      exportForm.risk_level = 'critical'
      break
    case 'reopened':
      exportForm.is_reopened = true
      break
    case 'frequent_stop':
      exportForm.risk_type = 'frequent_stop'
      break
  }

  loadPreview()
}

const getRiskTypeName = (type) => riskTypeNames[type] || type
const getRiskLevelName = (level) => riskLevelNames[level] || level

const getRiskTypeTagType = (type) => {
  const map = {
    frequent_stop: 'danger',
    overload_false_alarm: 'warning',
    long_unreset: 'danger',
    maintenance_timeout: 'warning'
  }
  return map[type] || ''
}

const getRiskLevelTagType = (level) => {
  const map = {
    critical: 'danger',
    high: 'warning',
    medium: '',
    low: 'success'
  }
  return map[level] || ''
}

onMounted(() => {
  loadStations()
  loadPreview()
})
</script>

<style lang="scss" scoped>
.export-container {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .card-title {
      font-size: 16px;
      font-weight: 500;
    }
  }

  .export-form {
    margin-top: 10px;
  }

  .export-option-card {
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    }

    &.card-selected {
      border-color: #409EFF;
    }

    .export-option-header {
      display: flex;
      align-items: center;
    }

    .export-option-info {
      margin-left: 15px;

      h3 {
        margin: 0 0 5px 0;
        font-size: 16px;
        color: #303133;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: #909399;
      }
    }

    .export-option-actions {
      margin-top: 15px;
      text-align: right;
    }
  }

  .text-gray {
    color: #909399;
  }
}
</style>
