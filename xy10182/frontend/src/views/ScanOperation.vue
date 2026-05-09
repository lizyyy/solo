<template>
  <div class="scan-operation">
    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>
            <div class="card-title">扫码操作</div>
          </template>

          <el-form ref="formRef" :model="formData" :rules="formRules" label-width="90px">
            <el-form-item label="扫码标识" prop="scanCode">
              <el-input
                v-model="formData.scanCode"
                placeholder="请扫码或输入二维码标识"
                size="large"
                clearable
                @keyup.enter="handleQuery"
              >
                <template #append>
                  <el-button @click="handleQuery" :disabled="!formData.scanCode">
                    <el-icon><Search /></el-icon>
                    查询
                  </el-button>
                </template>
              </el-input>
              <div class="example-codes" style="margin-top: 8px;">
                <span class="hint">示例：</span>
                <el-tag
                  v-for="code in exampleCodes"
                  :key="code"
                  size="small"
                  style="margin-right: 4px; cursor: pointer;"
                  @click="selectCode(code)"
                >
                  {{ code }}
                </el-tag>
              </div>
            </el-form-item>
          </el-form>

          <el-card v-if="batchInfo" shadow="hover" class="batch-card">
            <template #header>
              <div class="batch-header">
                <span :class="`status-label status-${batchInfo.status}`">
                  {{ getStatusLabel(batchInfo.status) }}
                </span>
                <span class="batch-no">{{ batchInfo.batchNo }}</span>
              </div>
            </template>

            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="试剂">
                {{ batchInfo.reagent?.name || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="生产厂家">
                {{ batchInfo.manufacturer || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="有效期">
                <span :class="{ 'text-danger': batchInfo.status === 'expired' || batchInfo.status === 'expiring' }">
                  {{ batchInfo.expiryDate }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="库存">
                <div>
                  <el-progress
                    :percentage="stockPercent"
                    :status="batchInfo.status === 'expired' ? 'exception' : ''"
                    :stroke-width="10"
                  />
                  <div class="stock-detail">
                    剩余 {{ batchInfo.remainingQuantity }} / {{ batchInfo.totalQuantity }}
                  </div>
                </div>
              </el-descriptions-item>
            </el-descriptions>

            <el-alert
              v-if="batchInfo.status === 'expired'"
              title="该批次已过期，禁止领用！"
              type="error"
              show-icon
              style="margin-top: 12px;"
            />
            <el-alert
              v-else-if="batchInfo.status === 'expiring'"
              title="该批次即将过期，请优先使用！"
              type="warning"
              show-icon
              style="margin-top: 12px;"
            />
            <el-alert
              v-else-if="batchInfo.status === 'empty'"
              title="该批次库存已空！"
              type="error"
              show-icon
              style="margin-top: 12px;"
            />
            <el-alert
              v-else-if="batchInfo.status === 'low_stock'"
              title="该批次库存不足！"
              type="warning"
              show-icon
              style="margin-top: 12px;"
            />
          </el-card>

          <el-empty v-else-if="queried" description="未找到对应批次" style="margin-top: 40px;" />
          <el-empty v-else description="请先扫码或输入二维码标识" style="margin-top: 40px;" />
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="never">
          <template #header>
            <div class="card-title">操作录入</div>
          </template>

          <el-form ref="opFormRef" :model="opForm" :rules="opRules" label-width="90px">
            <el-form-item label="操作类型" prop="type">
              <el-radio-group v-model="opForm.type" :disabled="!canOperate">
                <el-radio-button value="open">开封</el-radio-button>
                <el-radio-button value="claim">领用</el-radio-button>
                <el-radio-button value="subpackage">分装</el-radio-button>
                <el-radio-button value="return">归还</el-radio-button>
                <el-radio-button value="discard">报废</el-radio-button>
              </el-radio-group>
              <div class="type-hint" v-if="opForm.type">
                <el-icon><InfoFilled /></el-icon>
                {{ getTypeHint(opForm.type) }}
              </div>
            </el-form-item>

            <el-form-item label="操作数量" prop="quantity">
              <el-input-number
                v-model="opForm.quantity"
                :min="1"
                :max="maxQuantity"
                size="large"
                style="width: 100%;"
                :disabled="!canOperate"
              />
              <div v-if="canOperate" class="quantity-hint">
                当前可操作：{{ maxQuantity }}
              </div>
            </el-form-item>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="操作员" prop="operator">
                  <el-input v-model="opForm.operator" placeholder="请输入操作员姓名" size="large" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="操作地点">
                  <el-input v-model="opForm.location" placeholder="如：实验室1" size="large" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="备注">
              <el-input v-model="opForm.remark" type="textarea" :rows="2" placeholder="操作备注（可选）" />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                style="width: 100%;"
                :loading="submitting"
                :disabled="!canOperate || !opForm.type || !opForm.operator"
                @click="handleSubmit"
              >
                <el-icon><Check /></el-icon>
                确认操作
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px;" v-if="lastResult">
          <template #header>
            <div class="card-title">
              <el-icon><CircleCheckFilled /></el-icon>
              操作结果
            </div>
          </template>
          <el-result
            :icon="lastResult.success ? 'success' : 'error'"
            :title="lastResult.success ? '操作成功' : '操作失败'"
            :sub-title="lastResult.message"
          >
            <template #extra v-if="lastResult.success && lastResult.data">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="操作类型">
                  {{ lastResult.data.record?.typeLabel || lastResult.data.record?.type }}
                </el-descriptions-item>
                <el-descriptions-item label="数量">
                  {{ lastResult.data.record?.quantity }}
                </el-descriptions-item>
                <el-descriptions-item label="操作员">
                  {{ lastResult.data.record?.operator }}
                </el-descriptions-item>
                <el-descriptions-item label="剩余库存">
                  {{ lastResult.data.batch?.remainingQuantity }}
                </el-descriptions-item>
              </el-descriptions>
            </template>
          </el-result>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBatchByQR } from '../api/batch'
import { scanOperation } from '../api/record'

const route = useRoute()

const exampleCodes = ['QR-B001-20260101', 'QR-B002-20260201', 'QR-B003-20250501']

const formRef = ref(null)
const opFormRef = ref(null)
const queried = ref(false)
const batchInfo = ref(null)
const submitting = ref(false)
const lastResult = ref(null)

const formData = reactive({
  scanCode: ''
})

const formRules = {
  scanCode: [{ required: true, message: '请输入扫码标识', trigger: 'blur' }]
}

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

const statusMap = {
  in_stock: { label: '正常库存' },
  low_stock: { label: '库存不足' },
  expiring: { label: '即将过期' },
  expired: { label: '已过期' },
  empty: { label: '已空库' }
}

const typeHints = {
  open: '首次开封使用，记录后库存减少',
  claim: '正常领用，从库存中扣除',
  subpackage: '分装操作，从该批次分装到其他容器',
  return: '归还未用完的试剂',
  discard: '报废操作，该数量将被扣除'
}

const canOperate = computed(() => {
  if (!batchInfo.value) return false
  if (batchInfo.value.status === 'expired') return false
  if (batchInfo.value.status === 'empty') return false
  return true
})

const maxQuantity = computed(() => {
  if (!batchInfo.value) return 1
  if (opForm.type === 'return') return 9999
  return Math.max(1, batchInfo.value.remainingQuantity)
})

const stockPercent = computed(() => {
  if (!batchInfo.value) return 0
  return Math.round((batchInfo.value.remainingQuantity / batchInfo.value.totalQuantity) * 100)
})

function getStatusLabel(status) {
  return statusMap[status]?.label || status
}

function getTypeHint(type) {
  return typeHints[type] || ''
}

function selectCode(code) {
  formData.scanCode = code
  handleQuery()
}

async function handleQuery() {
  if (!formData.scanCode.trim()) return

  queried.value = true
  lastResult.value = null

  try {
    const res = await getBatchByQR(formData.scanCode.trim())
    batchInfo.value = res.data
    opForm.type = ''
    opForm.quantity = 1
  } catch (e) {
    batchInfo.value = null
  }
}

function resetOpForm() {
  opForm.type = ''
  opForm.quantity = 1
}

async function handleSubmit() {
  if (!opFormRef.value) return
  await opFormRef.value.validate()

  const confirmText = `确认执行「${getTypeLabel(opForm.type)}」操作？\n\n数量：${opForm.quantity}\n操作员：${opForm.operator}`

  try {
    await ElMessageBox.confirm(confirmText, '操作确认', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  submitting.value = true
  try {
    const res = await scanOperation({
      scanCode: formData.scanCode,
      type: opForm.type,
      quantity: opForm.quantity,
      operator: opForm.operator,
      location: opForm.location,
      remark: opForm.remark
    })

    lastResult.value = {
      success: true,
      message: res.message || '操作成功',
      data: res.data
    }

    ElMessage.success(res.message || '操作成功')

    await handleQuery()
    resetOpForm()
  } catch (e) {
    lastResult.value = {
      success: false,
      message: e.response?.data?.message || e.message || '操作失败'
    }
  } finally {
    submitting.value = false
  }
}

function getTypeLabel(type) {
  const map = {
    open: '开封',
    claim: '领用',
    subpackage: '分装',
    return: '归还',
    discard: '报废'
  }
  return map[type] || type
}

onMounted(() => {
  if (route.query.code) {
    formData.scanCode = route.query.code
    handleQuery()
  }
})
</script>

<style scoped>
.card-title {
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.batch-card {
  margin-top: 16px;
}

.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.batch-no {
  font-size: 14px;
  font-weight: 500;
}

.status-label {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-in_stock {
  background: #f0f9eb;
  color: #67c23a;
}

.status-low_stock,
.status-expiring {
  background: #fdf6ec;
  color: #e6a23c;
}

.status-expired,
.status-empty {
  background: #fef0f0;
  color: #f56c6c;
}

.stock-detail {
  text-align: center;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.text-danger {
  color: #f56c6c;
  font-weight: 500;
}

.example-codes {
  display: flex;
  align-items: center;
}

.hint {
  font-size: 12px;
  color: #909399;
  margin-right: 4px;
}

.type-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

.quantity-hint {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
}
</style>
