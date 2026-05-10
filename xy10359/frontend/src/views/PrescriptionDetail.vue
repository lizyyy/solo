<template>
  <div class="prescription-detail">
    <el-card class="header-card" shadow="never">
      <div class="prescription-header">
        <div class="header-left">
          <el-button @click="goBack" :icon="ArrowLeft" circle />
          <div class="prescription-title">
            <h2>处方详情</h2>
            <span class="prescription-no">{{ prescription?.prescriptionNo }}</span>
          </div>
        </div>
        <div class="header-right">
          <el-tag :type="getStatusType(prescription?.status)" size="large">
            {{ prescription?.status }}
          </el-tag>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><User /></el-icon>
              <span>患者信息</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="姓名">{{ prescription?.patientName }}</el-descriptions-item>
            <el-descriptions-item label="性别">{{ patient?.gender }}</el-descriptions-item>
            <el-descriptions-item label="年龄">{{ patient?.age }}岁</el-descriptions-item>
            <el-descriptions-item label="身份证号">{{ patient?.idCard }}</el-descriptions-item>
            <el-descriptions-item label="过敏史" :span="2">
              <el-tag v-if="!patient?.allergies?.length" type="info" size="small">无</el-tag>
              <span v-else>
                <el-tag
                  v-for="(allergy, idx) in patient?.allergies"
                  :key="idx"
                  :type="allergy.severity === '重度' ? 'danger' : 'warning'"
                  size="small"
                  class="allergy-tag"
                >
                  {{ allergy.drugName }}({{ allergy.severity }})
                </el-tag>
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="既往史" :span="2">
              <el-tag v-if="!patient?.medicalHistory?.length" type="info" size="small">无</el-tag>
              <el-tag v-else v-for="(item, idx) in patient?.medicalHistory" :key="idx" size="small" class="history-tag">
                {{ item }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>问诊记录</span>
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="诊断">
              <span class="diagnosis-text">{{ prescription?.diagnosis }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="开具医生">
              {{ prescription?.doctorName }}{{ prescription?.department ? ` - ${prescription.department}` : '' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="prescription?.consultationRecord?.symptoms" label="症状描述">
              {{ prescription.consultationRecord.symptoms }}
            </el-descriptions-item>
            <el-descriptions-item v-if="prescription?.consultationRecord?.physicalExamination" label="查体">
              {{ prescription.consultationRecord.physicalExamination }}
            </el-descriptions-item>
            <el-descriptions-item v-if="prescription?.consultationRecord?.assistantAdvice" label="医嘱建议">
              {{ prescription.consultationRecord.assistantAdvice }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><MedicineBox /></el-icon>
              <span>处方药品</span>
            </div>
          </template>
          <el-table :data="prescription?.items || []" border>
            <el-table-column prop="drugName" label="药品名称" width="200" />
            <el-table-column prop="dosage" label="剂量" width="100" />
            <el-table-column prop="frequency" label="频次" width="120" />
            <el-table-column prop="quantity" label="数量" width="80">
              <template #default="{ row }">
                {{ row.quantity }}{{ row.unit }}
              </template>
            </el-table-column>
            <el-table-column prop="route" label="给药途径" width="100" />
            <el-table-column prop="instructions" label="用法说明" min-width="150">
              <template #default="{ row }">
                {{ row.instructions || '遵医嘱' }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card v-if="prescription?.risks?.length > 0" class="info-card risk-card" shadow="never">
          <template #header>
            <div class="card-header risk-header">
              <el-icon><Warning /></el-icon>
              <span>风险提示</span>
              <el-tag :type="hasHighRisk ? 'danger' : 'warning'" effect="dark">
                {{ hasHighRisk ? '高风险' : hasMediumRisk ? '中风险' : '低风险' }}
              </el-tag>
            </div>
          </template>
          <el-alert
            v-for="(risk, idx) in prescription?.risks"
            :key="idx"
            :title="risk.category"
            :type="getRiskType(risk.severity)"
            :closable="false"
            show-icon
            class="risk-alert"
          >
            <template #default>
              {{ risk.description }}
            </template>
          </el-alert>
        </el-card>

        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><Clock /></el-icon>
              <span>处理历史</span>
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(history, idx) in sortedHistory"
              :key="idx"
              :timestamp="formatDate(history.timestamp)"
              placement="top"
              :type="getHistoryType(history.action)"
            >
              <el-card class="timeline-card">
                <div class="history-item">
                  <div class="history-header">
                    <el-tag :type="getHistoryTagType(history.action)" size="small">
                      {{ history.action }}
                    </el-tag>
                    <span class="reviewer">操作人：{{ history.reviewer }}</span>
                  </div>
                  <div v-if="history.reason" class="history-reason">
                    <span class="label">原因：</span>{{ history.reason }}
                  </div>
                  <div v-if="history.notes" class="history-notes">
                    <span class="label">备注：</span>{{ history.notes }}
                  </div>
                  <div v-if="history.riskDetails?.length" class="history-risks">
                    <span class="label">涉及风险：</span>
                    <el-tag
                      v-for="(risk, rIdx) in history.riskDetails"
                      :key="rIdx"
                      type="info"
                      size="small"
                      class="risk-tag"
                    >
                      {{ risk.type }}
                    </el-tag>
                  </div>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="action-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><Operation /></el-icon>
              <span>复核操作</span>
            </div>
          </template>

          <div v-if="canReview" class="review-actions">
            <el-form>
              <el-form-item label="复核意见">
                <el-input
                  v-model="reviewReason"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入复核意见（可选）"
                />
              </el-form-item>

              <div class="action-buttons">
                <el-button
                  type="success"
                  size="large"
                  @click="handleReview('通过')"
                  :loading="reviewLoading"
                >
                  <el-icon><CircleCheck /></el-icon>
                  通过
                </el-button>
                <el-button
                  type="warning"
                  size="large"
                  @click="handleReview('需补充')"
                  :loading="reviewLoading"
                >
                  <el-icon><EditPen /></el-icon>
                  需医生补充
                </el-button>
                <el-button
                  type="danger"
                  size="large"
                  @click="handleReview('退回')"
                  :loading="reviewLoading"
                >
                  <el-icon><CircleClose /></el-icon>
                  退回
                </el-button>
              </div>
            </el-form>
          </div>

          <div v-else-if="canResubmit" class="review-actions">
            <el-alert
              title="医生已修正处方，可重新提交复核"
              type="info"
              show-icon
              :closable="false"
            />
            <el-button
              type="primary"
              size="large"
              style="width: 100%; margin-top: 16px"
              @click="handleReview('重新提交')"
              :loading="reviewLoading"
            >
              <el-icon><Refresh /></el-icon>
              重新提交复核
            </el-button>
          </div>

          <div v-else-if="canDispense" class="review-actions">
            <el-alert
              title="处方已通过复核，可以发药"
              type="success"
              show-icon
              :closable="false"
            />
            <el-button
              type="success"
              size="large"
              style="width: 100%; margin-top: 16px"
              @click="handleDispense"
              :loading="reviewLoading"
            >
              <el-icon><Check /></el-icon>
              执行发药
            </el-button>
          </div>

          <div v-else class="no-action">
            <el-empty description="当前状态无需操作" />
          </div>

          <el-divider />

          <div class="quick-info">
            <div class="info-row">
              <span class="label">处方状态</span>
              <el-tag :type="getStatusType(prescription?.status)">{{ prescription?.status }}</el-tag>
            </div>
            <div class="info-row">
              <span class="label">是否可发药</span>
              <el-tag :type="prescription?.canDispense ? 'success' : 'info'">
                {{ prescription?.canDispense ? '是' : '否' }}
              </el-tag>
            </div>
            <div class="info-row">
              <span class="label">创建时间</span>
              <span>{{ formatDate(prescription?.createdAt) }}</span>
            </div>
            <div v-if="prescription?.reviewedAt" class="info-row">
              <span class="label">复核时间</span>
              <span>{{ formatDate(prescription?.reviewedAt) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getPrescriptionById,
  reviewPrescription
} from '../api'
import {
  ArrowLeft,
  User,
  Document,
  MedicineBox,
  Warning,
  Clock,
  Operation,
  CircleCheck,
  EditPen,
  CircleClose,
  Refresh,
  Check
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const prescription = ref(null)
const patient = ref(null)
const loading = ref(false)
const reviewLoading = ref(false)
const reviewReason = ref('')

const hasHighRisk = computed(() => {
  return prescription.value?.risks?.some(r => r.severity === '高') || false
})

const hasMediumRisk = computed(() => {
  return prescription.value?.risks?.some(r => r.severity === '中') || false
})

const sortedHistory = computed(() => {
  if (!prescription.value?.reviewHistory) return []
  return [...prescription.value.reviewHistory].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp)
  })
})

const canReview = computed(() => {
  return prescription.value?.status === '待复核'
})

const canResubmit = computed(() => {
  return prescription.value?.status === '需补充'
})

const canDispense = computed(() => {
  return prescription.value?.status === '已通过' && prescription.value?.canDispense
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

const getRiskType = (severity) => {
  const map = {
    '高': 'error',
    '中': 'warning',
    '低': 'info'
  }
  return map[severity] || 'info'
}

const getHistoryType = (action) => {
  const map = {
    '通过': 'success',
    '退回': 'danger',
    '需补充': 'warning',
    '创建': 'primary',
    '重新提交': 'info',
    '发药': 'success'
  }
  return map[action] || 'primary'
}

const getHistoryTagType = (action) => {
  const map = {
    '通过': 'success',
    '退回': 'danger',
    '需补充': 'warning',
    '创建': 'info',
    '重新提交': 'warning',
    '发药': 'success'
  }
  return map[action] || 'info'
}

const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const loadPrescription = async () => {
  loading.value = true
  try {
    const res = await getPrescriptionById(route.params.id)
    prescription.value = res.data
    patient.value = res.data.patientId
  } catch (error) {
    ElMessage.error('加载处方详情失败')
  } finally {
    loading.value = false
  }
}

const handleReview = async (action) => {
  try {
    let confirmMessage = ''
    switch (action) {
      case '通过':
        confirmMessage = '确认通过该处方？'
        break
      case '退回':
        confirmMessage = '确认退回该处方？请确保已填写退回原因。'
        break
      case '需补充':
        confirmMessage = '确认标记为需医生补充？'
        break
      case '重新提交':
        confirmMessage = '确认重新提交复核？系统将重新校验处方。'
        break
    }

    if (action !== '重新提交') {
      await ElMessageBox.confirm(confirmMessage, '操作确认', {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      })
    }

    reviewLoading.value = true
    await reviewPrescription(route.params.id, {
      action,
      reviewer: '当前药师',
      reason: reviewReason.value || `执行${action}操作`
    })

    ElMessage.success('操作成功')
    reviewReason.value = ''
    await loadPrescription()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.response?.data?.error || '操作失败')
    }
  } finally {
    reviewLoading.value = false
  }
}

const handleDispense = async () => {
  try {
    await ElMessageBox.confirm(
      `确认对处方 ${prescription.value.prescriptionNo} 执行发药？`,
      '发药确认',
      {
        confirmButtonText: '确认发药',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    reviewLoading.value = true
    await reviewPrescription(route.params.id, {
      action: '发药',
      reviewer: '当前药师',
      reason: '处方已通过复核，执行发药'
    })

    ElMessage.success('发药成功')
    await loadPrescription()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.response?.data?.error || '发药失败')
    }
  } finally {
    reviewLoading.value = false
  }
}

const goBack = () => {
  router.push('/prescriptions')
}

onMounted(() => {
  loadPrescription()
})
</script>

<style scoped>
.prescription-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-card {
  border-radius: 8px;
}

.prescription-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.prescription-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.prescription-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.prescription-no {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #909399;
}

.info-card {
  margin-top: 16px;
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.risk-header {
  color: #e6a23c;
}

.risk-card {
  border: 1px solid #fde2e2;
  background: #fef0f0;
}

.risk-alert {
  margin-bottom: 12px;
}

.risk-alert:last-child {
  margin-bottom: 0;
}

.diagnosis-text {
  font-weight: 500;
  color: #606266;
}

.allergy-tag,
.history-tag {
  margin-right: 8px;
  margin-bottom: 4px;
}

.timeline-card {
  padding: 16px;
  border-radius: 8px;
}

.history-item .history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.reviewer {
  font-size: 13px;
  color: #909399;
}

.history-reason,
.history-notes,
.history-risks {
  font-size: 14px;
  margin-bottom: 6px;
}

.history-reason .label,
.history-notes .label,
.history-risks .label {
  color: #909399;
}

.risk-tag {
  margin-right: 4px;
}

.action-card {
  border-radius: 8px;
  position: sticky;
  top: 24px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-buttons .el-button {
  width: 100%;
}

.no-action {
  padding: 40px 0;
}

.quick-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-row .label {
  color: #909399;
  font-size: 14px;
}
</style>
