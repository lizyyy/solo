<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useSessionStore } from '@/stores/session'
import { runAllChecks, ISSUE_TYPE_NAMES, ISSUE_TYPE_COLORS } from '@/utils/checker'
import type { Issue, IssueType, LabRules } from '@/types'

const router = useRouter()
const sessionStore = useSessionStore()

const isChecking = ref(false)
const checkComplete = ref(sessionStore.issues.length > 0)
const checkedIssues = ref<Issue[]>([])
const checkSummary = ref<{
  totalSamples: number
  totalIssues: number
  byType: Record<IssueType, number>
  bySeverity: { error: number; warning: number; info: number }
} | null>(null)

const filterType = ref<IssueType | 'all'>('all')
const filterSeverity = ref<'error' | 'warning' | 'info' | 'all'>('all')

const defaultRules: LabRules = {
  id: 'default',
  version: '1.0',
  effectiveDate: new Date().toISOString().split('T')[0],
  allowedTestTypes: [
    '主量元素', '微量元素', '稀土元素', '同位素',
    '年龄测定', '薄片鉴定', '重矿物分析', '化学分析',
    'XRF', 'ICP-MS', 'ICP-AES', '碳硫分析'
  ],
  maxDriftMeters: 50,
  refrigerationTimeLimitHours: 72,
  frozenTimeLimitHours: 168,
  sampleTypeRules: [],
}

const filteredIssues = computed(() => {
  let issues = checkComplete.value ? sessionStore.issues : checkedIssues.value
  
  if (filterType.value !== 'all') {
    issues = issues.filter(i => i.type === filterType.value)
  }
  
  if (filterSeverity.value !== 'all') {
    issues = issues.filter(i => i.severity === filterSeverity.value)
  }
  
  return issues
})

const typeOptions = computed(() => [
  { label: '全部类型', value: 'all' },
  ...Object.entries(ISSUE_TYPE_NAMES).map(([key, name]) => ({
    label: name,
    value: key as IssueType,
  })),
])

const severityOptions = [
  { label: '全部等级', value: 'all' },
  { label: '错误', value: 'error' },
  { label: '警告', value: 'warning' },
  { label: '信息', value: 'info' },
]

onMounted(() => {
  if (sessionStore.issues.length > 0) {
    checkComplete.value = true
    const byType: Record<IssueType, number> = {
      missing_transfer: 0,
      coordinate_drift: 0,
      duplicate_number: 0,
      timeout_not_refrigerated: 0,
      invalid_test_items: 0,
    }
    const bySeverity = { error: 0, warning: 0, info: 0 }
    for (const issue of sessionStore.issues) {
      byType[issue.type]++
      bySeverity[issue.severity]++
    }
    checkSummary.value = {
      totalSamples: sessionStore.samples.length,
      totalIssues: sessionStore.issues.length,
      byType,
      bySeverity,
    }
  }
})

async function runCheck() {
  if (sessionStore.samples.length === 0) {
    ElMessage.warning('请先导入样品数据')
    return
  }

  isChecking.value = true
  
  try {
    const rules = sessionStore.labRules || defaultRules
    
    const result = runAllChecks(
      sessionStore.samples,
      sessionStore.gpsPoints,
      sessionStore.transferRecords,
      rules
    )
    
    checkedIssues.value = result.issues
    checkSummary.value = result.summary
    
    await sessionStore.saveIssues(result.issues)
    await sessionStore.updateSessionStatus('checking')
    
    checkComplete.value = true
    ElMessage.success(`检测完成，发现 ${result.issues.length} 个问题`)
  } catch (error) {
    ElMessage.error(`检测失败: ${(error as Error).message}`)
  } finally {
    isChecking.value = false
  }
}

function getSeverityTag(severity: string) {
  const map: Record<string, { text: string; type: string }> = {
    error: { text: '错误', type: 'danger' },
    warning: { text: '警告', type: 'warning' },
    info: { text: '信息', type: 'info' },
  }
  return map[severity] || { text: severity, type: 'info' }
}

function goToReview() {
  const sessionId = sessionStore.currentSession?.id
  if (sessionId) {
    router.push(`/session/${sessionId}/review`)
  }
}

function goBackToImport() {
  const sessionId = sessionStore.currentSession?.id
  if (sessionId) {
    router.push(`/session/${sessionId}/import`)
  }
}
</script>

