<template>
  <div class="requests-page">
    <el-row :gutter="20">
      <el-col :span="10">
        <el-card class="form-card">
          <template #header>
            <div class="card-title">
              <el-icon><Plus /></el-icon>
              新建借调申请
            </div>
          </template>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="100px"
            class="transfer-form"
          >
            <el-form-item label="员工" prop="employee_id">
              <el-select
                v-model="form.employee_id"
                placeholder="请选择员工"
                @change="onEmployeeChange"
                filterable
                clearable
              >
                <el-option
                  v-for="emp in employees"
                  :key="emp.id"
                  :label="`${emp.name} (${emp.original_store_name})`"
                  :value="emp.id"
                >
                  <div class="employee-option">
                    <span class="name">{{ emp.name }}</span>
                    <span class="store">{{ emp.original_store_name }}</span>
                    <span class="skills">
                      {{ emp.skills?.map(s => s.name).join('、') || '无' }}
                    </span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>

            <el-form-item label="原门店">
              <el-input v-model="selectedEmployee?.original_store_name" disabled />
            </el-form-item>

            <el-form-item label="借调门店" prop="to_store_id">
              <el-select
                v-model="form.to_store_id"
                placeholder="请选择借调门店"
                @change="recalculateAllowance"
                clearable
              >
                <el-option
                  v-for="store in availableStores"
                  :key="store.id"
                  :label="store.name"
                  :value="store.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="日期" prop="date">
              <el-date-picker
                v-model="form.date"
                type="date"
                placeholder="请选择日期"
                value-format="YYYY-MM-DD"
                @change="recalculateAllowance"
              />
            </el-form-item>

            <el-form-item label="时间">
              <el-col :span="11">
                <el-time-picker
                  v-model="form.start_time"
                  placeholder="开始时间"
                  value-format="HH:mm"
                  @change="recalculateAllowance"
                  style="width: 100%"
                />
              </el-col>
              <el-col class="line" :span="2">
                <span>-</span>
              </el-col>
              <el-col :span="11">
                <el-time-picker
                  v-model="form.end_time"
                  placeholder="结束时间"
                  value-format="HH:mm"
                  @change="recalculateAllowance"
                  style="width: 100%"
                />
              </el-col>
            </el-form-item>

            <el-form-item label="所需技能" prop="skill_required">
              <el-select
                v-model="form.skill_required"
                placeholder="请选择所需技能（可选）"
                clearable
              >
                <el-option
                  v-for="skill in skills"
                  :key="skill.id"
                  :label="skill.name"
                  :value="skill.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="借调原因" prop="reason">
              <el-input
                v-model="form.reason"
                type="textarea"
                :rows="2"
                placeholder="请输入借调原因"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>

            <el-alert
              v-if="validationResult && !validationResult.valid"
              type="error"
              :closable="false"
              class="validation-alert"
            >
              <template #title>
                <span>⚠️ 发现冲突</span>
              </template>
              <ul class="error-list">
                <li v-for="(err, idx) in validationResult.errors" :key="idx">
                  {{ err }}
                </li>
              </ul>
            </el-alert>

            <el-alert
              v-if="validationResult?.warnings?.length"
              type="warning"
              :closable="false"
              class="validation-alert"
            >
              <template #title>
                <span>⚠️ 注意事项</span>
              </template>
              <ul class="error-list">
                <li v-for="(w, idx) in validationResult.warnings" :key="idx">
                  {{ w }}
                </li>
              </ul>
            </el-alert>

            <el-card v-if="allowanceResult" class="allowance-card">
              <template #header>
                <div class="allowance-title">
                  <span>💰 交通补贴试算</span>
                  <el-tag type="success" size="large" effect="dark">
                    总计: ¥{{ allowanceResult.total }}
                  </el-tag>
                </div>
              </template>
              <el-table :data="allowanceResult.details" size="small">
                <el-table-column prop="item" label="项目" width="120" />
                <el-table-column prop="amount" label="金额(元)" width="100">
                  <template #default="{ row }">
                    ¥{{ row.amount }}
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="说明" />
              </el-table>
            </el-card>

            <el-form-item>
              <el-row :gutter="10">
                <el-col :span="12">
                  <el-button
                    type="primary"
                    @click="validateForm"
                    :loading="loading"
                    style="width: 100%"
                  >
                    <el-icon><Search /></el-icon>
                    检查冲突
                  </el-button>
                </el-col>
                <el-col :span="12">
                  <el-button
                    type="success"
                    @click="submitForm"
                    :loading="loading"
                    :disabled="!canSubmit"
                    style="width: 100%"
                  >
                    <el-icon><Check /></el-icon>
                    提交申请
                  </el-button>
                </el-col>
              </el-row>
              <el-button
                type="info"
                @click="resetForm"
                style="width: 100%; margin-top: 10px"
              >
                重置表单
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-title">
              <el-icon><Document /></el-icon>
              我的申请记录
              <el-tag type="info" style="margin-left: 10px">
                共 {{ pendingRequests.length + approvedRequests.length + rejectedRequests.length }} 条
              </el-tag>
            </div>
          </template>

          <el-tabs v-model="activeTab">
            <el-tab-pane label="待审批" name="pending">
              <el-empty v-if="pendingRequests.length === 0" description="暂无待审批申请" />
              <el-table
                v-else
                :data="pendingRequests"
                stripe
                border
              >
                <el-table-column prop="employee_name" label="员工" width="100" />
                <el-table-column prop="original_store_name" label="原门店" width="110" />
                <el-table-column prop="to_store_name" label="借调门店" width="110" />
                <el-table-column prop="date" label="日期" width="110" />
                <el-table-column label="时间" width="130">
                  <template #default="{ row }">
                    {{ row.start_time }} - {{ row.end_time }}
                  </template>
                </el-table-column>
                <el-table-column prop="skill_name" label="技能" width="80">
                  <template #default="{ row }">
                    {{ row.skill_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column prop="transport_allowance" label="补贴" width="80">
                  <template #default="{ row }">
                    ¥{{ row.transport_allowance }}
                  </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag type="warning">待审批</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="已通过" name="approved">
              <el-empty v-if="approvedRequests.length === 0" description="暂无已通过申请" />
              <el-table
                v-else
                :data="approvedRequests"
                stripe
                border
              >
                <el-table-column prop="employee_name" label="员工" width="100" />
                <el-table-column prop="original_store_name" label="原门店" width="110" />
                <el-table-column prop="to_store_name" label="借调门店" width="110" />
                <el-table-column prop="date" label="日期" width="110" />
                <el-table-column label="时间" width="130">
                  <template #default="{ row }">
                    {{ row.start_time }} - {{ row.end_time }}
                  </template>
                </el-table-column>
                <el-table-column prop="transport_allowance" label="补贴" width="80">
                  <template #default="{ row }">
                    ¥{{ row.transport_allowance }}
                  </template>
                </el-table-column>
                <el-table-column prop="approver" label="审批人" width="100" />
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag type="success">已通过</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="已拒绝" name="rejected">
              <el-empty v-if="rejectedRequests.length === 0" description="暂无已拒绝申请" />
              <el-table
                v-else
                :data="rejectedRequests"
                stripe
                border
              >
                <el-table-column prop="employee_name" label="员工" width="100" />
                <el-table-column prop="original_store_name" label="原门店" width="110" />
                <el-table-column prop="to_store_name" label="借调门店" width="110" />
                <el-table-column prop="date" label="日期" width="110" />
                <el-table-column label="时间" width="130">
                  <template #default="{ row }">
                    {{ row.start_time }} - {{ row.end_time }}
                  </template>
                </el-table-column>
                <el-table-column prop="transport_allowance" label="补贴" width="80">
                  <template #default="{ row }">
                    ¥{{ row.transport_allowance }}
                  </template>
                </el-table-column>
                <el-table-column prop="approver" label="审批人" width="100" />
                <el-table-column prop="approval_comment" label="原因" min-width="150" show-overflow-tooltip />
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag type="danger">已拒绝</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="help-card" style="margin-top: 20px">
      <template #header>
        <div class="card-title">
          <el-icon><InfoFilled /></el-icon>
          系统说明
        </div>
      </template>
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="help-item">
            <div class="help-icon">🛡️</div>
            <div class="help-text">
              <h4>技能验证</h4>
              <p>系统会自动检查员工是否具备借调所需技能</p>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="help-item">
            <div class="help-icon">⏰</div>
            <div class="help-text">
              <h4>工时上限</h4>
              <p>自动计算每周工时，超过上限将拦截申请</p>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="help-item">
            <div class="help-icon">⚠️</div>
            <div class="help-text">
              <h4>冲突检测</h4>
              <p>检测同一员工同一时间是否有多店排班冲突</p>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="help-item">
            <div class="help-icon">💰</div>
            <div class="help-text">
              <h4>补贴计算</h4>
              <p>根据门店距离、时段、是否周末自动计算补贴</p>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Check, Document, InfoFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  stores as storesApi,
  skills as skillsApi,
  employees as employeesApi,
  transferRequests as requestsApi,
  allowance as allowanceApi
} from '../api'

const formRef = ref(null)
const loading = ref(false)
const activeTab = ref('pending')

const stores = ref([])
const skills = ref([])
const employees = ref([])
const allRequests = ref([])

const form = ref({
  employee_id: null,
  from_store_id: null,
  to_store_id: null,
  date: null,
  start_time: null,
  end_time: null,
  skill_required: null,
  reason: ''
})

const validationResult = ref(null)
const allowanceResult = ref(null)

const rules = {
  employee_id: [{ required: true, message: '请选择员工', trigger: 'change' }],
  to_store_id: [{ required: true, message: '请选择借调门店', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  reason: [{ required: true, message: '请输入借调原因', trigger: 'blur' }]
}

const selectedEmployee = computed(() => {
  return employees.value.find(e => e.id === form.value.employee_id)
})

const availableStores = computed(() => {
  if (!selectedEmployee.value) return stores.value
  return stores.value.filter(s => s.id !== selectedEmployee.value.original_store_id)
})

const canSubmit = computed(() => {
  return validationResult.value?.valid
})

const pendingRequests = computed(() => allRequests.value.filter(r => r.status === 'pending'))
const approvedRequests = computed(() => allRequests.value.filter(r => r.status === 'approved'))
const rejectedRequests = computed(() => allRequests.value.filter(r => r.status === 'rejected'))

const onEmployeeChange = (employeeId) => {
  const emp = employees.value.find(e => e.id === employeeId)
  if (emp) {
    form.value.from_store_id = emp.original_store_id
    form.value.to_store_id = null
    validationResult.value = null
    allowanceResult.value = null
  }
}

const recalculateAllowance = async () => {
  if (form.value.from_store_id && form.value.to_store_id && 
      form.value.date && form.value.start_time && form.value.end_time) {
    try {
      const res = await allowanceApi.calculate({
        from_store_id: form.value.from_store_id,
        to_store_id: form.value.to_store_id,
        date: form.value.date,
        start_time: form.value.start_time,
        end_time: form.value.end_time
      })
      allowanceResult.value = res.data
    } catch (e) {
      allowanceResult.value = null
    }
  } else {
    allowanceResult.value = null
  }
}

const validateForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await requestsApi.validate({
      employee_id: form.value.employee_id,
      from_store_id: form.value.from_store_id,
      to_store_id: form.value.to_store_id,
      date: form.value.date,
      start_time: form.value.start_time,
      end_time: form.value.end_time,
      skill_required: form.value.skill_required
    })
    validationResult.value = res.data

    if (res.data.valid) {
      ElMessage.success('✅ 检查通过，无冲突')
    } else {
      ElMessage.error('❌ 发现冲突，请查看提示')
    }

    await recalculateAllowance()
  } catch (e) {
    ElMessage.error('验证失败')
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  if (!validationResult.value?.valid) {
    ElMessage.warning('请先点击"检查冲突"确认无问题')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认提交借调申请？\n\n员工: ${selectedEmployee.value?.name}\n从: ${selectedEmployee.value?.original_store_name}\n到: ${stores.value.find(s => s.id === form.value.to_store_id)?.name}\n日期: ${form.value.date}\n时间: ${form.value.start_time} - ${form.value.end_time}\n预计补贴: ¥${allowanceResult.value?.total || 0}`,
      '确认提交',
      { type: 'info' }
    )
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await requestsApi.create({
      employee_id: form.value.employee_id,
      from_store_id: form.value.from_store_id,
      to_store_id: form.value.to_store_id,
      date: form.value.date,
      start_time: form.value.start_time,
      end_time: form.value.end_time,
      skill_required: form.value.skill_required,
      reason: form.value.reason
    })

    if (res.data.success) {
      ElMessage.success('✅ 申请提交成功！')
      resetForm()
      await loadRequests()
    }
  } catch (e) {
    if (e.response?.data?.errors) {
      validationResult.value = { valid: false, errors: e.response.data.errors }
      ElMessage.error('❌ 提交失败，请查看冲突提示')
    } else {
      ElMessage.error('提交失败')
    }
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  formRef.value?.resetFields()
  form.value = {
    employee_id: null,
    from_store_id: null,
    to_store_id: null,
    date: null,
    start_time: null,
    end_time: null,
    skill_required: null,
    reason: ''
  }
  validationResult.value = null
  allowanceResult.value = null
}

const loadRequests = async () => {
  try {
    const res = await requestsApi.getAll()
    allRequests.value = res.data.requests
  } catch (e) {
    ElMessage.error('加载申请记录失败')
  }
}

const loadData = async () => {
  try {
    const [storesRes, skillsRes, employeesRes] = await Promise.all([
      storesApi.getAll(),
      skillsApi.getAll(),
      employeesApi.getAll()
    ])
    stores.value = storesRes.data.stores
    skills.value = skillsRes.data.skills
    employees.value = employeesRes.data.employees
  } catch (e) {
    ElMessage.error('加载基础数据失败')
  }
}

onMounted(async () => {
  await loadData()
  await loadRequests()
})
</script>

<style scoped>
.requests-page {
  max-width: 1600px;
  margin: 0 auto;
}

.card-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.card-title .el-icon {
  margin-right: 6px;
}

.form-card {
  margin-bottom: 20px;
}

.transfer-form {
  padding: 10px 0;
}

.employee-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.employee-option .name {
  font-weight: 600;
}

.employee-option .store {
  font-size: 12px;
  color: #909399;
}

.employee-option .skills {
  font-size: 11px;
  color: #606266;
}

.line {
  text-align: center;
  padding-top: 8px;
  color: #909399;
}

.validation-alert {
  margin-bottom: 20px;
}

.error-list {
  margin: 0;
  padding-left: 20px;
}

.error-list li {
  margin: 4px 0;
}

.allowance-card {
  margin-bottom: 20px;
  border-color: #67c23a;
}

.allowance-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.help-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%);
}

.help-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.help-icon {
  font-size: 32px;
}

.help-text h4 {
  margin: 0 0 6px 0;
  color: #303133;
}

.help-text p {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}
</style>
