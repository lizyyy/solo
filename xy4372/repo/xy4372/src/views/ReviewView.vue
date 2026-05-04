<template>
  <div class="page-container">
    <h2 class="page-title">风险复核</h2>

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
      <el-row :gutter="20" style="margin-bottom: 24px;">
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value" :style="{ color: risksBySeverity.critical > 0 ? '#f56c6c' : '#67c23a' }">
              {{ risksBySeverity.critical }}
            </div>
            <div class="stat-label">严重风险</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value" :style="{ color: risksBySeverity.high > 0 ? '#e6a23c' : '#67c23a' }">
              {{ risksBySeverity.high }}
            </div>
            <div class="stat-label">高风险</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value">{{ appStore.reviewStats.confirmed + appStore.reviewStats.overruled }}</div>
            <div class="stat-label">已复核</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-value">{{ appStore.reviewStats.pending }}</div>
            <div class="stat-label">待复核</div>
          </el-card>
        </el-col>
      </el-row>

      <div class="action-bar">
        <el-select
          v-model="filterType"
          placeholder="按风险类型筛选"
          clearable
          style="width: 200px;"
        >
          <el-option
            v-for="(label, type) in riskTypeLabels"
            :key="type"
            :label="label"
            :value="type"
          />
        </el-select>
        <el-select
          v-model="filterSeverity"
          placeholder="按严重程度筛选"
          clearable
          style="width: 150px;"
        >
          <el-option label="严重" value="critical" />
          <el-option label="高" value="high" />
          <el-option label="中" value="medium" />
          <el-option label="低" value="low" />
        </el-select>
        <el-select
          v-model="filterReviewStatus"
          placeholder="按复核状态筛选"
          clearable
          style="width: 150px;"
        >
          <el-option label="已复核" value="reviewed" />
          <el-option label="待复核" value="pending" />
        </el-select>
        <div class="action-bar-right">
          <el-button @click="handleBatchConfirm">
            <el-icon><Check /></el-icon>
            全部确认风险
          </el-button>
          <el-button type="primary" @click="router.push('/export')" :disabled="hasCriticalUnresolved">
            <el-icon><Download /></el-icon>
            导出报告
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="hasCriticalUnresolved"
        title="存在未解决的严重风险"
        type="error"
        show-icon
        style="margin-bottom: 16px;"
      >
        仍有严重风险未处理或未被推翻，无法导出报告。请先处理所有严重风险。
      </el-alert>

      <div v-if="filteredRisks.length === 0" class="empty-state">
        <el-empty description="暂无风险记录">
          <el-button type="primary" @click="router.push('/import')">前往数据导入</el-button>
        </el-empty>
      </div>

      <div v-else class="risks-list">
        <el-collapse v-model="expandedRisks">
          <el-collapse-item
            v-for="risk in filteredRisks"
            :key="risk.id"
            :name="risk.id"
          >
            <template #title>
              <div class="risk-header">
                <div class="risk-info-left">
                  <el-tag
                    :type="getSeverityTagType(risk.severity)"
                    size="small"
                    effect="dark"
                  >
                    {{ severityLabels[risk.severity] }}
                  </el-tag>
                  <el-tag size="small" type="info">
                    {{ riskTypeLabels[risk.type] }}
                  </el-tag>
                  <span class="horse-info">
                    <el-icon><User /></el-icon>
                    {{ risk.horseName || risk.horseNumber }}
                  </span>
                </div>
                <div class="risk-info-right">
                  <span v-if="risk.raceName" class="race-info">
                    <el-icon><Calendar /></el-icon>
                    {{ risk.raceName }}
                  </span>
                  <el-tag
                    v-if="getReviewStatus(risk.id) === 'confirmed'"
                    type="success"
                    size="small"
                  >
                    已确认
                  </el-tag>
                  <el-tag
                    v-else-if="getReviewStatus(risk.id) === 'overruled'"
                    type="info"
                    size="small"
                  >
                    已推翻
                  </el-tag>
                  <el-tag
                    v-else
                    type="warning"
                    size="small"
                  >
                    待复核
                  </el-tag>
                </div>
              </div>
            </template>

            <div class="risk-detail">
              <div class="risk-description">
                <h4>风险详情</h4>
                <p>{{ risk.description }}</p>
              </div>

              <el-divider />

              <div class="risk-meta">
                <el-descriptions :column="3" border size="small">
                  <el-descriptions-item label="马匹编号">
                    {{ risk.horseNumber }}
                  </el-descriptions-item>
                  <el-descriptions-item label="马匹名称">
                    {{ risk.horseName || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="检测时间">
                    {{ formatDateTime(risk.detectedAt) }}
                  </el-descriptions-item>
                  <el-descriptions-item v-if="risk.raceNumber" label="场次编号">
                    {{ risk.raceNumber }}
                  </el-descriptions-item>
                  <el-descriptions-item v-if="risk.raceName" label="场次名称">
                    {{ risk.raceName }}
                  </el-descriptions-item>
                  <el-descriptions-item v-if="risk.tackNumber" label="鞍具编号">
                    {{ risk.tackNumber }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>

              <el-divider />

              <div class="review-section">
                <h4>教练复核</h4>
                <el-form
                  :model="getReviewForm(risk.id)"
                  label-width="100px"
                  class="review-form"
                >
                  <el-form-item label="教练判定">
                    <el-radio-group v-model="getReviewForm(risk.id).coachJudgment">
                      <el-radio value="confirmed">
                        <el-tag type="success" size="small">确认风险</el-tag>
                      </el-radio>
                      <el-radio value="overruled">
                        <el-tag type="info" size="small">推翻判定</el-tag>
                      </el-radio>
                      <el-radio value="pending">
                        <el-tag type="warning" size="small">待复核</el-tag>
                      </el-radio>
                    </el-radio-group>
                  </el-form-item>
                  <el-form-item label="教练备注">
                    <el-input
                      v-model="getReviewForm(risk.id).coachNotes"
                      type="textarea"
                      :rows="2"
                      placeholder="请输入复核备注..."
                    />
                  </el-form-item>
                  <el-form-item label="处理措施">
                    <el-input
                      v-model="getReviewForm(risk.id).actionTaken"
                      type="textarea"
                      :rows="2"
                      placeholder="请输入已采取的处理措施..."
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="handleSaveReview(risk)">
                      保存复核
                    </el-button>
                    <el-button @click="handleResetReview(risk.id)">
                      重置
                    </el-button>
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  User,
  Calendar,
  Check,
  Download,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores'
import type { Risk, ReviewRecord } from '@/types'
import { riskTypeLabels, severityLabels } from '@/utils/riskDetector'

const router = useRouter()
const appStore = useAppStore()

const expandedRisks = ref<string[]>([])
const filterType = ref<string>('')
const filterSeverity = ref<string>('')
const filterReviewStatus = ref<string>('')

const reviewForms = reactive<Record<string, {
  coachJudgment: 'confirmed' | 'overruled' | 'pending'
  coachNotes: string
  actionTaken: string
}>>({})

const filteredRisks = computed(() => {
  let risks = [...appStore.sessionData.risks]

  if (filterType.value) {
    risks = risks.filter(r => r.type === filterType.value)
  }

  if (filterSeverity.value) {
    risks = risks.filter(r => r.severity === filterSeverity.value)
  }

  if (filterReviewStatus.value) {
    risks = risks.filter(r => {
      const status = getReviewStatus(r.id)
      if (filterReviewStatus.value === 'reviewed') {
        return status === 'confirmed' || status === 'overruled'
      }
      return status === 'pending'
    })
  }

  return risks.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
})

const risksBySeverity = computed(() => appStore.risksBySeverity)
const hasCriticalUnresolved = computed(() => appStore.hasCriticalUnresolved)

function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSeverityTagType(severity: string): string {
  switch (severity) {
    case 'critical': return 'danger'
    case 'high': return 'warning'
    case 'medium': return ''
    case 'low': return 'info'
    default: return 'info'
  }
}

function getReviewStatus(riskId: string): 'confirmed' | 'overruled' | 'pending' {
  const existing = appStore.sessionData.reviewRecords.find(r => r.riskId === riskId)
  if (existing) {
    return existing.coachJudgment
  }
  return 'pending'
}

function getReviewForm(riskId: string): {
  coachJudgment: 'confirmed' | 'overruled' | 'pending'
  coachNotes: string
  actionTaken: string
} {
  if (!reviewForms[riskId]) {
    const existing = appStore.sessionData.reviewRecords.find(r => r.riskId === riskId)
    reviewForms[riskId] = {
      coachJudgment: existing?.coachJudgment || 'pending',
      coachNotes: existing?.coachNotes || '',
      actionTaken: existing?.actionTaken || '',
    }
  }
  return reviewForms[riskId]
}

function handleResetReview(riskId: string): void {
  const existing = appStore.sessionData.reviewRecords.find(r => r.riskId === riskId)
  reviewForms[riskId] = {
    coachJudgment: existing?.coachJudgment || 'pending',
    coachNotes: existing?.coachNotes || '',
    actionTaken: existing?.actionTaken || '',
  }
  ElMessage.info('已重置为上次保存状态')
}

async function handleSaveReview(risk: Risk): Promise<void> {
  const form = reviewForms[risk.id]
  if (!form) return

  const existingIndex = appStore.sessionData.reviewRecords.findIndex(r => r.riskId === risk.id)
  const now = new Date().toISOString()

  const reviewRecord: ReviewRecord = {
    id: existingIndex >= 0 ? appStore.sessionData.reviewRecords[existingIndex].id : crypto.randomUUID(),
    sessionId: appStore.currentSessionId!,
    riskId: risk.id,
    riskType: risk.type,
    horseNumber: risk.horseNumber,
    horseName: risk.horseName || '',
    originalAssessment: risk.severity === 'critical' || risk.severity === 'high' ? 'violation' : 'suspicious',
    coachJudgment: form.coachJudgment,
    coachNotes: form.coachNotes,
    actionTaken: form.actionTaken,
    reviewedAt: now,
    reviewedBy: '当前教练',
  }

  let newRecords: ReviewRecord[]
  if (existingIndex >= 0) {
    newRecords = [...appStore.sessionData.reviewRecords]
    newRecords[existingIndex] = reviewRecord
  } else {
    newRecords = [...appStore.sessionData.reviewRecords, reviewRecord]
  }

  await appStore.saveCurrentReviewRecords(newRecords)
  ElMessage.success('复核已保存')
}

async function handleBatchConfirm(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要将所有待复核的风险标记为"已确认"吗？此操作可以后续修改。',
      '批量确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    const pendingRisks = appStore.sessionData.risks.filter(r => getReviewStatus(r.id) === 'pending')
    const now = new Date().toISOString()
    const newRecords = [...appStore.sessionData.reviewRecords]

    for (const risk of pendingRisks) {
      const reviewRecord: ReviewRecord = {
        id: crypto.randomUUID(),
        sessionId: appStore.currentSessionId!,
        riskId: risk.id,
        riskType: risk.type,
        horseNumber: risk.horseNumber,
        horseName: risk.horseName || '',
        originalAssessment: risk.severity === 'critical' || risk.severity === 'high' ? 'violation' : 'suspicious',
        coachJudgment: 'confirmed',
        coachNotes: '',
        actionTaken: '',
        reviewedAt: now,
        reviewedBy: '当前教练',
      }
      newRecords.push(reviewRecord)
    }

    await appStore.saveCurrentReviewRecords(newRecords)
    ElMessage.success(`已确认 ${pendingRisks.length} 个风险`)
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  if (appStore.currentSessionId) {
    appStore.loadCurrentSessionData()
  }
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

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.risk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.risk-info-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.risk-info-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.horse-info,
.race-info {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #606266;
  font-size: 13px;
}

.risk-detail {
  padding: 16px 0;
}

.risk-description h4 {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.risk-description p {
  color: #606266;
  line-height: 1.6;
  margin: 0;
}

.risk-meta {
  margin: 16px 0;
}

.review-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.review-form {
  max-width: 600px;
}

.empty-state {
  text-align: center;
  padding: 40px;
}

:deep(.el-collapse-item__header) {
  align-items: center;
}
</style>
