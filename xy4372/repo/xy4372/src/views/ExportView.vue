<template>
  <div class="page-container">
    <h2 class="page-title">报告导出</h2>

    <el-alert
      v-if="!appStore.currentSessionId"
      title="请先选择赛事"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 20px;"
    >
      <template #default>
        请在"赛事管理"页面创建或选择一个赛事。
        <el-button type="primary" link @click="router.push('/sessions')">前往赛事管理</el-button>
      </template>
    </el-alert>

    <template v-else>
      <el-alert
        v-if="hasCriticalUnresolved"
        title="存在未解决的严重风险"
        type="error"
        show-icon
        style="margin-bottom: 20px;"
      >
        仍有严重风险未处理或未被推翻。请先在"风险复核"页面处理所有严重风险。
        <el-button type="primary" link @click="router.push('/review')">前往风险复核</el-button>
      </el-alert>

      <el-row :gutter="20" style="margin-bottom: 24px;">
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value" :style="{ color: totalRisks > 0 ? '#e6a23c' : '#67c23a' }">
              {{ totalRisks }}
            </div>
            <div class="stat-label">总风险数</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value" :style="{ color: confirmedCount > 0 ? '#67c23a' : '#909399' }">
              {{ confirmedCount }}
            </div>
            <div class="stat-label">已确认风险</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value" :style="{ color: overruledCount > 0 ? '#409eff' : '#909399' }">
              {{ overruledCount }}
            </div>
            <div class="stat-label">已推翻判定</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value" :class="{ 'can-release': !hasCriticalUnresolved }">
              {{ !hasCriticalUnresolved ? '✓ 可放行' : '✗ 不可放行' }}
            </div>
            <div class="stat-label">放行状态</div>
          </el-card>
        </el-col>
      </el-row>

      <el-card class="export-section">
        <template #header>
          <div class="section-header">
            <span>导出选项</span>
          </div>
        </template>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-card
              class="export-card"
              shadow="hover"
              :class="{ 'card-disabled': hasCriticalUnresolved }"
            >
              <div class="card-icon markdown-icon">
                <el-icon :size="48"><Document /></el-icon>
              </div>
              <h3>赛前放行单</h3>
              <p>Markdown 格式，包含赛事信息、风险摘要、复核状态、赛程安排和签字区域。</p>
              <el-button
                type="primary"
                :disabled="hasCriticalUnresolved"
                @click="handleExportMarkdown"
              >
                <el-icon><Download /></el-icon>
                导出 MD
              </el-button>
            </el-card>
          </el-col>

          <el-col :span="8">
            <el-card class="export-card" shadow="hover">
              <div class="card-icon csv-icon">
                <el-icon :size="48"><Grid /></el-icon>
              </div>
              <h3>风险清单</h3>
              <p>CSV 格式，包含所有风险的详细信息、复核状态、教练备注等，可直接用 Excel 打开。</p>
              <el-button type="success" @click="handleExportCsv">
                <el-icon><Download /></el-icon>
                导出 CSV
              </el-button>
            </el-card>
          </el-col>

          <el-col :span="8">
            <el-card class="export-card" shadow="hover">
              <div class="card-icon json-icon">
                <el-icon :size="48"><Share /></el-icon>
              </div>
              <h3>审计包</h3>
              <p>JSON 格式，包含完整的赛事数据、风险信息、复核记录和统计信息，用于存档和审计。</p>
              <el-button type="warning" @click="handleExportJson">
                <el-icon><Download /></el-icon>
                导出 JSON
              </el-button>
            </el-card>
          </el-col>
        </el-row>

        <el-divider />

        <div class="batch-export">
          <h3>批量导出</h3>
          <p>一次性导出所有三种格式的报告文件。</p>
          <el-button
            type="primary"
            size="large"
            :disabled="hasCriticalUnresolved"
            @click="handleBatchExport"
          >
            <el-icon><Download /></el-icon>
            批量导出所有报告
          </el-button>
        </div>
      </el-card>

      <el-card class="preview-section" style="margin-top: 20px;">
        <template #header>
          <div class="section-header">
            <span>报告预览</span>
            <el-tabs v-model="activePreviewTab" type="card" size="small">
              <el-tab-pane label="放行单预览" name="markdown" />
              <el-tab-pane label="风险清单预览" name="csv" />
            </el-tabs>
          </div>
        </template>

        <div v-if="activePreviewTab === 'markdown'" class="markdown-preview">
          <pre v-if="exportData.markdown">{{ exportData.markdown }}</pre>
          <el-empty v-else description="暂无数据，请先完成风险检测和复核" />
        </div>

        <div v-else class="csv-preview">
          <el-table
            v-if="csvPreviewData.length > 0"
            :data="csvPreviewData"
            border
            size="small"
            max-height="400"
          >
            <el-table-column prop="风险类型" label="风险类型" width="120" />
            <el-table-column prop="严重程度" label="严重程度" width="100">
              <template #default="{ row }">
                <el-tag :type="getSeverityTagType(row['严重程度'])" size="small">
                  {{ row['严重程度'] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="马匹编号" label="马匹编号" width="100" />
            <el-table-column prop="马匹名称" label="马匹名称" min-width="120" />
            <el-table-column prop="场次" label="场次" min-width="120" />
            <el-table-column prop="风险标题" label="风险标题" min-width="150" />
            <el-table-column prop="复核状态" label="复核状态" width="100">
              <template #default="{ row }">
                <el-tag
                  :type="row['复核状态'] === '已复核' ? 'success' : 'warning'"
                  size="small"
                >
                  {{ row['复核状态'] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="教练判定" label="教练判定" width="100">
              <template #default="{ row }">
                <span v-if="row['教练判定'] === '确认风险'" class="judgment-confirmed">
                  {{ row['教练判定'] }}
                </span>
                <span v-else-if="row['教练判定'] === '推翻判定'" class="judgment-overruled">
                  {{ row['教练判定'] }}
                </span>
                <span v-else class="judgment-pending">
                  {{ row['教练判定'] || '-' }}
                </span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无数据，请先完成风险检测" />
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Document,
  Grid,
  Share,
  Download,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores'
import { exportAll, downloadMarkdown, downloadCsv, downloadJson } from '@/utils/exporter'
import type { ReviewRecord } from '@/types'

const router = useRouter()
const appStore = useAppStore()

const activePreviewTab = ref('markdown')
const exportData = ref({
  markdown: '',
  csv: '',
  json: '',
  filenames: {
    markdown: '',
    csv: '',
    json: '',
  },
})

const totalRisks = computed(() => appStore.sessionData.risks.length)
const hasCriticalUnresolved = computed(() => appStore.hasCriticalUnresolved)

const confirmedCount = computed(() => 
  appStore.sessionData.reviewRecords.filter(r => r.coachJudgment === 'confirmed').length
)

const overruledCount = computed(() => 
  appStore.sessionData.reviewRecords.filter(r => r.coachJudgment === 'overruled').length
)

const csvPreviewData = computed(() => {
  const risks = appStore.sessionData.risks
  const reviews = appStore.sessionData.reviewRecords

  return risks.slice(0, 20).map(risk => {
    const review = reviews.find(r => r.riskId === risk.id)
    return {
      '风险类型': getRiskTypeLabel(risk.type),
      '严重程度': getSeverityLabel(risk.severity),
      '马匹编号': risk.horseNumber,
      '马匹名称': risk.horseName || '-',
      '场次': risk.raceName || risk.raceNumber || '-',
      '风险标题': risk.title,
      '复核状态': review ? '已复核' : '待复核',
      '教练判定': getJudgmentLabel(review?.coachJudgment),
      '教练备注': review?.coachNotes || '-',
    }
  })
})

function getRiskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    rest_period_not_expired: '休养期未满',
    duplicate_race_entry: '重复排赛',
    shoeing_overdue: '蹄铁超期',
    tack_size_mismatch: '鞍具不匹配',
    high_temperature_risk: '高温风险',
  }
  return labels[type] || type
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
  }
  return labels[severity] || severity
}

function getJudgmentLabel(judgment?: ReviewRecord['coachJudgment']): string {
  const labels: Record<string, string> = {
    confirmed: '确认风险',
    overruled: '推翻判定',
    pending: '待复核',
  }
  return labels[judgment || ''] || '-'
}

function getSeverityTagType(severity: string): string {
  switch (severity) {
    case '严重': return 'danger'
    case '高': return 'warning'
    case '中': return ''
    case '低': return 'info'
    default: return 'info'
  }
}

function prepareExportData(): void {
  if (!appStore.currentSession) return

  const result = exportAll({
    session: appStore.currentSession,
    horses: appStore.sessionData.horses,
    vetRecords: appStore.sessionData.vetRecords,
    shoeingRecords: appStore.sessionData.shoeingRecords,
    tackItems: appStore.sessionData.tackItems,
    raceEntries: appStore.sessionData.raceEntries,
    risks: appStore.sessionData.risks,
    reviewRecords: appStore.sessionData.reviewRecords,
    settings: appStore.settings,
  })

  exportData.value = result
}

function handleExportMarkdown(): void {
  if (!exportData.value.markdown) {
    prepareExportData()
  }
  downloadMarkdown(exportData.value.markdown, exportData.value.filenames.markdown)
  ElMessage.success('Markdown 放行单已导出')
}

function handleExportCsv(): void {
  if (!exportData.value.csv) {
    prepareExportData()
  }
  downloadCsv(exportData.value.csv, exportData.value.filenames.csv)
  ElMessage.success('CSV 风险清单已导出')
}

function handleExportJson(): void {
  if (!exportData.value.json) {
    prepareExportData()
  }
  downloadJson(exportData.value.json, exportData.value.filenames.json)
  ElMessage.success('JSON 审计包已导出')
}

function handleBatchExport(): void {
  prepareExportData()
  handleExportMarkdown()
  setTimeout(() => handleExportCsv(), 200)
  setTimeout(() => handleExportJson(), 400)
}

watch(
  () => appStore.sessionData,
  () => {
    prepareExportData()
  },
  { deep: true }
)

onMounted(() => {
  if (appStore.currentSessionId) {
    appStore.loadCurrentSessionData()
  }
  appStore.loadSettings()
})
</script>

<style scoped>
.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #409eff;
}

.stat-value.can-release {
  color: #67c23a;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 600;
}

.export-card {
  text-align: center;
  padding: 20px;
}

.card-disabled {
  opacity: 0.6;
}

.card-icon {
  margin-bottom: 16px;
}

.markdown-icon {
  color: #409eff;
}

.csv-icon {
  color: #67c23a;
}

.json-icon {
  color: #e6a23c;
}

.export-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.export-card p {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 16px;
  min-height: 60px;
}

.batch-export {
  text-align: center;
  padding: 20px 0;
}

.batch-export h3 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.batch-export p {
  color: #909399;
  margin-bottom: 16px;
}

.markdown-preview {
  background-color: #f9fafc;
  border-radius: 4px;
  padding: 16px;
  max-height: 500px;
  overflow: auto;
}

.markdown-preview pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #303133;
}

.csv-preview {
  max-height: 500px;
  overflow: auto;
}

.judgment-confirmed {
  color: #67c23a;
  font-weight: 600;
}

.judgment-overruled {
  color: #409eff;
  font-weight: 600;
}

.judgment-pending {
  color: #e6a23c;
}
</style>
