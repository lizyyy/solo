<template>
  <div class="batch-detail">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <div class="title">批次详情 - {{ batch?.batchNo }}</div>
          <div class="header-actions">
            <el-button @click="goToScan">
              <el-icon><Camera /></el-icon>
              扫码操作
            </el-button>
            <el-button type="primary" @click="editBatch">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" v-if="batch">
        <el-col :span="8">
          <el-card shadow="hover">
            <div class="batch-basic">
              <div class="batch-status" :class="`status-${batch.status}`">
                <el-icon :size="48"><ShoppingBag /></el-icon>
                <div class="status-text">{{ getStatusLabel(batch.status) }}</div>
              </div>
              <el-progress
                style="margin-top: 20px;"
                :percentage="stockPercent"
                :status="batch.status === 'expired' ? 'exception' : ''"
                :stroke-width="12"
              />
              <div class="stock-info">
                <div class="stock-item">
                  <div class="stock-num">{{ batch.remainingQuantity }}</div>
                  <div class="stock-label">剩余</div>
                </div>
                <div class="stock-item">
                  <div class="stock-num">{{ batch.usedQuantity }}</div>
                  <div class="stock-label">已用</div>
                </div>
                <div class="stock-item">
                  <div class="stock-num">{{ batch.totalQuantity }}</div>
                  <div class="stock-label">总数</div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="16">
          <el-descriptions title="批次信息" :column="2" border>
            <el-descriptions-item label="批次号" :span="2">{{ batch.batchNo }}</el-descriptions-item>
            <el-descriptions-item label="二维码" :span="2">
              <el-tag size="large">{{ batch.qrCode }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="试剂名称">{{ batch.reagent?.name }}</el-descriptions-item>
            <el-descriptions-item label="试剂编码">{{ batch.reagent?.code }}</el-descriptions-item>
            <el-descriptions-item label="生产厂家" :span="2">{{ batch.manufacturer || '-' }}</el-descriptions-item>
            <el-descriptions-item label="生产日期">{{ batch.productionDate }}</el-descriptions-item>
            <el-descriptions-item label="有效期">
              <span :class="{ 'text-danger': batch.status === 'expired' || batch.status === 'expiring' }">
                {{ batch.expiryDate }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="存储位置" :span="2">{{ batch.storageLocation || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px;">
      <template #header>
        <div class="card-header">
          <span>操作历史追踪</span>
          <el-tag type="info">共 {{ history.timeline?.length || 0 }} 条记录</el-tag>
        </div>
      </template>

      <el-timeline v-if="history.timeline && history.timeline.length > 0">
        <el-timeline-item
          v-for="(item, index) in history.timeline"
          :key="item.id"
          :timestamp="formatTime(item.createdAt)"
          :type="getTimelineType(item.type)"
          :icon="getTimelineIcon(item.type)"
          placement="top"
        >
          <el-card shadow="hover" class="timeline-card">
            <div class="timeline-header">
              <el-tag :type="getTagType(item.type)" size="large">
                #{{ item.sequence }} {{ item.typeLabel || item.type }}
              </el-tag>
              <span class="operator">操作人：{{ item.operator }}</span>
            </div>
            <el-row :gutter="10" style="margin-top: 12px;">
              <el-col :span="6">
                <div class="timeline-label">数量</div>
                <div class="timeline-value">{{ item.quantity }}</div>
              </el-col>
              <el-col :span="6">
                <div class="timeline-label">地点</div>
                <div class="timeline-value">{{ item.location }}</div>
              </el-col>
              <el-col :span="12">
                <div class="timeline-label">扫码</div>
                <div class="timeline-value">{{ item.scanCode }}</div>
              </el-col>
            </el-row>
            <div v-if="item.remark" class="timeline-remark">
              <el-icon><InfoFilled /></el-icon>
              备注：{{ item.remark }}
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无操作记录" />
    </el-card>

    <el-dialog
      v-model="operationVisible"
      title="新增操作记录"
      width="500px"
    >
      <el-form ref="opFormRef" :model="opForm" :rules="opRules" label-width="80px">
        <el-form-item label="操作类型" prop="type">
          <el-select v-model="opForm.type" placeholder="请选择" style="width: 100%;">
            <el-option label="开封" value="open" />
            <el-option label="领用" value="claim" />
            <el-option label="分装" value="subpackage" />
            <el-option label="归还" value="return" />
            <el-option label="报废" value="discard" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number v-model="opForm.quantity" :min="1" :max="batch?.remainingQuantity || 9999" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="操作员" prop="operator">
          <el-input v-model="opForm.operator" placeholder="请输入操作员姓名" />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="opForm.location" placeholder="操作地点" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="opForm.remark" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="operationVisible = false">取消</el-button>
        <el-button type="primary" @click="submitOperation" :loading="opSubmitting">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getBatchDetail } from '../api/batch'
import { getBatchHistory, createRecord } from '../api/record'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const batch = ref(null)
const history = ref({ timeline: [] })
const operationVisible = ref(false)
const opSubmitting = ref(false)
const opFormRef = ref(null)

const opForm = reactive({
  type: '',
  quantity: 1,
  operator: '',
  location: '',
  remark: ''
})

const opRules = {
  type: [{ required: true, message: '请选择操作类型', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'change' }],
  operator: [{ required: true, message: '请输入操作员', trigger: 'blur' }]
}

const stockPercent = computed(() => {
  if (!batch.value) return 0
  return Math.round((batch.value.remainingQuantity / batch.value.totalQuantity) * 100)
})

const statusMap = {
  in_stock: { label: '正常库存', type: 'success' },
  low_stock: { label: '库存不足', type: 'warning' },
  expiring: { label: '即将过期', type: 'warning' },
  expired: { label: '已过期', type: 'danger' },
  empty: { label: '已空库', type: 'info' }
}

const operationIconMap = {
  stock_in: 'CircleCheck',
  open: 'Opened',
  claim: 'Document',
  subpackage: 'Share',
  return: 'Refresh',
  discard: 'Delete'
}

const operationTypeMap = {
  stock_in: 'success',
  open: 'info',
  claim: 'primary',
  subpackage: 'warning',
  return: 'info',
  discard: 'danger'
}

function getStatusLabel(status) {
  return statusMap[status]?.label || status
}

function getTimelineType(type) {
  return operationTypeMap[type] || 'primary'
}

function getTimelineIcon(type) {
  return operationIconMap[type] || 'Document'
}

function getTagType(type) {
  return operationTypeMap[type] || ''
}

function formatTime(time) {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

async function fetchDetail() {
  try {
    const res = await getBatchDetail(route.params.id)
    batch.value = res.data
  } catch (e) {
    console.error(e)
  }
}

async function fetchHistory() {
  try {
    const res = await getBatchHistory(route.params.id)
    history.value = res.data || { timeline: [] }
  } catch (e) {
    console.error(e)
  }
}

function goBack() {
  router.push('/batches')
}

function goToScan() {
  router.push({ path: '/scan', query: { code: batch.value?.qrCode } })
}

function editBatch() {
  router.push('/batches')
}

function resetOpForm() {
  opForm.type = ''
  opForm.quantity = 1
  opForm.operator = ''
  opForm.location = ''
  opForm.remark = ''
}

async function submitOperation() {
  if (!opFormRef.value) return
  await opFormRef.value.validate()

  opSubmitting.value = true
  try {
    await createRecord({
      batchId: batch.value.id,
      type: opForm.type,
      quantity: opForm.quantity,
      operator: opForm.operator,
      location: opForm.location,
      remark: opForm.remark
    })
    ElMessage.success('操作成功')
    operationVisible.value = false
    resetOpForm()
    fetchDetail()
    fetchHistory()
  } catch (e) {
    console.error(e)
  } finally {
    opSubmitting.value = false
  }
}

onMounted(() => {
  fetchDetail()
  fetchHistory()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 16px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.batch-basic {
  text-align: center;
  padding: 20px 0;
}

.batch-status {
  padding: 20px 0;
  color: #67c23a;
}

.batch-status.status-low_stock,
.batch-status.status-expiring {
  color: #e6a23c;
}

.batch-status.status-expired,
.batch-status.status-empty {
  color: #f56c6c;
}

.status-text {
  font-size: 16px;
  font-weight: 500;
  margin-top: 8px;
}

.stock-info {
  display: flex;
  justify-content: space-around;
  margin-top: 16px;
}

.stock-item {
  text-align: center;
}

.stock-num {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stock-label {
  font-size: 12px;
  color: #909399;
}

.text-danger {
  color: #f56c6c;
  font-weight: 500;
}

.timeline-card {
  margin-bottom: 8px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.operator {
  font-size: 13px;
  color: #909399;
}

.timeline-label {
  font-size: 12px;
  color: #909399;
}

.timeline-value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-top: 4px;
}

.timeline-remark {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
