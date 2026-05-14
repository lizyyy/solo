<template>
  <div class="address-detail">
    <el-page-header @back="goBack" :content="`地址记录 #${addressId}`" />

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card shadow="hover" style="margin-bottom: 20px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>基本信息</span>
              <div style="display: flex; gap: 10px;">
                <el-tag :type="getStatusType(detail.status)" size="large">
                  {{ getStatusText(detail.status) }}
                </el-tag>
                <el-tag v-if="detail.is_failed" type="danger" size="large">处理失败</el-tag>
                <el-tag v-else type="success" size="large">处理正常</el-tag>
              </div>
            </div>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
            <el-descriptions-item label="地理编码版本">{{ detail.geocoding_version }}</el-descriptions-item>
            <el-descriptions-item label="原始地址" :span="2">{{ detail.original_address }}</el-descriptions-item>
            <el-descriptions-item label="地理编码结果" :span="2">
              <div v-if="detail.geocoding_result">
                <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">{{ formatJson(detail.geocoding_result) }}</pre>
              </div>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="候选坐标" :span="2">
              <div v-if="detail.candidate_coordinates">
                <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">{{ formatJson(detail.candidate_coordinates) }}</pre>
              </div>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="配送范围" :span="2">
              <el-tag type="warning" v-if="detail.delivery_range">{{ detail.delivery_range }}</el-tag>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="命中报告" :span="2">{{ detail.hit_report || '-' }}</el-descriptions-item>
            <el-descriptions-item label="失败原因" :span="2" v-if="detail.is_failed">
              <el-alert :title="detail.failure_reason || '未知原因'" type="error" :closable="false" />
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(detail.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatDate(detail.updated_at) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="hover" v-if="detail.manual_correction">
          <template #header>
            <span><el-icon><DocumentChecked /></el-icon> 人工纠偏结果</span>
          </template>
          <el-alert :title="detail.manual_correction" type="success" :closable="false" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover" style="margin-bottom: 20px;">
          <template #header>
            <span><el-icon><Operation /></el-icon> 快速操作</span>
          </template>

          <div style="display: flex; flex-direction: column; gap: 15px;">
            <el-button type="primary" @click="showCorrectionDialog = true" size="large">
              <el-icon><Edit /></el-icon>
              人工纠偏
            </el-button>
            <el-button type="success" @click="showReviewDialog = true" size="large">
              <el-icon><Check /></el-icon>
              复核确认
            </el-button>
            <el-button type="warning" @click="goToEdit" size="large">
              <el-icon><Document /></el-icon>
              编辑记录
            </el-button>
          </div>
        </el-card>

        <el-card shadow="hover">
          <template #header>
            <span><el-icon><InfoFilled /></el-icon> 处理信息</span>
          </template>
          <el-descriptions :column="1">
            <el-descriptions-item label="处理人">{{ detail.processed_by ? `用户 #${detail.processed_by}` : '-' }}</el-descriptions-item>
            <el-descriptions-item label="处理时间">{{ formatDate(detail.processed_at) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px;">
      <template #header>
        <span><el-icon><Timer /></el-icon> 处理链 - 操作日志</span>
      </template>

      <el-timeline>
        <el-timeline-item
          v-for="(log, index) in detail.operations"
          :key="log.id"
          :timestamp="formatDate(log.created_at)"
          placement="top"
          :type="getLogType(log.operation_type)"
          :color="getLogColor(log.operation_type)"
        >
          <template #dot>
            <el-icon :size="20"><component :is="getLogIcon(log.operation_type)" /></el-icon>
          </template>
          <el-card shadow="hover">
            <h4>{{ getLogTitle(log.operation_type) }}</h4>
            <p style="margin: 5px 0;">
              <el-tag type="info" size="small">操作人: {{ log.operator_username }}</el-tag>
            </p>
            <p v-if="log.reason" style="margin: 10px 0; color: #606266;">
              <strong>原因/说明:</strong> {{ log.reason }}
            </p>
            <el-collapse v-if="log.old_value || log.new_value" style="margin-top: 10px;">
              <el-collapse-item title="查看变更详情">
                <el-descriptions :column="1" size="small">
                  <el-descriptions-item label="变更前" v-if="log.old_value">
                    <pre style="margin: 0; white-space: pre-wrap; font-size: 12px;">{{ log.old_value }}</pre>
                  </el-descriptions-item>
                  <el-descriptions-item label="变更后" v-if="log.new_value">
                    <pre style="margin: 0; white-space: pre-wrap; font-size: 12px;">{{ log.new_value }}</pre>
                  </el-descriptions-item>
                </el-descriptions>
              </el-collapse-item>
            </el-collapse>
          </el-card>
        </el-timeline-item>
        <el-timeline-item
          v-if="detail.operations.length === 0"
          timestamp="暂无操作记录"
          type="info"
        >
          <el-empty description="暂无操作记录" :image-size="100" />
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <el-card shadow="hover" style="margin-top: 20px;" v-if="detail.reviews && detail.reviews.length > 0">
      <template #header>
        <span><el-icon><CircleCheck /></el-icon> 复核记录</span>
      </template>
      <el-table :data="detail.reviews" border stripe>
        <el-table-column prop="reviewer_username" label="复核人" width="150" />
        <el-table-column prop="review_result" label="复核结果" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.review_result === 'pass' ? 'success' : 'danger'">
              {{ scope.row.review_result === 'pass' ? '通过' : '不通过' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="review_comment" label="复核意见" show-overflow-tooltip />
        <el-table-column prop="reviewed_at" label="复核时间" width="180">
          <template #default="scope">{{ formatDate(scope.row.reviewed_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCorrectionDialog" title="人工纠偏" width="600px">
      <el-form :model="correctionForm" label-width="100px">
        <el-form-item label="纠偏内容">
          <el-input v-model="correctionForm.manual_correction" type="textarea" :rows="4" placeholder="请输入人工纠偏的地址或说明..." />
        </el-form-item>
        <el-form-item label="纠偏原因">
          <el-input v-model="correctionForm.reason" type="textarea" :rows="3" placeholder="请输入纠偏原因..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCorrectionDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCorrection" :loading="submitting">确认提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showReviewDialog" title="复核确认" width="600px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="复核结果">
          <el-radio-group v-model="reviewForm.review_result">
            <el-radio label="pass">通过</el-radio>
            <el-radio label="fail">不通过</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="复核意见">
          <el-input v-model="reviewForm.review_comment" type="textarea" :rows="3" placeholder="请输入复核意见..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReviewDialog = false">取消</el-button>
        <el-button type="primary" @click="submitReview" :loading="submitting">确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Edit, Check, Document, Timer, InfoFilled, Operation, DocumentChecked,
  Plus, Refresh, Search, CircleCheck
} from '@element-plus/icons-vue'
import { getAddressDetail, manualCorrection, reviewAddress } from '@/api/address'

const route = useRoute()
const router = useRouter()
const addressId = ref(route.params.id)
const detail = ref({})
const loading = ref(false)
const showCorrectionDialog = ref(false)
const showReviewDialog = ref(false)
const submitting = ref(false)

const correctionForm = ref({ manual_correction: '', reason: '' })
const reviewForm = ref({ review_result: 'pass', review_comment: '' })

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

const formatJson = (str) => {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

const getStatusType = (status) => {
  const typeMap = { pending: 'info', matched: 'success', corrected: 'warning', reviewed: 'success', failed: 'danger' }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = { pending: '待处理', matched: '已匹配', corrected: '已修正', reviewed: '已复核', failed: '失败' }
  return textMap[status] || status
}

const getLogType = (type) => {
  const typeMap = { create: 'primary', update: 'warning', manual_correction: 'success', review: 'info', compare: 'info', recalculate: 'warning' }
  return typeMap[type] || 'info'
}

const getLogColor = (type) => {
  const colorMap = { create: '#409EFF', update: '#E6A23C', manual_correction: '#67C23A', review: '#909399', compare: '#909399', recalculate: '#E6A23C' }
  return colorMap[type] || '#909399'
}

const getLogIcon = (type) => {
  const iconMap = { create: Plus, update: Edit, manual_correction: DocumentChecked, review: CircleCheck, compare: Search, recalculate: Refresh }
  return iconMap[type] || InfoFilled
}

const getLogTitle = (type) => {
  const titleMap = { create: '创建记录', update: '更新记录', manual_correction: '人工纠偏', review: '复核记录', compare: '地址比对', recalculate: '重新计算' }
  return titleMap[type] || type
}

const fetchDetail = async () => {
  loading.value = true
  try {
    detail.value = await getAddressDetail(addressId.value)
    if (!detail.value.operations) detail.value.operations = []
    if (!detail.value.reviews) detail.value.reviews = []
  } catch (error) {
    console.error('获取详情失败:', error)
  } finally {
    loading.value = false
  }
}

const submitCorrection = async () => {
  if (!correctionForm.value.manual_correction.trim()) {
    ElMessage.warning('请输入纠偏内容')
    return
  }
  submitting.value = true
  try {
    await manualCorrection(addressId.value, correctionForm.value)
    ElMessage.success('人工纠偏提交成功')
    showCorrectionDialog.value = false
    correctionForm.value = { manual_correction: '', reason: '' }
    fetchDetail()
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

const submitReview = async () => {
  submitting.value = true
  try {
    await reviewAddress(addressId.value, reviewForm.value)
    ElMessage.success('复核提交成功')
    showReviewDialog.value = false
    reviewForm.value = { review_result: 'pass', review_comment: '' }
    fetchDetail()
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  router.back()
}

const goToEdit = () => {
  router.push(`/edit/${addressId.value}`)
}

onMounted(() => {
  fetchDetail()
})
</script>

<style scoped>
.address-detail {
  padding-bottom: 30px;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #303133;
}
</style>
