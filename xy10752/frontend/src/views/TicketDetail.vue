<template>
  <div class="ticket-detail">
    <el-page-header @back="goBack" :title="`工单详情 - ${ticket?.ticket_no || ''}`" />

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>基本信息</span>
              <div>
                <el-button type="primary" size="small" @click="showCompensationDialog">
                  <el-icon><CirclePlus /></el-icon>
                  SLA补偿
                </el-button>
                <el-button type="warning" size="small" @click="showEscalationDialog">
                  <el-icon><TrendCharts /></el-icon>
                  工单升级
                </el-button>
                <el-button type="success" size="small" @click="exportTicket">
                  <el-icon><Download /></el-icon>
                  导出报表
                </el-button>
              </div>
            </div>
          </template>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="工单编号">{{ ticket?.ticket_no }}</el-descriptions-item>
            <el-descriptions-item label="工单标题">{{ ticket?.title }}</el-descriptions-item>
            <el-descriptions-item label="优先级">
              <el-tag :type="getPriorityType(ticket?.priority)">
                {{ getPriorityLabel(ticket?.priority) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="工单状态">
              <el-tag :type="getStatusType(ticket?.status)">
                {{ getStatusLabel(ticket?.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="SLA状态">
              <el-tag :type="getSlaStatusType(ticket?.current_sla_status)">
                {{ getSlaStatusLabel(ticket?.current_sla_status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="已用工时">{{ ticket?.total_used_hours }} 小时</el-descriptions-item>
            <el-descriptions-item label="剩余工时">
              <span :style="{ color: ticket?.remaining_hours < 4 ? '#f56c6c' : '' }">
                {{ ticket?.remaining_hours }} 小时
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="SLA截止时间">{{ formatDate(ticket?.sla_deadline) }}</el-descriptions-item>
            <el-descriptions-item label="处理人">{{ ticket?.assignee || '未分配' }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ ticket?.creator }}</el-descriptions-item>
            <el-descriptions-item label="创建时间" :span="2">{{ formatDate(ticket?.created_at) }}</el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <el-descriptions title="SLA路径状态" :column="4">
            <el-descriptions-item>
              <template #label>
                <span><el-icon style="color: #67c23a"><SuccessFilled /></el-icon> 成功路径</span>
              </template>
              <el-tag :type="slaPaths?.success ? 'success' : 'info'">
                {{ slaPaths?.success ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item>
              <template #label>
                <span><el-icon style="color: #909399"><VideoPause /></el-icon> 拦截路径</span>
              </template>
              <el-tag :type="slaPaths?.blocked ? 'warning' : 'info'">
                {{ slaPaths?.blocked ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item>
              <template #label>
                <span><el-icon style="color: #409eff"><Plus /></el-icon> 补偿路径</span>
              </template>
              <el-tag :type="slaPaths?.compensation ? 'primary' : 'info'">
                {{ slaPaths?.compensation ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item>
              <template #label>
                <span><el-icon style="color: #e6a23c"><View /></el-icon> 人工复核</span>
              </template>
              <el-tag :type="slaPaths?.manual_review ? 'danger' : 'info'">
                {{ slaPaths?.manual_review ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover" style="margin-bottom: 20px">
          <template #header><span>SLA快速操作</span></template>
          <el-button type="warning" style="width: 100%; margin-bottom: 10px" @click="showPauseDialog" :disabled="ticket?.current_sla_status === 'paused'">
            <el-icon><VideoPause /></el-icon>
            暂停SLA计时
          </el-button>
          <el-button type="success" style="width: 100%; margin-bottom: 10px" @click="showResumeDialog" :disabled="ticket?.current_sla_status !== 'paused'">
            <el-icon><VideoPlay /></el-icon>
            恢复SLA计时
          </el-button>
          <el-button type="primary" style="width: 100%" @click="recalculateSLA">
            <el-icon><Refresh /></el-icon>
            重新计算SLA
          </el-button>
        </el-card>

        <el-card shadow="hover">
          <template #header><span>快速审批</span></template>
          <el-button type="info" style="width: 100%; margin-bottom: 10px" @click="showApprovalDialog">
            <el-icon><Document /></el-icon>
            提交审批申请
          </el-button>
          <el-table :data="approvalRecords" size="small" v-if="approvalRecords.length > 0" style="max-height: 300px; overflow: auto">
            <el-table-column prop="approval_type" label="类型" width="80" />
            <el-table-column prop="applicant" label="申请人" width="80" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="getApprovalStatusType(row.status)">
                  {{ getApprovalStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button v-if="row.status === 'pending'" link type="success" size="small" @click="approveAction(row.id, 'approve')">通过</el-button>
                <el-button v-if="row.status === 'pending'" link type="danger" size="small" @click="approveAction(row.id, 'reject')">拒绝</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无审批记录" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px">
      <template #header><span>时间线记录</span></template>
      <el-timeline>
        <el-timeline-item
          v-for="(item, index) in timeline"
          :key="index"
          :timestamp="formatDate(item.happened_at)"
          :type="getTimelineType(item.event_type)"
        >
          <template #dot>
            <el-icon :size="20">
              <component :is="getTimelineIcon(item.event_type)" />
            </el-icon>
          </template>
          <h4>{{ item.event_title }}</h4>
          <p>{{ item.event_detail }}</p>
          <p style="color: #909399; font-size: 12px">操作人: {{ item.operator || '系统' }}</p>
          <el-tag v-if="item.sla_impact_hours !== 0" size="small" :type="item.sla_impact_hours > 0 ? 'success' : 'danger'">
            SLA影响: {{ item.sla_impact_hours > 0 ? '+' : '' }}{{ item.sla_impact_hours }} 小时
          </el-tag>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span>暂停记录</span></template>
          <el-table :data="pauseRecords" size="small">
            <el-table-column prop="pause_reason_name" label="暂停原因" show-overflow-tooltip />
            <el-table-column prop="paused_by" label="操作人" width="100" />
            <el-table-column prop="paused_at" label="暂停时间" width="160">
              <template #default="{ row }">{{ formatDate(row.paused_at) }}</template>
            </el-table-column>
            <el-table-column prop="resumed_at" label="恢复时间" width="160">
              <template #default="{ row }">{{ row.resumed_at ? formatDate(row.resumed_at) : '未恢复' }}</template>
            </el-table-column>
            <el-table-column prop="pause_duration_hours" label="时长(小时)" width="100" />
          </el-table>
          <el-empty v-if="pauseRecords.length === 0" description="暂无暂停记录" :image-size="80" />
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span>升级记录</span></template>
          <el-table :data="escalationRecords" size="small">
            <el-table-column prop="escalation_type" label="升级类型" width="100" />
            <el-table-column prop="escalation_level" label="级别" width="70" />
            <el-table-column prop="escalated_to" label="升级至" show-overflow-tooltip />
            <el-table-column prop="escalated_at" label="时间" width="160">
              <template #default="{ row }">{{ formatDate(row.escalated_at) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="escalationRecords.length === 0" description="暂无升级记录" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="pauseDialogVisible" title="暂停SLA" width="500px">
      <el-form :model="pauseForm" label-width="100px">
        <el-form-item label="暂停原因" required>
          <el-select v-model="pauseForm.pause_reason_code" placeholder="请选择暂停原因">
            <el-option
              v-for="reason in pauseReasons"
              :key="reason.code"
              :label="reason.name"
              :value="reason.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人" required>
          <el-input v-model="pauseForm.paused_by" placeholder="请输入操作人" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="pauseForm.remarks" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pauseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPause">确定暂停</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resumeDialogVisible" title="恢复SLA" width="400px">
      <el-form :model="resumeForm" label-width="100px">
        <el-form-item label="操作人" required>
          <el-input v-model="resumeForm.resumed_by" placeholder="请输入操作人" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resumeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmResume">确定恢复</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="compensationDialogVisible" title="SLA补偿" width="500px">
      <el-form :model="compensationForm" label-width="100px">
        <el-form-item label="补偿类型" required>
          <el-select v-model="compensationForm.compensation_type" placeholder="请选择补偿类型">
            <el-option label="系统原因" value="system" />
            <el-option label="人工调整" value="manual" />
            <el-option label="其他原因" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="补偿时长(小时)" required>
          <el-input-number v-model="compensationForm.compensation_hours" :min="0.1" :step="0.5" />
        </el-form-item>
        <el-form-item label="操作人" required>
          <el-input v-model="compensationForm.operator" placeholder="请输入操作人" />
        </el-form-item>
        <el-form-item label="原因说明" required>
          <el-input v-model="compensationForm.reason" type="textarea" :rows="2" placeholder="请说明补偿原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="compensationDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCompensation">确认补偿</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="escalationDialogVisible" title="工单升级" width="500px">
      <el-form :model="escalationForm" label-width="100px">
        <el-form-item label="升级类型" required>
          <el-select v-model="escalationForm.escalation_type" placeholder="请选择升级类型">
            <el-option label="SLA超时预警" value="sla_warning" />
            <el-option label="技术支持升级" value="tech_support" />
            <el-option label="管理层介入" value="management" />
            <el-option label="其他升级" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="升级级别">
          <el-input-number v-model="escalationForm.escalation_level" :min="1" :max="5" />
        </el-form-item>
        <el-form-item label="升级至">
          <el-input v-model="escalationForm.escalated_to" placeholder="处理人或团队" />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="escalationForm.escalated_by" placeholder="请输入操作人" />
        </el-form-item>
        <el-form-item label="原因说明">
          <el-input v-model="escalationForm.reason" type="textarea" :rows="2" placeholder="请说明升级原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="escalationDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEscalation">确认升级</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="approvalDialogVisible" title="提交审批" width="500px">
      <el-form :model="approvalForm" label-width="100px">
        <el-form-item label="审批类型" required>
          <el-select v-model="approvalForm.approval_type" placeholder="请选择审批类型">
            <el-option label="SLA豁免" value="sla_exemption" />
            <el-option label="特殊处理" value="special_handling" />
            <el-option label="其他审批" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请人" required>
          <el-input v-model="approvalForm.applicant" placeholder="请输入申请人" />
        </el-form-item>
        <el-form-item label="申请原因">
          <el-input v-model="approvalForm.reason" type="textarea" :rows="2" placeholder="请说明申请原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmApproval">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  CirclePlus, TrendCharts, Download, VideoPause, VideoPlay, Refresh, Document,
  SuccessFilled, Plus, View, Timer, Warning, CircleCheck
} from '@element-plus/icons-vue'
import { ticketApi, configApi, exportApi } from '@/utils/api'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()

const ticketId = route.params.id

const ticket = ref(null)
const slaRules = ref([])
const pauseReasons = ref([])
const slaPaths = ref({})
const timeline = ref([])
const pauseRecords = ref([])
const escalationRecords = ref([])
const approvalRecords = ref([])

const pauseDialogVisible = ref(false)
const resumeDialogVisible = ref(false)
const compensationDialogVisible = ref(false)
const escalationDialogVisible = ref(false)
const approvalDialogVisible = ref(false)

const pauseForm = ref({
  ticket_id: ticketId,
  pause_reason_code: '',
  paused_by: '',
  remarks: ''
})

const resumeForm = ref({
  ticket_id: ticketId,
  resumed_by: ''
})

const compensationForm = ref({
  ticket_id: ticketId,
  compensation_type: '',
  compensation_hours: 1,
  reason: '',
  operator: ''
})

const escalationForm = ref({
  ticket_id: ticketId,
  escalation_type: '',
  escalation_level: 1,
  escalated_by: '',
  escalated_to: '',
  reason: ''
})

const approvalForm = ref({
  ticket_id: ticketId,
  approval_type: '',
  applicant: '',
  reason: ''
})

const loadTicketDetail = async () => {
  try {
    const data = await ticketApi.getDetail(ticketId)
    ticket.value = data.ticket
    timeline.value = data.timeline || []
    pauseRecords.value = data.pause_records || []
    escalationRecords.value = data.escalation_records || []
    approvalRecords.value = data.approval_records || []
  } catch (error) {
    ElMessage.error('加载工单详情失败')
  }
}

const loadSlaPaths = async () => {
  try {
    const data = await ticketApi.getSlaPaths(ticketId)
    slaPaths.value = data.paths || {}
  } catch (error) {
    console.error('加载SLA路径失败')
  }
}

const loadSlaRules = async () => {
  try {
    slaRules.value = await configApi.getSlaRules()
  } catch (error) {
    console.error('加载SLA规则失败')
  }
}

const loadPauseReasons = async () => {
  try {
    pauseReasons.value = await configApi.getPauseReasons()
  } catch (error) {
    console.error('加载暂停原因失败')
  }
}

const goBack = () => {
  router.push('/')
}

const exportTicket = () => {
  exportApi.exportTicket(ticketId)
}

const showPauseDialog = () => {
  pauseForm.value = {
    ticket_id: ticketId,
    pause_reason_code: '',
    paused_by: '',
    remarks: ''
  }
  pauseDialogVisible.value = true
}

const confirmPause = async () => {
  if (!pauseForm.value.pause_reason_code || !pauseForm.value.paused_by) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    await ticketApi.pause(pauseForm.value)
    ElMessage.success('SLA已暂停')
    pauseDialogVisible.value = false
    loadTicketDetail()
    loadSlaPaths()
  } catch (error) {
    ElMessage.error('暂停失败')
  }
}

const showResumeDialog = () => {
  resumeForm.value = {
    ticket_id: ticketId,
    resumed_by: ''
  }
  resumeDialogVisible.value = true
}

const confirmResume = async () => {
  if (!resumeForm.value.resumed_by) {
    ElMessage.warning('请填写操作人')
    return
  }
  try {
    await ticketApi.resume(resumeForm.value)
    ElMessage.success('SLA已恢复')
    resumeDialogVisible.value = false
    loadTicketDetail()
    loadSlaPaths()
  } catch (error) {
    ElMessage.error('恢复失败')
  }
}

const showCompensationDialog = () => {
  compensationForm.value = {
    ticket_id: ticketId,
    compensation_type: '',
    compensation_hours: 1,
    reason: '',
    operator: ''
  }
  compensationDialogVisible.value = true
}

const confirmCompensation = async () => {
  if (!compensationForm.value.compensation_type || !compensationForm.value.operator || !compensationForm.value.reason) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    await ticketApi.compensation(compensationForm.value)
    ElMessage.success('补偿已应用')
    compensationDialogVisible.value = false
    loadTicketDetail()
    loadSlaPaths()
  } catch (error) {
    ElMessage.error('补偿失败')
  }
}

const showEscalationDialog = () => {
  escalationForm.value = {
    ticket_id: ticketId,
    escalation_type: '',
    escalation_level: 1,
    escalated_by: '',
    escalated_to: '',
    reason: ''
  }
  escalationDialogVisible.value = true
}

const confirmEscalation = async () => {
  if (!escalationForm.value.escalation_type) {
    ElMessage.warning('请选择升级类型')
    return
  }
  try {
    await ticketApi.createEscalation(escalationForm.value)
    ElMessage.success('升级已提交')
    escalationDialogVisible.value = false
    loadTicketDetail()
  } catch (error) {
    ElMessage.error('升级失败')
  }
}

const showApprovalDialog = () => {
  approvalForm.value = {
    ticket_id: ticketId,
    approval_type: '',
    applicant: '',
    reason: ''
  }
  approvalDialogVisible.value = true
}

const confirmApproval = async () => {
  if (!approvalForm.value.approval_type || !approvalForm.value.applicant) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    await ticketApi.createApproval(approvalForm.value)
    ElMessage.success('审批已提交')
    approvalDialogVisible.value = false
    loadTicketDetail()
  } catch (error) {
    ElMessage.error('提交失败')
  }
}

const approveAction = async (id, action) => {
  try {
    await ticketApi.approvalAction(id, { action, approver: 'admin', remarks: '' })
    ElMessage.success(action === 'approve' ? '已通过' : '已拒绝')
    loadTicketDetail()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const recalculateSLA = async () => {
  try {
    await ticketApi.calculateSLA({ ticket_id: ticketId, recalculate: true })
    ElMessage.success('SLA已重新计算')
    loadTicketDetail()
    loadSlaPaths()
  } catch (error) {
    ElMessage.error('计算失败')
  }
}

const getPriorityType = (priority) => {
  const map = { low: 'info', normal: '', high: 'warning', critical: 'danger' }
  return map[priority] || ''
}

const getPriorityLabel = (priority) => {
  const map = { low: '低', normal: '普通', high: '高', critical: '紧急' }
  return map[priority] || priority
}

const getStatusType = (status) => {
  const map = { open: 'info', in_progress: 'primary', resolved: 'success', closed: 'info' }
  return map[status] || ''
}

const getStatusLabel = (status) => {
  const map = { open: '新建', in_progress: '处理中', resolved: '已解决', closed: '已关闭' }
  return map[status] || status
}

const getSlaStatusType = (status) => {
  const map = { running: 'success', paused: 'info', warning: 'warning', breached: 'danger', completed: 'success' }
  return map[status] || ''
}

const getSlaStatusLabel = (status) => {
  const map = { running: '运行中', paused: '已暂停', warning: '即将超时', breached: '已超时', completed: '已完成', no_rule: '无规则' }
  return map[status] || status
}

const getApprovalStatusType = (status) => {
  const map = { pending: 'warning', approved: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

const getApprovalStatusLabel = (status) => {
  const map = { pending: '待审批', approved: '已通过', rejected: '已拒绝' }
  return map[status] || status
}

const getTimelineType = (type) => {
  const map = { create: 'primary', pause: 'warning', resume: 'info', escalation: 'danger', approval: 'warning', compensation: 'success', sla_recalculation: 'info' }
  return map[type] || ''
}

const getTimelineIcon = (type) => {
  const map = { create: CirclePlus, pause: VideoPause, resume: VideoPlay, escalation: Warning, approval: Document, compensation: Plus, sla_recalculation: Refresh }
  return map[type] || Timer
}

const formatDate = (date) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadTicketDetail()
  loadSlaPaths()
  loadSlaRules()
  loadPauseReasons()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
