<template>
  <div class="config-page">
    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>SLA规则配置</span>
          <el-button type="primary" size="small" @click="showRuleDialog">
            <el-icon><Plus /></el-icon>
            新增规则
          </el-button>
        </div>
      </template>

      <el-table :data="slaRules" v-loading="loading">
        <el-table-column prop="name" label="规则名称" width="150" />
        <el-table-column prop="priority" label="适用优先级" width="120">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)" size="small">
              {{ getPriorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="response_hours" label="响应时限(小时)" width="130" />
        <el-table-column prop="resolution_hours" label="解决时限(小时)" width="130" />
        <el-table-column prop="work_start_hour" label="工作开始" width="100" />
        <el-table-column prop="work_end_hour" label="工作结束" width="100" />
        <el-table-column prop="work_days" label="工作日" width="120" />
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <el-button link type="primary" size="small">编辑</el-button>
          <el-button link type="danger" size="small">删除</el-button>
        </el-table-column>
      </el-table>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>暂停原因配置</span>
              <el-button type="primary" size="small" @click="showReasonDialog">
                <el-icon><Plus /></el-icon>
                新增原因
              </el-button>
            </div>
          </template>

          <el-table :data="pauseReasons" v-loading="loading">
            <el-table-column prop="code" label="编码" width="150" />
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column prop="category" label="分类" width="120" />
            <el-table-column prop="is_active" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
                  {{ row.is_active ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <el-button link type="danger" size="small" @click="deleteReason(row.id)">删除</el-button>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>节假日配置</span>
              <el-button type="primary" size="small" @click="showHolidayDialog">
                <el-icon><Plus /></el-icon>
                新增节假日
              </el-button>
            </div>
          </template>

          <el-table :data="holidays" v-loading="loading">
            <el-table-column prop="date" label="日期" width="150" />
            <el-table-column prop="name" label="名称" width="200" />
            <el-table-column prop="type" label="类型" width="120">
              <template #default="{ row }">
                <el-tag size="small">{{ row.type === 'holiday' ? '节假日' : '工作日' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <el-button link type="danger" size="small" @click="deleteHoliday(row.id)">删除</el-button>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="ruleDialogVisible" title="SLA规则" width="600px">
      <el-form :model="ruleForm" label-width="120px">
        <el-form-item label="规则名称" required>
          <el-input v-model="ruleForm.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="ruleForm.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="适用优先级" required>
          <el-select v-model="ruleForm.priority" placeholder="请选择优先级">
            <el-option label="低" value="low" />
            <el-option label="普通" value="normal" />
            <el-option label="高" value="high" />
            <el-option label="紧急" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="响应时限(小时)" required>
          <el-input-number v-model="ruleForm.response_hours" :min="0.1" :step="0.5" />
        </el-form-item>
        <el-form-item label="解决时限(小时)" required>
          <el-input-number v-model="ruleForm.resolution_hours" :min="0.1" :step="1" />
        </el-form-item>
        <el-form-item label="工作开始时间" required>
          <el-select v-model="ruleForm.work_start_hour" placeholder="请选择">
            <el-option v-for="h in 24" :key="h" :label="`${h}:00`" :value="h" />
          </el-select>
        </el-form-item>
        <el-form-item label="工作结束时间" required>
          <el-select v-model="ruleForm.work_end_hour" placeholder="请选择">
            <el-option v-for="h in 24" :key="h" :label="`${h}:00`" :value="h" />
          </el-select>
        </el-form-item>
        <el-form-item label="工作日" required>
          <el-select v-model="ruleForm.work_days" multiple placeholder="请选择工作日">
            <el-option label="周一" value="1" />
            <el-option label="周二" value="2" />
            <el-option label="周三" value="3" />
            <el-option label="周四" value="4" />
            <el-option label="周五" value="5" />
            <el-option label="周六" value="6" />
            <el-option label="周日" value="0" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reasonDialogVisible" title="暂停原因" width="500px">
      <el-form :model="reasonForm" label-width="100px">
        <el-form-item label="原因编码" required>
          <el-input v-model="reasonForm.code" placeholder="如: wait_customer" />
        </el-form-item>
        <el-form-item label="原因名称" required>
          <el-input v-model="reasonForm.name" placeholder="如: 等待客户回复" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="reasonForm.category" placeholder="请选择分类">
            <el-option label="客户相关" value="客户相关" />
            <el-option label="外部依赖" value="外部依赖" />
            <el-option label="信息收集" value="信息收集" />
            <el-option label="时间相关" value="时间相关" />
            <el-option label="内部流程" value="内部流程" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="reasonForm.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reasonDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReason">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="holidayDialogVisible" title="节假日" width="500px">
      <el-form :model="holidayForm" label-width="100px">
        <el-form-item label="日期" required>
          <el-date-picker v-model="holidayForm.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="holidayForm.name" placeholder="如: 元旦" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="holidayForm.type" placeholder="请选择类型">
            <el-option label="节假日" value="holiday" />
            <el-option label="调休工作日" value="workday" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="holidayDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveHoliday">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { configApi } from '@/utils/api'

const loading = ref(false)
const slaRules = ref([])
const pauseReasons = ref([])
const holidays = ref([])

const ruleDialogVisible = ref(false)
const reasonDialogVisible = ref(false)
const holidayDialogVisible = ref(false)

const ruleForm = ref({
  name: '',
  description: '',
  priority: 'normal',
  response_hours: 4,
  resolution_hours: 24,
  work_start_hour: 9,
  work_end_hour: 18,
  work_days: '1,2,3,4,5'
})

const reasonForm = ref({
  code: '',
  name: '',
  description: '',
  category: ''
})

const holidayForm = ref({
  date: '',
  name: '',
  type: 'holiday'
})

const loadSlaRules = async () => {
  try {
    slaRules.value = await configApi.getSlaRules()
  } catch (error) {
    ElMessage.error('加载SLA规则失败')
  }
}

const loadPauseReasons = async () => {
  try {
    pauseReasons.value = await configApi.getPauseReasons()
  } catch (error) {
    ElMessage.error('加载暂停原因失败')
  }
}

const loadHolidays = async () => {
  try {
    holidays.value = await configApi.getHolidays()
  } catch (error) {
    ElMessage.error('加载节假日失败')
  }
}

const showRuleDialog = () => {
  ruleForm.value = {
    name: '',
    description: '',
    priority: 'normal',
    response_hours: 4,
    resolution_hours: 24,
    work_start_hour: 9,
    work_end_hour: 18,
    work_days: '1,2,3,4,5'
  }
  ruleDialogVisible.value = true
}

const saveRule = async () => {
  if (!ruleForm.value.name || !ruleForm.value.priority) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    if (Array.isArray(ruleForm.value.work_days)) {
      ruleForm.value.work_days = ruleForm.value.work_days.join(',')
    }
    await configApi.createSlaRule(ruleForm.value)
    ElMessage.success('创建成功')
    ruleDialogVisible.value = false
    loadSlaRules()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const showReasonDialog = () => {
  reasonForm.value = { code: '', name: '', description: '', category: '' }
  reasonDialogVisible.value = true
}

const saveReason = async () => {
  if (!reasonForm.value.code || !reasonForm.value.name) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    await configApi.createPauseReason(reasonForm.value)
    ElMessage.success('创建成功')
    reasonDialogVisible.value = false
    loadPauseReasons()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const deleteReason = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个原因吗?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await configApi.deletePauseReason(id)
    ElMessage.success('删除成功')
    loadPauseReasons()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const showHolidayDialog = () => {
  holidayForm.value = { date: '', name: '', type: 'holiday' }
  holidayDialogVisible.value = true
}

const saveHoliday = async () => {
  if (!holidayForm.value.date || !holidayForm.value.name) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    await configApi.createHoliday(holidayForm.value)
    ElMessage.success('创建成功')
    holidayDialogVisible.value = false
    loadHolidays()
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const deleteHoliday = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个节假日吗?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await configApi.deleteHoliday(id)
    ElMessage.success('删除成功')
    loadHolidays()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
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

onMounted(() => {
  loadSlaRules()
  loadPauseReasons()
  loadHolidays()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
