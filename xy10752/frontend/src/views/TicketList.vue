<template>
  <div class="ticket-list">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>工单列表</span>
          <div>
            <el-button type="primary" @click="showCreateDialog">
              <el-icon><Plus /></el-icon>
              新建工单
            </el-button>
            <el-button type="success" @click="exportAll">
              <el-icon><Download /></el-icon>
              导出全部
            </el-button>
            <el-button type="info" @click="exportSelected" :disabled="selectedTickets.length === 0">
              <el-icon><Download /></el-icon>
              导出选中
            </el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable>
            <el-option label="新建" value="open" />
            <el-option label="处理中" value="in_progress" />
            <el-option label="已解决" value="resolved" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="filters.priority" placeholder="全部" clearable>
            <el-option label="低" value="low" />
            <el-option label="普通" value="normal" />
            <el-option label="高" value="high" />
            <el-option label="紧急" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadTickets">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table
        :data="tickets"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="ticket_no" label="工单编号" width="120" />
        <el-table-column prop="title" label="工单标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="priority" label="优先级" width="100">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)">
              {{ getPriorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="current_sla_status" label="SLA状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getSlaStatusType(row.current_sla_status)">
              {{ getSlaStatusLabel(row.current_sla_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remaining_hours" label="剩余工时(小时)" width="120">
          <template #default="{ row }">
            <span :style="{ color: row.remaining_hours < 4 ? '#f56c6c' : '' }">
              {{ row.remaining_hours }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="assignee" label="处理人" width="100" />
        <el-table-column prop="creator" label="创建人" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">查看</el-button>
            <el-button link type="warning" @click="pauseTicket(row)" :disabled="row.current_sla_status === 'paused'">
              暂停
            </el-button>
            <el-button link type="success" @click="resumeTicket(row)" :disabled="row.current_sla_status !== 'paused'">
              恢复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新建工单" width="600px">
      <el-form :model="ticketForm" label-width="100px">
        <el-form-item label="工单编号" required>
          <el-input v-model="ticketForm.ticket_no" placeholder="请输入工单编号" />
        </el-form-item>
        <el-form-item label="工单标题" required>
          <el-input v-model="ticketForm.title" placeholder="请输入工单标题" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="ticketForm.priority" placeholder="请选择优先级">
            <el-option label="低" value="low" />
            <el-option label="普通" value="normal" />
            <el-option label="高" value="high" />
            <el-option label="紧急" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="SLA规则">
          <el-select v-model="ticketForm.sla_rule_id" placeholder="请选择SLA规则">
            <el-option
              v-for="rule in slaRules"
              :key="rule.id"
              :label="rule.name"
              :value="rule.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="ticketForm.assignee" placeholder="请输入处理人" />
        </el-form-item>
        <el-form-item label="创建人" required>
          <el-input v-model="ticketForm.creator" placeholder="请输入创建人" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="ticketForm.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createTicket">确定</el-button>
      </template>
    </el-dialog>

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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Download } from '@element-plus/icons-vue'
import { ticketApi, configApi, exportApi } from '@/utils/api'
import dayjs from 'dayjs'

const router = useRouter()

const tickets = ref([])
const loading = ref(false)
const selectedTickets = ref([])
const slaRules = ref([])
const pauseReasons = ref([])

const filters = ref({
  status: '',
  priority: ''
})

const createDialogVisible = ref(false)
const pauseDialogVisible = ref(false)
const resumeDialogVisible = ref(false)
const currentTicket = ref(null)

const ticketForm = ref({
  ticket_no: '',
  title: '',
  description: '',
  priority: 'normal',
  sla_rule_id: null,
  assignee: '',
  creator: ''
})

const pauseForm = ref({
  ticket_id: null,
  pause_reason_code: '',
  paused_by: '',
  remarks: ''
})

const resumeForm = ref({
  ticket_id: null,
  resumed_by: ''
})

const loadTickets = async () => {
  loading.value = true
  try {
    tickets.value = await ticketApi.getList(filters.value)
  } catch (error) {
    ElMessage.error('加载工单列表失败')
  } finally {
    loading.value = false
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

const resetFilters = () => {
  filters.value = { status: '', priority: '' }
  loadTickets()
}

const handleSelectionChange = (selection) => {
  selectedTickets.value = selection
}

const viewDetail = (id) => {
  router.push(`/ticket/${id}`)
}

const showCreateDialog = () => {
  ticketForm.value = {
    ticket_no: '',
    title: '',
    description: '',
    priority: 'normal',
    sla_rule_id: null,
    assignee: '',
    creator: ''
  }
  createDialogVisible.value = true
}

const createTicket = async () => {
  if (!ticketForm.value.ticket_no || !ticketForm.value.title || !ticketForm.value.creator) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    await ticketApi.create(ticketForm.value)
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    loadTickets()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const pauseTicket = (row) => {
  currentTicket.value = row
  pauseForm.value = {
    ticket_id: row.id,
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
    loadTickets()
  } catch (error) {
    ElMessage.error('暂停失败')
  }
}

const resumeTicket = (row) => {
  currentTicket.value = row
  resumeForm.value = {
    ticket_id: row.id,
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
    loadTickets()
  } catch (error) {
    ElMessage.error('恢复失败')
  }
}

const exportAll = () => {
  exportApi.exportTickets(filters.value)
}

const exportSelected = () => {
  const ids = selectedTickets.value.map(t => t.id)
  exportApi.exportSelected(ids)
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

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadTickets()
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

.filter-form {
  margin-bottom: 20px;
}
</style>
