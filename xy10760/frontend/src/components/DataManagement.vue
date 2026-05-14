<template>
  <div class="data-management">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="申请单管理" name="applications">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>申请单列表</span>
              <el-button type="primary" size="small" @click="showAppDialog = true">
                <el-icon><Plus /></el-icon>
                新增
              </el-button>
            </div>
          </template>
          <el-table :data="applications" border stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="application_no" label="申请单号" width="150" />
            <el-table-column prop="applicant" label="申请人" width="120" />
            <el-table-column prop="department" label="部门" width="120" />
            <el-table-column prop="application_type" label="类型" width="120" />
            <el-table-column prop="amount" label="金额" width="120">
              <template #default="{ row }">
                {{ row.amount }} 元
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="规则版本管理" name="rules">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>规则版本列表</span>
              <el-button type="primary" size="small" @click="showRuleDialog = true">
                <el-icon><Plus /></el-icon>
                新增
              </el-button>
            </div>
          </template>
          <el-table :data="ruleVersions" border stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="version" label="版本号" width="120" />
            <el-table-column prop="name" label="规则名称" width="200" />
            <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column prop="is_active" label="是否启用" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'">
                  {{ row.is_active ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_by" label="创建人" width="100" />
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="命中条件管理" name="conditions">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>命中条件列表</span>
              <div>
                <el-select v-model="selectedRuleId" placeholder="选择规则版本" style="width: 200px; margin-right: 12px;">
                  <el-option 
                    v-for="rule in ruleVersions" 
                    :key="rule.id" 
                    :label="rule.version + ' - ' + rule.name" 
                    :value="rule.id" 
                  />
                </el-select>
                <el-button type="primary" size="small" @click="showConditionDialog = true" :disabled="!selectedRuleId">
                  <el-icon><Plus /></el-icon>
                  新增
                </el-button>
              </div>
            </div>
          </template>
          <el-table :data="hitConditions" border stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="condition_type" label="条件类型" width="150" />
            <el-table-column prop="condition_expression" label="条件表达式" min-width="200" show-overflow-tooltip />
            <el-table-column prop="condition_value" label="条件值" width="150" />
            <el-table-column prop="operator" label="运算符" width="100" />
            <el-table-column prop="priority" label="优先级" width="100" />
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="审批人管理" name="approvers">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>审批人列表</span>
              <el-button type="primary" size="small" @click="showApproverDialog = true">
                <el-icon><Plus /></el-icon>
                新增
              </el-button>
            </div>
          </template>
          <el-table :data="approvers" border stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="email" label="邮箱" width="200" />
            <el-table-column prop="department" label="部门" width="150" />
            <el-table-column prop="level" label="级别" width="100">
              <template #default="{ row }">
                L{{ row.level }}
              </template>
            </el-table-column>
            <el-table-column prop="is_active" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'danger'">
                  {{ row.is_active ? '正常' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="跳过原因管理" name="skip-reasons">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>跳过原因列表</span>
              <el-button type="primary" size="small" @click="showSkipReasonDialog = true">
                <el-icon><Plus /></el-icon>
                新增
              </el-button>
            </div>
          </template>
          <el-table :data="skipReasons" border stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="reason_code" label="原因编码" width="150" />
            <el-table-column prop="reason_text" label="原因内容" min-width="300" show-overflow-tooltip />
            <el-table-column prop="need_manual_confirm" label="需要人工确认" width="150">
              <template #default="{ row }">
                <el-tag :type="row.need_manual_confirm ? 'warning' : 'info'">
                  {{ row.need_manual_confirm ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showAppDialog" title="新增申请单" width="500px">
      <el-form :model="appForm" label-width="100px">
        <el-form-item label="申请单号">
          <el-input v-model="appForm.application_no" />
        </el-form-item>
        <el-form-item label="申请人">
          <el-input v-model="appForm.applicant" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="appForm.department" />
        </el-form-item>
        <el-form-item label="申请类型">
          <el-input v-model="appForm.application_type" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="appForm.amount" :min="0" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAppDialog = false">取消</el-button>
        <el-button type="primary" @click="createApplication">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRuleDialog" title="新增规则版本" width="500px">
      <el-form :model="ruleForm" label-width="100px">
        <el-form-item label="版本号">
          <el-input v-model="ruleForm.version" />
        </el-form-item>
        <el-form-item label="规则名称">
          <el-input v-model="ruleForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="ruleForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="ruleForm.is_active" />
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="ruleForm.created_by" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRuleDialog = false">取消</el-button>
        <el-button type="primary" @click="createRuleVersion">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showConditionDialog" title="新增命中条件" width="500px">
      <el-form :model="conditionForm" label-width="120px">
        <el-form-item label="条件类型">
          <el-input v-model="conditionForm.condition_type" />
        </el-form-item>
        <el-form-item label="条件表达式">
          <el-input v-model="conditionForm.condition_expression" />
        </el-form-item>
        <el-form-item label="条件值">
          <el-input v-model="conditionForm.condition_value" />
        </el-form-item>
        <el-form-item label="运算符">
          <el-input v-model="conditionForm.operator" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="conditionForm.priority" :min="0" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConditionDialog = false">取消</el-button>
        <el-button type="primary" @click="createHitCondition">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showApproverDialog" title="新增审批人" width="500px">
      <el-form :model="approverForm" label-width="100px">
        <el-form-item label="姓名">
          <el-input v-model="approverForm.name" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="approverForm.email" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="approverForm.department" />
        </el-form-item>
        <el-form-item label="级别">
          <el-input-number v-model="approverForm.level" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="approverForm.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showApproverDialog = false">取消</el-button>
        <el-button type="primary" @click="createApprover">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showSkipReasonDialog" title="新增跳过原因" width="500px">
      <el-form :model="skipReasonForm" label-width="120px">
        <el-form-item label="原因编码">
          <el-input v-model="skipReasonForm.reason_code" />
        </el-form-item>
        <el-form-item label="原因内容">
          <el-input v-model="skipReasonForm.reason_text" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="需要人工确认">
          <el-switch v-model="skipReasonForm.need_manual_confirm" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSkipReasonDialog = false">取消</el-button>
        <el-button type="primary" @click="createSkipReason">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { 
  applicationApi, 
  ruleVersionApi, 
  hitConditionApi, 
  approverApi, 
  skipReasonApi 
} from '../api'

const activeTab = ref('applications')
const applications = ref([])
const ruleVersions = ref([])
const hitConditions = ref([])
const approvers = ref([])
const skipReasons = ref([])
const selectedRuleId = ref(null)

const showAppDialog = ref(false)
const showRuleDialog = ref(false)
const showConditionDialog = ref(false)
const showApproverDialog = ref(false)
const showSkipReasonDialog = ref(false)

const appForm = ref({
  application_no: '',
  applicant: '',
  department: '',
  application_type: '',
  amount: 0,
  status: 'pending',
  extra_data: {}
})

const ruleForm = ref({
  version: '',
  name: '',
  description: '',
  is_active: false,
  created_by: ''
})

const conditionForm = ref({
  rule_version_id: null,
  condition_type: '',
  condition_expression: '',
  condition_value: '',
  operator: '',
  priority: 0
})

const approverForm = ref({
  name: '',
  email: '',
  department: '',
  level: 1,
  is_active: true
})

const skipReasonForm = ref({
  reason_code: '',
  reason_text: '',
  need_manual_confirm: false
})

const loadApplications = async () => {
  try {
    const res = await applicationApi.list()
    applications.value = res.data
  } catch (error) {
    ElMessage.error('加载申请单失败')
  }
}

const loadRuleVersions = async () => {
  try {
    const res = await ruleVersionApi.list()
    ruleVersions.value = res.data
  } catch (error) {
    ElMessage.error('加载规则版本失败')
  }
}

const loadHitConditions = async (ruleId) => {
  if (!ruleId) {
    hitConditions.value = []
    return
  }
  try {
    const res = await hitConditionApi.list(ruleId)
    hitConditions.value = res.data
  } catch (error) {
    ElMessage.error('加载命中条件失败')
  }
}

const loadApprovers = async () => {
  try {
    const res = await approverApi.list()
    approvers.value = res.data
  } catch (error) {
    ElMessage.error('加载审批人失败')
  }
}

const loadSkipReasons = async () => {
  try {
    const res = await skipReasonApi.list()
    skipReasons.value = res.data
  } catch (error) {
    ElMessage.error('加载跳过原因失败')
  }
}

watch(selectedRuleId, (newVal) => {
  if (newVal) {
    loadHitConditions(newVal)
  }
})

const createApplication = async () => {
  try {
    await applicationApi.create(appForm.value)
    ElMessage.success('创建成功')
    showAppDialog.value = false
    loadApplications()
    appForm.value = {
      application_no: '',
      applicant: '',
      department: '',
      application_type: '',
      amount: 0,
      status: 'pending',
      extra_data: {}
    }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const createRuleVersion = async () => {
  try {
    await ruleVersionApi.create(ruleForm.value)
    ElMessage.success('创建成功')
    showRuleDialog.value = false
    loadRuleVersions()
    ruleForm.value = {
      version: '',
      name: '',
      description: '',
      is_active: false,
      created_by: ''
    }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const createHitCondition = async () => {
  try {
    conditionForm.value.rule_version_id = selectedRuleId.value
    await hitConditionApi.create(conditionForm.value)
    ElMessage.success('创建成功')
    showConditionDialog.value = false
    loadHitConditions(selectedRuleId.value)
    conditionForm.value = {
      rule_version_id: null,
      condition_type: '',
      condition_expression: '',
      condition_value: '',
      operator: '',
      priority: 0
    }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const createApprover = async () => {
  try {
    await approverApi.create(approverForm.value)
    ElMessage.success('创建成功')
    showApproverDialog.value = false
    loadApprovers()
    approverForm.value = {
      name: '',
      email: '',
      department: '',
      level: 1,
      is_active: true
    }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const createSkipReason = async () => {
  try {
    await skipReasonApi.create(skipReasonForm.value)
    ElMessage.success('创建成功')
    showSkipReasonDialog.value = false
    loadSkipReasons()
    skipReasonForm.value = {
      reason_code: '',
      reason_text: '',
      need_manual_confirm: false
    }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadApplications()
  loadRuleVersions()
  loadApprovers()
  loadSkipReasons()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