<template>
  <div class="check-view">
    <el-card v-if="!checkComplete" class="intro-card">
      <template #header>
        <span>自动检测</span>
      </template>
      
      <div class="check-intro">
        <el-icon class="intro-icon"><Search /></el-icon>
        <h3>准备好进行自动检测</h3>
        <p>系统将根据导入的数据自动检测以下问题：</p>
        
        <div class="check-items">
          <div class="check-item">
            <el-icon style="color: #f56c6c"><Warning /></el-icon>
            <div>
              <strong>漏交样品</strong>
              <p>对比二维码清单和交接记录，找出未交接的样品</p>
            </div>
          </div>
          <div class="check-item">
            <el-icon style="color: #e6a23c"><Location /></el-icon>
            <div>
              <strong>坐标漂移</strong>
              <p>对比样品坐标和GPS采样点，检测超出阈值的漂移</p>
            </div>
          </div>
          <div class="check-item">
            <el-icon style="color: #f56c6c"><DocumentCopy /></el-icon>
            <div>
              <strong>编号重复</strong>
              <p>检测样品清单中是否存在重复的样品编号</p>
            </div>
          </div>
          <div class="check-item">
            <el-icon style="color: #f56c6c"><Clock /></el-icon>
            <div>
              <strong>超时未冷藏</strong>
              <p>检查需要冷藏/冷冻的样品是否超时</p>
            </div>
          </div>
          <div class="check-item">
            <el-icon style="color: #409eff"><HelpFilled /></el-icon>
            <div>
              <strong>检测项目不符</strong>
              <p>检查检测项目是否符合实验室收样规则</p>
            </div>
          </div>
        </div>

        <div class="action-buttons">
          <el-button @click="goBackToImport">返回导入</el-button>
          <el-button type="primary" size="large" :loading="isChecking" @click="runCheck">
            <el-icon v-if="!isChecking"><VideoPlay /></el-icon>
            {{ isChecking ? '检测中...' : '开始检测' }}
          </el-button>
        </div>
      </div>
    </el-card>

    <template v-else>
      <el-card class="summary-card">
        <template #header>
          <span>检测结果汇总</span>
          <el-button text @click="runCheck">
            <el-icon><Refresh /></el-icon>
            重新检测
          </el-button>
        </template>
        
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">样品总数</div>
            <div class="summary-value">{{ checkSummary?.totalSamples || 0 }}</div>
          </div>
          <div class="summary-item highlight">
            <div class="summary-label">发现问题</div>
            <div class="summary-value">{{ checkSummary?.totalIssues || 0 }}</div>
          </div>
          <div class="summary-item error">
            <div class="summary-label">错误</div>
            <div class="summary-value">{{ checkSummary?.bySeverity.error || 0 }}</div>
          </div>
          <div class="summary-item warning">
            <div class="summary-label">警告</div>
            <div class="summary-value">{{ checkSummary?.bySeverity.warning || 0 }}</div>
          </div>
        </div>

        <div class="type-breakdown" v-if="checkSummary">
          <div
            v-for="(count, type) in checkSummary.byType"
            :key="type"
            class="type-item"
            :class="{ active: count > 0 }"
          >
            <div class="type-dot" :style="{ backgroundColor: ISSUE_TYPE_COLORS[type as IssueType] }"></div>
            <span class="type-name">{{ ISSUE_TYPE_NAMES[type as IssueType] }}</span>
            <span class="type-count">{{ count }}</span>
          </div>
        </div>
      </el-card>

      <el-card class="issues-card">
        <template #header>
          <div class="header-actions">
            <span>问题列表</span>
            <div class="filters">
              <el-select v-model="filterType" size="small" style="width: 140px">
                <el-option
                  v-for="option in typeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-select v-model="filterSeverity" size="small" style="width: 120px">
                <el-option
                  v-for="option in severityOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </div>
          </div>
        </template>

        <el-table
          :data="filteredIssues"
          style="width: 100%"
          v-loading="isChecking"
        >
          <el-table-column prop="sampleNumber" label="样品编号" width="140" fixed>
            <template #default="{ row }">
              <strong>{{ row.sampleNumber }}</strong>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="问题类型" width="140">
            <template #default="{ row }">
              <el-tag :color="ISSUE_TYPE_COLORS[row.type]" effect="dark" size="small">
                {{ ISSUE_TYPE_NAMES[row.type] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="severity" label="严重程度" width="100">
            <template #default="{ row }">
              <el-tag :type="getSeverityTag(row.severity).type as any" size="small">
                {{ getSeverityTag(row.severity).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="问题标题" min-width="200" />
          <el-table-column prop="description" label="详细描述" min-width="300">
            <template #default="{ row }">
              <el-tooltip :content="row.description" placement="top" :disabled="row.description.length < 100">
                <span>{{ row.description.length > 100 ? row.description.slice(0, 100) + '...' : row.description }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column prop="detectedAt" label="检测时间" width="160">
            <template #default="{ row }">
              {{ new Date(row.detectedAt).toLocaleString('zh-CN') }}
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="filteredIssues.length === 0" description="没有符合条件的问题" />
      </el-card>

      <div class="action-footer">
        <el-button @click="goBackToImport">返回导入</el-button>
        <el-button type="primary" size="large" @click="goToReview">
          下一步：队长复核
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.check-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.intro-card {
  max-width: 800px;
  margin: 0 auto;
}

.check-intro {
  text-align: center;
  padding: 20px;
}

.intro-icon {
  font-size: 64px;
  color: #409eff;
  margin-bottom: 20px;
}

.check-intro h3 {
  font-size: 20px;
  color: #303133;
  margin-bottom: 12px;
}

.check-intro p {
  color: #606266;
  margin-bottom: 32px;
}

.check-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  text-align: left;
  margin-bottom: 32px;
}

.check-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.check-item strong {
  display: block;
  color: #303133;
  margin-bottom: 4px;
}

.check-item p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.summary-card .header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.summary-item {
  text-align: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.summary-item.highlight {
  background: #ecf5ff;
}

.summary-item.error {
  background: #fef0f0;
}

.summary-item.warning {
  background: #fdf6ec;
}

.summary-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
}

.type-breakdown {
  display: flex;
  gap: 24px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.5;
}

.type-item.active {
  opacity: 1;
}

.type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.type-name {
  font-size: 14px;
  color: #606266;
}

.type-count {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.filters {
  display: flex;
  gap: 12px;
}

.action-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}
</style>
