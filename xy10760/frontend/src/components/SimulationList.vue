<template>
  <div class="simulation-list">
    <el-card class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="申请单号">
          <el-input v-model="filterForm.application_no" placeholder="请输入申请单号" clearable />
        </el-form-item>
        <el-form-item label="规则版本">
          <el-input v-model="filterForm.rule_version" placeholder="请输入规则版本" clearable />
        </el-form-item>
        <el-form-item label="模拟状态">
          <el-select v-model="filterForm.simulation_status" placeholder="请选择状态" clearable>
            <el-option label="成功" value="success" />
            <el-option label="警告" value="warning" />
            <el-option label="失败" value="error" />
          </el-select>
        </el-form-item>
        <el-form-item label="发布状态">
          <el-select v-model="filterForm.published" placeholder="请选择" clearable>
            <el-option label="已发布" :value="true" />
            <el-option label="未发布" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建模拟
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column prop="id" label="模拟ID" width="80" />
        <el-table-column prop="application_id" label="申请单ID" width="100" />
        <el-table-column prop="rule_version_id" label="规则版本ID" width="120" />
        <el-table-column prop="simulation_status" label="模拟状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.simulation_status)">
              {{ getStatusText(row.simulation_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="final_approval_result" label="审批结果" width="100" />
        <el-table-column prop="skip_reason_text" label="跳过原因" min-width="150" show-overflow-tooltip />
        <el-table-column prop="published" label="发布状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.published ? 'success' : 'info'">
              {{ row.published ? '已发布' : '未发布' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_by" label="创建人" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">
              查看详情
            </el-button>
            <el-button 
              link 
              type="warning" 
              size="small" 
              @click="handleConfirmSkip(row)"
              v-if="row.skip_reason_id && !row.skip_manual_confirmed"
            >
              确认跳过
            </el-button>
            <el-button link type="success" size="small" @click="handlePublish(row)" v-if="!row.published">
              发布
            </el-button>
            <el-button link type="primary" size="small" @click="handleExport(row)">
              导出
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建模拟" width="600px">
      <el-form :model="createForm" label-width="120px">
        <el-form-item label="申请单">
          <el-select v-model="createForm.application_id" placeholder="请选择申请单" style="width: 100%">
            <el-option 
              v-for="app in applications" 
              :key="app.id" 
              :label="app.application_no" 
              :value="app.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="规则版本">
          <el-select v-model="createForm.rule_version_id" placeholder="请选择规则版本" style="width: 100%">
            <el-option 
              v-for="rule in ruleVersions" 
              :key="rule.id" 
              :label="rule.version + ' - ' + rule.name" 
              :value="rule.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="命中条件">
          <el-select v-model="createForm.hit_condition_ids" multiple placeholder="请选择命中条件" style="width: 100%">
            <el-option 
              v-for="condition in hitConditions" 
              :key="condition.id" 
              :label="condition.condition_type + ' - ' + condition.condition_value" 
              :value="condition.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="审批人">
          <el-select v-model="createForm.approver_ids" multiple placeholder="请选择审批人" style="width: 100%">
            <el-option 
              v-for="approver in approvers" 
              :key="approver.id" 
              :label="approver.name + ' - ' + approver.department" 
              :value="approver.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="跳过原因">
          <el-select v-model="createForm.skip_reason_id" placeholder="请选择跳过原因（可选）" style="width: 100%" clearable>
            <el-option 
              v-for="reason in skipReasons" 
              :key="reason.id" 
              :label="reason.reason_text" 
              :value="reason.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="审批结果">
          <el-input v-model="createForm.final_approval_result" placeholder="请输入审批结果" />
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="createForm.created_by" placeholder="请输入创建人" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">确定</el-button>
      </template>
    </el-dialog>

    <SimulationDetail 
      v-model:visible="showDetailDialog" 
      :simulation-id="currentSimulationId" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import { simulationApi, applicationApi, ruleVersionApi, hitConditionApi, approverApi, skipReasonApi } from '../api'
import SimulationDetail from './SimulationDetail.vue'

const loading = ref(false)
const tableData = ref([])
const showCreateDialog = ref(false)
const showDetailDialog = ref(false)
const currentSimulationId = ref(null)
const applications = ref([])
const ruleVersions = ref([])
const hitConditions = ref([])
const approvers = ref([])
const skipReasons = ref([])

const filterForm = ref({
  application_no: '',
  rule_version: '',
  simulation_status: '',
  published: null
})

const createForm = ref({
  idempotent_key: '',
  application_id: null,
  rule_version_id: null,
  hit_condition_ids: [],
  approver_ids: [],
  approver_names: [],
  skip_reason_id: null,
  skip_reason_text: '',
  simulation_status: 'success',
  error_details: '',
  approver_errors: [],
  final_approval_result: '',
  created_by: ''
})

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...filterForm.value,
      published: filterForm.value.published === '' ? null : filterForm.value.published
    }
    const res = await simulationApi.list(params)
    tableData.value = res.data
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const loadSelectOptions = async () => {
  try {
    const [appRes, ruleRes, approverRes, skipRes] = await Promise.all([
      applicationApi.list(),
      ruleVersionApi.list(),
      approverApi.list(),
      skipReasonApi.list()
    ])
    applications.value = appRes.data
    ruleVersions.value = ruleRes.data
    approvers.value = approverRes.data
    skipReasons.value = skipRes.data
  } catch (error) {
    console.error('加载选项失败', error)
  }
}

const handleSearch = () => {
  loadData()
}

const handleReset = () => {
  filterForm.value = {
    application_no: '',
    rule_version: '',
    simulation_status: '',
    published: null
  }
  loadData()
}

const handleView = (row) => {
  currentSimulationId.value = row.id
  showDetailDialog.value = true
}

const handleConfirmSkip = async (row) => {
  try {
    await ElMessageBox.confirm('确认要跳过审批吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await simulationApi.confirmSkip(row.id, { confirmed_by: 'admin' })
    ElMessage.success('确认成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

const handlePublish = async (row) => {
  try {
    await simulationApi.publish(row.id)
    ElMessage.success('发布成功')
    loadData()
  } catch (error) {
    ElMessage.error('发布失败')
  }
}

const handleExport = (row) => {
  simulationApi.export(row.id)
}

const handleCreate = async () => {
  try {
    createForm.value.idempotent_key = 'key_' + Date.now()
    
    const selectedApprovers = approvers.value.filter(a => 
      createForm.value.approver_ids.includes(a.id)
    )
    createForm.value.approver_names = selectedApprovers.map(a => a.name)
    
    const selectedSkipReason = skipReasons.value.find(r => 
      r.id === createForm.value.skip_reason_id
    )
    if (selectedSkipReason) {
      createForm.value.skip_reason_text = selectedSkipReason.reason_text
    }

    if (createForm.value.rule_version_id) {
      const res = await hitConditionApi.list(createForm.value.rule_version_id)
      hitConditions.value = res.data
    }

    await simulationApi.create(createForm.value)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    loadData()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const getStatusType = (status) => {
  const map = {
    success: 'success',
    warning: 'warning',
    error: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    success: '成功',
    warning: '警告',
    error: '失败'
  }
  return map[status] || '未知'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadData()
  loadSelectOptions()
})
</script>

<style scoped>
.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  margin-bottom: 0;
}

.table-card {
  margin-top: 20px;
}
</style>
