<template>
  <div class="migration-detail" v-loading="loading">
    <el-card v-if="migration">
      <template #header>
        <div class="card-header">
          <span>{{ migration.name }} - 详情</span>
          <div>
            <el-button type="primary" size="small" @click="handleRecalculate">
              重新计算影响表
            </el-button>
            <el-button type="success" size="small" @click="handleExport">
              导出Excel
            </el-button>
            <el-button size="small" @click="$router.push('/')">
              返回列表
            </el-button>
          </div>
        </div>
      </template>

      <el-descriptions :column="3" border>
        <el-descriptions-item label="ID">{{ migration.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(migration.status)">
            {{ getStatusText(migration.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="数据库类型">{{ migration.database_type }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ migration.created_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(migration.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDate(migration.updated_at) }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="3">{{ migration.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">脚本内容</el-divider>
      <el-input
        :model-value="migration.script_content"
        type="textarea"
        :rows="8"
        readonly
      />

      <el-divider content-position="left">影响表</el-divider>
      <el-table :data="migration.affected_tables" stripe border>
        <el-table-column prop="table_name" label="表名" width="180" />
        <el-table-column prop="operation_type" label="操作类型" width="120" />
        <el-table-column prop="estimated_rows" label="预估行数" width="120" />
        <el-table-column prop="actual_rows" label="实际行数" width="120" />
        <el-table-column prop="has_backup" label="已备份" width="100">
          <template #default="{ row }">
            <el-tag :type="row.has_backup ? 'success' : 'danger'">
              {{ row.has_backup ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remarks" label="备注" />
      </el-table>

      <el-divider content-position="left">回滚脚本</el-divider>
      <el-table :data="migration.rollback_scripts" stripe border>
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="script_content" label="脚本内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="is_valid" label="是否有效" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_valid ? 'success' : 'danger'">
              {{ row.is_valid ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="validation_result" label="验证结果" min-width="150" show-overflow-tooltip />
        <el-table-column prop="remarks" label="备注" min-width="150" />
      </el-table>

      <el-divider content-position="left">审批链路</el-divider>
      <div v-if="approvalChain">
        <el-steps :active="getCurrentStepIndex()" finish-status="success" align-center>
          <el-step
            v-for="(step, index) in approvalChain.steps"
            :key="step.id"
            :title="step.role"
            :status="getStepStatus(step)"
            :description="step.approver || '待审批'"
          />
        </el-steps>

        <div style="margin-top: 20px;">
          <el-button
            v-if="approvalChain.status === 'not_started'"
            type="primary"
            @click="startApproval"
          >
            启动审批流程
          </el-button>
          <el-button
            v-if="canApprove()"
            type="success"
            @click="showApproveDialog"
          >
            审批通过
          </el-button>
          <el-button
            v-if="canApprove()"
            type="danger"
            @click="showRejectDialog"
          >
            审批驳回
          </el-button>
        </div>
      </div>
      <div v-else>
        <el-button type="primary" @click="showCreateChainDialog">
          创建审批链路
        </el-button>
      </div>

      <el-divider content-position="left">执行操作</el-divider>
      <el-space wrap>
        <el-button type="primary" @click="startExecution">执行迁移</el-button>
        <el-button type="warning" @click="showManualFixDialog">人工修正</el-button>
      </el-space>

      <el-divider content-position="left">执行日志</el-divider>
      <el-table :data="executionLogs" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="execution_type" label="执行类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ getExecutionTypeText(row.execution_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getLogStatusType(row.status)">
              {{ getLogStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="executed_by" label="执行人" width="120" />
        <el-table-column prop="started_at" label="开始时间" width="180">
          <template #default="{ row }">{{ formatDate(row.started_at) }}</template>
        </el-table-column>
        <el-table-column prop="duration_seconds" label="耗时(秒)" width="100" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'running'"
              type="success"
              size="small"
              @click="completeLog(row)"
            >
              完成
            </el-button>
            <el-button
              v-if="row.status === 'success' || row.status === 'failed'"
              type="primary"
              size="small"
              @click="replayLog(row)"
            >
              回放
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-divider content-position="left">追溯链</el-divider>
      <el-button type="primary" @click="loadTrace" :loading="traceLoading">
        加载追溯链
      </el-button>
      <el-timeline v-if="traceData" style="margin-top: 20px;">
        <el-timeline-item
          v-for="(log, index) in traceData.execution_logs"
          :key="index"
          :timestamp="formatDate(log.started_at)"
          placement="top"
          :type="getTimelineType(log.status)"
        >
          <el-card>
            <h4>{{ getExecutionTypeText(log.execution_type) }} - {{ getLogStatusText(log.status) }}</h4>
            <p>执行人: {{ log.executed_by || '-' }}</p>
            <p v-if="log.error_message">错误: {{ log.error_message }}</p>
            <p v-if="log.output">输出: {{ log.output }}</p>
            <p v-if="log.affected_rows">影响行数: {{ log.affected_rows }}</p>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <el-dialog v-model="approveDialogVisible" title="审批通过" width="500px">
      <el-form label-width="100px">
        <el-form-item label="审批人">
          <el-input v-model="approveForm.approver" />
        </el-form-item>
        <el-form-item label="审批意见">
          <el-input v-model="approveForm.comment" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApprove" :loading="submitting">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectDialogVisible" title="审批驳回" width="500px">
      <el-form label-width="100px">
        <el-form-item label="审批人">
          <el-input v-model="rejectForm.approver" />
        </el-form-item>
        <el-form-item label="驳回原因">
          <el-input v-model="rejectForm.comment" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="submitReject" :loading="submitting">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createChainDialogVisible" title="创建审批链路" width="600px">
      <div style="margin-bottom: 15px;">
        <el-button type="primary" size="small" @click="addApprovalStep">添加审批步骤</el-button>
      </div>
      <el-table :data="approvalSteps" border>
        <el-table-column prop="step_order" label="序号" width="80">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="role" label="角色" width="150">
          <template #default="{ row }">
            <el-input v-model="row.role" size="small" />
          </template>
        </el-table-column>
        <el-table-column prop="is_required" label="必须审批" width="100">
          <template #default="{ row }">
            <el-switch v-model="row.is_required" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ $index }">
            <el-button type="danger" size="small" @click="removeApprovalStep($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="createChainDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateChain" :loading="submitting">确认创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="manualFixDialogVisible" title="人工修正" width="600px">
      <el-form label-width="100px">
        <el-form-item label="执行人">
          <el-input v-model="manualFixForm.executed_by" />
        </el-form-item>
        <el-form-item label="修正脚本">
          <el-input
            v-model="manualFixForm.script_content"
            type="textarea"
            :rows="8"
            placeholder="请输入人工修正的SQL脚本"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualFixDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitManualFix" :loading="submitting">执行修正</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMigrationStore } from '@/stores/migration'

const route = useRoute()
const migrationStore = useMigrationStore()

const migrationId = route.params.id
const loading = ref(false)
const traceLoading = ref(false)
const submitting = ref(false)
const migration = ref(null)
const approvalChain = ref(null)
const executionLogs = ref([])
const traceData = ref(null)

const approveDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const createChainDialogVisible = ref(false)
const manualFixDialogVisible = ref(false)

const approveForm = reactive({ approver: '', comment: '' })
const rejectForm = reactive({ approver: '', comment: '' })
const manualFixForm = reactive({ executed_by: '', script_content: '' })
const approvalSteps = ref([])

const loadDetail = async () => {
  loading.value = true
  try {
    await migrationStore.fetchMigration(migrationId)
    migration.value = migrationStore.currentMigration
    await loadApprovalChain()
    await loadExecutionLogs()
  } finally {
    loading.value = false
  }
}

const loadApprovalChain = async () => {
  try {
    approvalChain.value = await migrationStore.getApprovalChain(migrationId)
  } catch {
    approvalChain.value = null
  }
}

const loadExecutionLogs = async () => {
  try {
    executionLogs.value = await migrationStore.listExecutionLogs(migrationId)
  } catch {
    executionLogs.value = []
  }
}

const loadTrace = async () => {
  traceLoading.value = true
  try {
    traceData.value = await migrationStore.getTrace(migrationId)
  } finally {
    traceLoading.value = false
  }
}

const getStatusType = (status) => {
  const statusMap = {
    'draft': 'info', 'pending_approval': 'warning', 'approved': 'success',
    'rejected': 'danger', 'executing': 'primary', 'success': 'success',
    'failed': 'danger', 'rolled_back': 'warning'
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status) => {
  const statusMap = {
    'draft': '草稿', 'pending_approval': '待审批', 'approved': '已审批',
    'rejected': '已驳回', 'executing': '执行中', 'success': '成功',
    'failed': '失败', 'rolled_back': '已回滚'
  }
  return statusMap[status] || status
}

const getStepStatus = (step) => {
  if (step.status === 'approved') return 'success'
  if (step.status === 'rejected') return 'error'
  if (step.status === 'pending') return 'process'
  return 'wait'
}

const getCurrentStepIndex = () => {
  if (!approvalChain.value) return 0
  return approvalChain.value.current_step_index || 0
}

const canApprove = () => {
  if (!approvalChain.value || approvalChain.value.status !== 'in_progress') return false
  const currentStep = approvalChain.value.steps[getCurrentStepIndex()]
  return currentStep && currentStep.status === 'pending'
}

const getExecutionTypeText = (type) => {
  const map = { 'migration': '迁移', 'rollback': '回滚', 'replay': '回放', 'manual_fix': '人工修正' }
  return map[type] || type
}

const getLogStatusType = (status) => {
  const map = { 'pending': 'info', 'running': 'primary', 'success': 'success', 'failed': 'danger', 'partial': 'warning' }
  return map[status] || 'info'
}

const getLogStatusText = (status) => {
  const map = { 'pending': '待执行', 'running': '执行中', 'success': '成功', 'failed': '失败', 'partial': '部分成功' }
  return map[status] || status
}

const getTimelineType = (status) => {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'primary'
  return 'warning'
}

const formatDate = (date) => date ? new Date(date).toLocaleString('zh-CN') : '-'

const handleRecalculate = async () => {
  await migrationStore.recalculateTables(migrationId)
  ElMessage.success('重新计算完成')
  loadDetail()
}

const handleExport = () => {
  migrationStore.exportExcel(migrationId)
  ElMessage.success('导出请求已发送')
}

const startApproval = async () => {
  submitting.value = true
  try {
    await migrationStore.startApprovalChain(approvalChain.value.id)
    ElMessage.success('审批流程已启动')
    await loadApprovalChain()
  } finally {
    submitting.value = false
  }
}

const showApproveDialog = () => { approveDialogVisible.value = true }
const showRejectDialog = () => { rejectDialogVisible.value = true }

const submitApprove = async () => {
  if (!approveForm.approver) {
    ElMessage.warning('请输入审批人')
    return
  }
  submitting.value = true
  try {
    const currentStep = approvalChain.value.steps[getCurrentStepIndex()]
    await migrationStore.approveStep(currentStep.id, approveForm.approver, approveForm.comment)
    ElMessage.success('审批成功')
    approveDialogVisible.value = false
    await loadApprovalChain()
    await loadDetail()
  } finally {
    submitting.value = false
  }
}

const submitReject = async () => {
  if (!rejectForm.approver) {
    ElMessage.warning('请输入审批人')
    return
  }
  submitting.value = true
  try {
    const currentStep = approvalChain.value.steps[getCurrentStepIndex()]
    await migrationStore.rejectStep(currentStep.id, rejectForm.approver, rejectForm.comment)
    ElMessage.success('已驳回')
    rejectDialogVisible.value = false
    await loadApprovalChain()
    await loadDetail()
  } finally {
    submitting.value = false
  }
}

const showCreateChainDialog = () => {
  approvalSteps.value = [
    { step_order: 1, role: 'DBA', is_required: true, rules: '{"required_role": "DBA"}' },
    { step_order: 2, role: '运维负责人', is_required: true, rules: '{"required_role": "运维负责人"}' }
  ]
  createChainDialogVisible.value = true
}

const addApprovalStep = () => {
  approvalSteps.value.push({ step_order: approvalSteps.value.length + 1, role: '', is_required: true })
}

const removeApprovalStep = (index) => {
  approvalSteps.value.splice(index, 1)
  approvalSteps.value.forEach((step, i) => { step.step_order = i + 1 })
}

const submitCreateChain = async () => {
  if (approvalSteps.value.some(s => !s.role)) {
    ElMessage.warning('请填写所有审批步骤的角色')
    return
  }
  submitting.value = true
  try {
    await migrationStore.createApprovalChain(migrationId, { steps: approvalSteps.value })
    ElMessage.success('审批链路创建成功')
    createChainDialogVisible.value = false
    await loadApprovalChain()
  } finally {
    submitting.value = false
  }
}

const startExecution = async () => {
  const { value: executedBy } = await ElMessage.prompt('请输入执行人姓名', '执行迁移', { confirmButtonText: '确定', cancelButtonText: '取消' })
  if (executedBy) {
    await migrationStore.startExecution(migrationId, executedBy)
    ElMessage.success('执行已启动')
    await loadExecutionLogs()
    await loadDetail()
  }
}

const showManualFixDialog = () => { manualFixDialogVisible.value = true }

const submitManualFix = async () => {
  if (!manualFixForm.executed_by || !manualFixForm.script_content) {
    ElMessage.warning('请填写完整信息')
    return
  }
  submitting.value = true
  try {
    await migrationStore.manualFix(migrationId, manualFixForm.script_content, manualFixForm.executed_by)
    ElMessage.success('人工修正已启动')
    manualFixDialogVisible.value = false
    await loadExecutionLogs()
  } finally {
    submitting.value = false
  }
}

const completeLog = async (log) => {
  const { value: success } = await ElMessage.confirm('执行是否成功？', '完成执行', {
    confirmButtonText: '成功', cancelButtonText: '失败', distinguishCancelAndClose: true
  })
  const isSuccess = success === 'confirm'
  const { value: output } = await ElMessage.prompt('请输入执行输出', '执行结果', { confirmButtonText: '确定' })
  await migrationStore.completeExecution(log.id, isSuccess, output, '', null)
  ElMessage.success('状态已更新')
  await loadExecutionLogs()
  await loadDetail()
}

const replayLog = async (log) => {
  const { value: executedBy } = await ElMessage.prompt('请输入执行人姓名', '回放执行', { confirmButtonText: '确定' })
  if (executedBy) {
    await migrationStore.replayExecution(log.id, executedBy)
    ElMessage.success('回放已启动')
    await loadExecutionLogs()
  }
}

onMounted(() => { loadDetail() })
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>