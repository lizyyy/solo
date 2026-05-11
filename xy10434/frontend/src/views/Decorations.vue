<template>
  <div class="decorations-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="filter-form">
            <el-form :inline="true" :model="filterForm" @submit.prevent="loadData">
              <el-form-item label="状态">
                <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 140px" @change="loadData">
                  <el-option label="待审批" value="pending" />
                  <el-option label="进行中" value="in_progress" />
                  <el-option label="退押中" value="refunding" />
                  <el-option label="已完成" value="completed" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="openCreateDialog">
                  <el-icon><Plus /></el-icon>新建装修申请
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>
      <el-table :data="decorations" v-loading="loading">
        <el-table-column prop="building" label="楼栋" width="80" />
        <el-table-column prop="unit" label="单元" width="80" />
        <el-table-column prop="room_number" label="房号" width="80" />
        <el-table-column prop="owner_name" label="业主" width="100" />
        <el-table-column prop="team_name" label="施工队" width="120" />
        <el-table-column prop="start_date" label="开工日期" width="110" />
        <el-table-column prop="expected_end_date" label="预计完工" width="110" />
        <el-table-column label="装修状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deposit_amount" label="押金" width="100">
          <template #default="scope">¥{{ scope.row.deposit_amount }}</template>
        </el-table-column>
        <el-table-column prop="total_deduction" label="扣款" width="80">
          <template #default="scope">
            <span v-if="scope.row.total_deduction > 0" style="color: #e6a23c">-¥{{ scope.row.total_deduction }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="goToDetail(scope.row.id)">详情</el-button>
            <el-button v-if="scope.row.status === 'pending'" type="success" link @click="handleStart(scope.row)">开工</el-button>
            <el-button v-if="scope.row.status === 'in_progress'" type="warning" link @click="handleReceiveDeposit(scope.row)">收押金</el-button>
            <el-button v-if="scope.row.status === 'in_progress'" type="success" link @click="handleApplyRefund(scope.row)">申请退押</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新建装修申请" width="600px">
      <el-form :model="decorationForm" :rules="decorationRules" ref="decorationFormRef" label-width="100px">
        <el-form-item label="房号" prop="room_id">
          <el-select v-model="decorationForm.room_id" placeholder="选择房号" style="width: 100%" filterable>
            <el-option 
              v-for="room in rooms" 
              :key="room.id" 
              :label="`${room.building}-${room.unit}-${room.room_number}${room.owner_name ? ' (' + room.owner_name + ')' : ''}`"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="业主" prop="owner_id">
          <el-select v-model="decorationForm.owner_id" placeholder="选择业主" style="width: 100%" filterable>
            <el-option 
              v-for="owner in owners" 
              :key="owner.id" 
              :label="`${owner.name}${owner.phone ? ' (' + owner.phone + ')' : ''}`"
              :value="owner.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="施工队">
          <el-select v-model="decorationForm.team_id" placeholder="选择施工队" style="width: 100%" filterable>
            <el-option 
              v-for="team in teams" 
              :key="team.id" 
              :label="team.name"
              :value="team.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开工日期">
          <el-date-picker v-model="decorationForm.start_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="预计完工">
          <el-date-picker v-model="decorationForm.expected_end_date" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="押金金额" prop="deposit_amount">
          <el-input-number v-model="decorationForm.deposit_amount" :min="0" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="decorationForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitDecoration">提交</el-button>
      </template>
    </el-dialog>

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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const decorations = ref([])
const owners = ref([])
const rooms = ref([])
const teams = ref([])

const filterForm = reactive({
  status: ''
})

const createDialogVisible = ref(false)
const depositDialogVisible = ref(false)
const currentDecoration = ref(null)
const decorationFormRef = ref(null)
const depositFormRef = ref(null)

const decorationForm = reactive({
  room_id: null,
  owner_id: null,
  team_id: null,
  start_date: null,
  expected_end_date: null,
  deposit_amount: 5000,
  remark: ''
})

const depositForm = reactive({
  amount: 5000,
  payment_method: '',
  operator: '',
  remark: ''
})

const decorationRules = {
  room_id: [{ required: true, message: '请选择房号', trigger: 'change' }],
  owner_id: [{ required: true, message: '请选择业主', trigger: 'change' }],
  deposit_amount: [{ required: true, message: '请输入押金金额', trigger: 'blur' }]
}

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

async function loadData() {
  loading.value = true
  try {
    const params = {}
    if (filterForm.status) params.status = filterForm.status
    const response = await api.get('/decorations', { params })
    decorations.value = response.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function loadOwners() {
  try {
    const response = await api.get('/owners')
    owners.value = response.data
  } catch (err) {
    console.error(err)
  }
}

async function loadRooms() {
  try {
    const response = await api.get('/rooms')
    rooms.value = response.data
  } catch (err) {
    console.error(err)
  }
}

async function loadTeams() {
  try {
    const response = await api.get('/decorations/teams')
    teams.value = response.data
  } catch (err) {
    console.error(err)
  }
}

function openCreateDialog() {
  Object.assign(decorationForm, {
    room_id: null,
    owner_id: null,
    team_id: null,
    start_date: null,
    expected_end_date: null,
    deposit_amount: 5000,
    remark: ''
  })
  createDialogVisible.value = true
}

async function submitDecoration() {
  try {
    await decorationFormRef.value.validate()
    submitting.value = true
    const data = { ...decorationForm }
    if (data.start_date) data.start_date = data.start_date.toISOString().slice(0, 10)
    if (data.expected_end_date) data.expected_end_date = data.expected_end_date.toISOString().slice(0, 10)
    await api.post('/decorations', data)
    ElMessage.success('装修申请创建成功')
    createDialogVisible.value = false
    loadData()
  } catch (err) {
    console.error(err)
  } finally {
    submitting.value = false
  }
}

function goToDetail(id) {
  router.push(`/decoration/${id}`)
}

async function handleStart(row) {
  try {
    await ElMessageBox.confirm('确认开始装修吗？系统将检查押金是否已收取。', '提示', {
      type: 'warning'
    })
    await api.put(`/decorations/${row.id}`, { status: 'in_progress' })
    ElMessage.success('装修已开始')
    loadData()
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}

function handleReceiveDeposit(row) {
  currentDecoration.value = row
  depositForm.amount = row.deposit_amount
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
      decoration_id: currentDecoration.value.id,
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

async function handleApplyRefund(row) {
  try {
    await ElMessageBox.confirm('确认申请退押吗？系统将检查是否有未复核的违规记录。', '提示', {
      type: 'warning'
    })
    await api.post('/refunds', {
      decoration_id: row.id,
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
  loadOwners()
  loadRooms()
  loadTeams()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  width: 100%;
}
</style>
