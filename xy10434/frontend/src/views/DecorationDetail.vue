<template>
  <div class="detail-page">
    <el-page-header @back="goBack" content="装修详情" />
    
    <el-row :gutter="20" v-loading="loading">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-title">
              <span>装修基本信息</span>
              <el-tag :type="getStatusType(decoration?.status)" size="large">
                {{ getStatusText(decoration?.status) }}
              </el-tag>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="房号">
              {{ decoration?.building }}-{{ decoration?.unit }}-{{ decoration?.room_number }}
            </el-descriptions-item>
            <el-descriptions-item label="业主">
              {{ decoration?.owner_name }}
            </el-descriptions-item>
            <el-descriptions-item label="联系电话">
              {{ decoration?.owner_phone }}
            </el-descriptions-item>
            <el-descriptions-item label="施工队">
              {{ decoration?.team_name || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="开工日期">
              {{ decoration?.start_date || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="预计完工">
              {{ decoration?.expected_end_date || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="实际完工">
              {{ decoration?.actual_end_date || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="备注">
              {{ decoration?.remark || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-title">
              <span>押金及扣款明细</span>
              <el-button type="primary" size="small" v-if="decoration?.status === 'in_progress'" @click="openInspectionDialog">
                <el-icon><Plus /></el-icon>登记巡查
              </el-button>
            </div>
          </template>
          
          <div class="deposit-summary">
            <div class="summary-item">
              <div class="summary-label">应收押金</div>
              <div class="summary-value">¥{{ decoration?.deposit_amount || 0 }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">已收押金</div>
              <div class="summary-value deposit">¥{{ balance?.total_received || 0 }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">已扣款</div>
              <div class="summary-value deduction">-¥{{ balance?.total_deduction || 0 }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">已退还</div>
              <div class="summary-value refund">-¥{{ balance?.total_refund || 0 }}</div>
            </div>
            <div class="summary-item final">
              <div class="summary-label">当前余额</div>
              <div class="summary-value" :class="balance?.balance > 0 ? 'deposit' : ''">
                ¥{{ balance?.balance || 0 }}
              </div>
            </div>
          </div>

          <el-divider />
          
          <div class="section-title">扣款依据明细</div>
          <el-table :data="decoration?.inspections || []" size="small" v-if="decoration?.inspections?.length">
            <el-table-column prop="inspection_date" label="巡查时间" width="180" />
            <el-table-column prop="inspector" label="巡查人" width="100" />
            <el-table-column prop="violation_type" label="违规类型" width="120">
              <template #default="scope">
                <span v-if="scope.row.violation_type" style="color: #e6a23c">{{ scope.row.violation_type }}</span>
                <span v-else style="color: #67c23a">正常巡查</span>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="违规描述" />
            <el-table-column prop="deduction_amount" label="扣款金额" width="100">
              <template #default="scope">
                <span v-if="scope.row.deduction_amount > 0" style="color: #e6a23c; font-weight: bold">-¥{{ scope.row.deduction_amount }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="rectification_requirement" label="整改要求" min-width="200">
              <template #default="scope">
                <span v-if="scope.row.rectification_requirement">{{ scope.row.rectification_requirement }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'pending' ? 'warning' : scope.row.status === 'reviewed' ? 'success' : 'info'" size="small">
                  {{ scope.row.status === 'pending' ? '待复核' : scope.row.status === 'reviewed' ? '已复核' : '正常' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="rectification_result" label="整改结果" min-width="200">
              <template #default="scope">
                <span v-if="scope.row.rectification_result">{{ scope.row.rectification_result }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无巡查记录" />
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-title">押金流水记录</div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(transaction, index) in decoration?.depositTransactions || []"
              :key="transaction.id"
              :timestamp="transaction.created_at"
              :type="getTransactionType(transaction.type)"
              :icon="getTransactionIcon(transaction.type)"
            >
              <el-card>
                <div class="transaction-item">
                  <div class="transaction-type">
                    <el-tag :type="getTagType(transaction.type)">{{ getTransactionText(transaction.type) }}</el-tag>
                  </div>
                  <div class="transaction-amount" :class="transaction.type">
                    {{ transaction.type === 'receive' ? '+' : '-' }}¥{{ transaction.amount }}
                  </div>
                </div>
                <div class="transaction-info">
                  <span v-if="transaction.payment_method">支付方式：{{ transaction.payment_method }}</span>
                  <span v-if="transaction.operator" style="margin-left: 20px">经办人：{{ transaction.operator }}</span>
                </div>
                <div v-if="transaction.remark" class="transaction-remark">
                  备注：{{ transaction.remark }}
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="!decoration?.depositTransactions?.length" description="暂无押金流水记录" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span>快捷操作</span>
          </template>
          <el-space direction="vertical" style="width: 100%">
            <el-button 
              type="success" 
              style="width: 100%" 
              v-if="decoration?.status === 'pending'"
              @click="handleStart"
            >
              确认开工
            </el-button>
            <el-button 
              type="warning" 
              style="width: 100%" 
              v-if="decoration?.status === 'pending' || decoration?.status === 'in_progress'"
              @click="openDepositDialog"
            >
              收取押金
            </el-button>
            <el-button 
              type="primary" 
              style="width: 100%" 
              v-if="decoration?.status === 'in_progress'"
              @click="openInspectionDialog"
            >
              登记巡查
            </el-button>
            <el-button 
              type="success" 
              style="width: 100%" 
              v-if="decoration?.status === 'in_progress'"
              @click="handleApplyRefund"
            >
              申请退押
            </el-button>
          </el-space>
        </el-card>

        <el-card style="margin-top: 20px" v-if="decoration?.refunds?.length">
          <template #header>
            <span>退押记录</span>
          </template>
          <div v-for="refund in decoration?.refunds" :key="refund.id" class="refund-item">
            <div class="refund-header">
              <el-tag :type="refund.status === 'approved' ? 'success' : refund.status === 'rejected' ? 'danger' : 'warning'">
                {{ refund.status === 'approved' ? '已通过' : refund.status === 'rejected' ? '已拒绝' : '待审核' }}
              </el-tag>
              <span style="font-weight: bold; color: #67c23a">¥{{ refund.refund_amount }}</span>
            </div>
            <div class="refund-detail">
              <div>已收押金：¥{{ refund.deposit_received }}</div>
              <div>扣款合计：<span style="color: #e6a23c">-¥{{ refund.total_deduction }}</span></div>
              <div>应退金额：<span style="color: #67c23a; font-weight: bold">¥{{ refund.refund_amount }}</span></div>
              <div v-if="refund.remark">备注：{{ refund.remark }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="depositDialogVisible" title="收取押金" width="500px">
      <el-form :model="depositForm" :rules="depositRules" ref="depositFormRef" label-width="100px">
        <el-form-item label="收取金额" prop="amount">
          <el-input-number v-model="depositForm.amount" :min="0" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支付方式" prop="payment_method">
          <el-select v-model="depositForm.payment_method" placeholder="选择支付方式" style="width: 100%">
            <el-option label="现金" value="现金" />
            <el-option label="微信" value="微信" />
            <el-option label="支付宝" value="支付宝" />
            <el-option label="银行转账" value="转账" />
          </el-select>
        </el-form-item>
        <el-form-item label="经办人">
          <el-input v-model="depositForm.operator" placeholder="经办人姓名" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="depositForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="depositDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitDeposit">确认收取</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inspectionDialogVisible" title="登记巡查" width="600px">
      <el-form :model="inspectionForm" label-width="100px">
        <el-form-item label="巡查人">
          <el-input v-model="inspectionForm.inspector" placeholder="巡查人姓名" />
        </el-form-item>
        <el-form-item label="是否违规">
          <el-radio-group v-model="hasViolation">
            <el-radio :value="false">正常，无违规</el-radio>
            <el-radio :value="true">存在违规</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="hasViolation">
          <el-form-item label="违规类型">
            <el-select v-model="inspectionForm.violation_type" placeholder="选择违规类型" style="width: 100%">
              <el-option label="噪音违规" value="噪音违规" />
              <el-option label="违规堆放" value="违规堆放" />
              <el-option label="破坏结构" value="破坏墙体结构" />
              <el-option label="违规用电" value="违规用电" />
              <el-option label="消防隐患" value="消防隐患" />
              <el-option label="其他" value="其他" />
            </el-select>
          </el-form-item>
          <el-form-item label="违规描述">
            <el-input v-model="inspectionForm.description" type="textarea" :rows="2" placeholder="请详细描述违规情况" />
          </el-form-item>
          <el-form-item label="扣款金额">
            <el-input-number v-model="inspectionForm.deduction_amount" :min="0" :max="balance?.balance || 0" :step="100" style="width: 100%" />
            <div style="color: #999; font-size: 12px; margin-top: 4px">当前押金余额：¥{{ balance?.balance || 0 }}</div>
          </el-form-item>
          <el-form-item label="整改要求">
            <el-input v-model="inspectionForm.rectification_requirement" type="textarea" :rows="2" placeholder="请说明整改要求" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="inspectionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitInspection">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const decoration = ref(null)
const balance = ref({})

const depositDialogVisible = ref(false)
const inspectionDialogVisible = ref(false)
const hasViolation = ref(false)
const depositFormRef = ref(null)

const depositForm = reactive({
  amount: 0,
  payment_method: '',
  operator: '',
  remark: ''
})

const inspectionForm = reactive({
  inspector: '',
  violation_type: '',
  description: '',
  deduction_amount: 0,
  rectification_requirement: ''
})

const depositRules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  payment_method: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
}

const statusMap = {
  pending: { text: '待审批', type: 'info' },
  in_progress: { text: '进行中', type: 'primary' },
  refunding: { text: '退押中', type: 'warning' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'danger' }
}

function getStatusText(status) {
  return statusMap[status]?.text || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

function getTransactionType(type) {
  if (type === 'receive') return 'success'
  if (type === 'refund') return 'primary'
  return 'warning'
}

function getTransactionIcon(type) {
  if (type === 'receive') return 'Plus'
  if (type === 'refund') return 'Minus'
  return 'Warning'
}

function getTransactionText(type) {
  if (type === 'receive') return '收取押金'
  if (type === 'refund') return '退还押金'
  if (type === 'deduction') return '违规扣款'
  return type
}

function getTagType(type) {
  if (type === 'receive') return 'success'
  if (type === 'refund') return 'primary'
  return 'warning'
}

async function loadData() {
  loading.value = true
  try {
    const response = await api.get(`/decorations/${route.params.id}`)
    decoration.value = response.data
    
    const balanceResp = await api.get(`/deposits/balance/${route.params.id}`)
    balance.value = balanceResp.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/decorations')
}

async function handleStart() {
  try {
    await ElMessageBox.confirm('确认开始装修吗？系统将检查押金是否已收取。', '提示', { type: 'warning' })
    await api.put(`/decorations/${decoration.value.id}`, { status: 'in_progress' })
    ElMessage.success('装修已开始')
    loadData()
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}

function openDepositDialog() {
  depositForm.amount = decoration.value.deposit_amount - (balance.value?.total_received || 0)
  depositForm.payment_method = ''
  depositForm.operator = ''
  depositForm.remark = ''
  depositDialogVisible.value = true
}

async function submitDeposit() {
  try {
    await depositFormRef.value.validate()
    submitting.value = true
    await api.post('/deposits', {
      decoration_id: decoration.value.id,
      type: 'receive',
      ...depositForm
    })
    ElMessage.success('押金收取成功')
    depositDialogVisible.value = false
    loadData()
  } catch (err) {
    console.error(err)
  } finally {
    submitting.value = false
  }
}

function openInspectionDialog() {
  hasViolation.value = false
  Object.assign(inspectionForm, {
    inspector: '',
    violation_type: '',
    description: '',
    deduction_amount: 0,
    rectification_requirement: ''
  })
  inspectionDialogVisible.value = true
}

async function submitInspection() {
  submitting.value = true
  try {
    const data = {
      decoration_id: decoration.value.id,
      inspector: inspectionForm.inspector
    }
    if (hasViolation.value) {
      data.violation_type = inspectionForm.violation_type
      data.description = inspectionForm.description
      data.deduction_amount = inspectionForm.deduction_amount
      data.rectification_requirement = inspectionForm.rectification_requirement
    }
    await api.post('/inspections', data)
    ElMessage.success('巡查记录已提交')
    inspectionDialogVisible.value = false
    loadData()
  } catch (err) {
    console.error(err)
  } finally {
    submitting.value = false
  }
}

async function handleApplyRefund() {
  try {
    await ElMessageBox.confirm('确认申请退押吗？系统将检查是否有未复核的违规记录。', '提示', { type: 'warning' })
    await api.post('/refunds', {
      decoration_id: decoration.value.id,
      applicant: '管理员',
      payment_method: '转账'
    })
    ElMessage.success('退押申请已提交')
    loadData()
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.detail-page {
  padding: 0;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-weight: 500;
  font-size: 14px;
  color: #333;
  margin-bottom: 12px;
}

.deposit-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.summary-item {
  flex: 1;
  min-width: 120px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  text-align: center;
}

.summary-item.final {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.summary-item.final .summary-label,
.summary-item.final .summary-value {
  color: white !important;
}

.summary-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.summary-value.deposit { color: #67c23a; }
.summary-value.deduction { color: #e6a23c; }
.summary-value.refund { color: #409eff; }

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.transaction-amount {
  font-size: 18px;
  font-weight: bold;
}

.transaction-amount.receive { color: #67c23a; }
.transaction-amount.refund { color: #409eff; }
.transaction-amount.deduction { color: #e6a23c; }

.transaction-info {
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
}

.transaction-remark {
  font-size: 13px;
  color: #666;
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
}

.refund-item {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 12px;
}

.refund-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.refund-detail {
  font-size: 13px;
  color: #666;
}

.refund-detail div {
  margin-bottom: 4px;
}
</style>
