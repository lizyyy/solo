<template>
  <div id="app">
    <el-container style="height: 100vh;">
      <el-header style="background: #409EFF; color: white; line-height: 60px; padding: 0 20px;">
        <h1 style="margin: 0; font-size: 24px;">爬虫任务反封监控系统</h1>
      </el-header>
      
      <el-main style="padding: 20px;">
        <el-row :gutter="20" style="margin-bottom: 20px;">
          <el-col :span="6">
            <el-card shadow="hover">
              <template #header>
                <div class="card-header">
                  <span>版本列表</span>
                </div>
              </template>
              <el-select v-model="selectedVersion" placeholder="选择版本" style="width: 100%;" @change="fetchTasks">
                <el-option label="全部版本" value=""></el-option>
                <el-option v-for="v in versions" :key="v" :label="v" :value="v"></el-option>
              </el-select>
            </el-card>
          </el-col>
          
          <el-col :span="18">
            <el-card shadow="hover">
              <template #header>
                <div class="card-header">
                  <span>快速操作</span>
                  <el-button-group style="float: right;">
                    <el-button type="primary" @click="showCreateDialog">新建任务</el-button>
                    <el-button type="success" @click="exportData">导出数据</el-button>
                  </el-button-group>
                </div>
              </template>
              <el-form :inline="true" :model="filters" class="demo-form-inline">
                <el-form-item label="目标站点">
                  <el-input v-model="filters.target_site" placeholder="输入站点" clearable @input="fetchTasks"></el-input>
                </el-form-item>
                <el-form-item label="代理池">
                  <el-input v-model="filters.proxy_pool" placeholder="输入代理池" clearable @input="fetchTasks"></el-input>
                </el-form-item>
                <el-form-item label="状态">
                  <el-select v-model="filters.status" placeholder="选择状态" clearable @change="fetchTasks">
                    <el-option label="待审批" value="pending"></el-option>
                    <el-option label="已审批" value="approved"></el-option>
                    <el-option label="已回滚" value="rolled_back"></el-option>
                    <el-option label="已拒绝" value="rejected"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="fetchTasks">查询</el-button>
                  <el-button @click="resetFilters">重置</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>任务列表</span>
              <span style="float: right; color: #909399;">共 {{ tasks.length }} 条记录</span>
            </div>
          </template>
          
          <el-table :data="tasks" border stripe style="width: 100%;" v-loading="loading">
            <el-table-column prop="task_id" label="任务ID" width="180" show-overflow-tooltip></el-table-column>
            <el-table-column prop="target_site" label="目标站点" width="150" show-overflow-tooltip></el-table-column>
            <el-table-column prop="proxy_pool" label="代理池" width="150" show-overflow-tooltip></el-table-column>
            <el-table-column prop="version" label="版本" width="100"></el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)">
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="approved_by" label="审批人" width="100"></el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="scope">
                <el-button size="small" type="primary" @click="viewDetail(scope.row)">详情</el-button>
                <el-button size="small" type="success" @click="approveTask(scope.row)" :disabled="scope.row.status !== 'pending'">审批</el-button>
                <el-button size="small" type="warning" @click="rollbackTask(scope.row)">回滚</el-button>
                <el-button size="small" type="danger" @click="retryTask(scope.row)">重试</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-main>
    </el-container>

    <el-dialog v-model="createDialogVisible" title="新建任务" width="500px">
      <el-form :model="newTask" label-width="100px">
        <el-form-item label="任务ID">
          <el-input v-model="newTask.task_id"></el-input>
        </el-form-item>
        <el-form-item label="幂等Key">
          <el-input v-model="newTask.idempotency_key" placeholder="用于防止重复提交"></el-input>
        </el-form-item>
        <el-form-item label="目标站点">
          <el-input v-model="newTask.target_site"></el-input>
        </el-form-item>
        <el-form-item label="代理池">
          <el-input v-model="newTask.proxy_pool"></el-input>
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="newTask.version"></el-input>
        </el-form-item>
        <el-form-item label="频率策略">
          <el-input type="textarea" v-model="newTask.frequency_strategy"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createTask">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="任务详情" width="800px">
      <el-descriptions :column="2" border v-if="currentTask">
        <el-descriptions-item label="任务ID">{{ currentTask.task_id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentTask.status)">{{ getStatusText(currentTask.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="目标站点">{{ currentTask.target_site }}</el-descriptions-item>
        <el-descriptions-item label="代理池">{{ currentTask.proxy_pool }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ currentTask.version }}</el-descriptions-item>
        <el-descriptions-item label="审批人">{{ currentTask.approved_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="频率策略" :span="2">{{ currentTask.frequency_strategy || '-' }}</el-descriptions-item>
      </el-descriptions>
      
      <el-tabs v-model="activeTab" style="margin-top: 20px;">
        <el-tab-pane label="失败原因" name="failure">
          <el-table :data="currentTask?.failure_reasons || []" border>
            <el-table-column prop="reason_type" label="类型" width="150"></el-table-column>
            <el-table-column prop="description" label="描述"></el-table-column>
            <el-table-column prop="count" label="次数" width="80"></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="验证码事件" name="captcha">
          <el-table :data="currentTask?.captcha_events || []" border>
            <el-table-column prop="event_type" label="事件类型" width="120"></el-table-column>
            <el-table-column prop="captcha_type" label="验证码类型" width="120"></el-table-column>
            <el-table-column prop="confirmed" label="已确认" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.confirmed ? 'success' : 'warning'">
                  {{ scope.row.confirmed ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="scope">
                <el-button size="small" type="primary" @click="confirmCaptcha(scope.row)" :disabled="scope.row.confirmed">
                  确认
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="频率异常" name="frequency">
          <el-table :data="currentTask?.frequency_anomalies || []" border>
            <el-table-column prop="anomaly_type" label="异常类型" width="150"></el-table-column>
            <el-table-column prop="current_rate" label="当前频率" width="100"></el-table-column>
            <el-table-column prop="expected_rate" label="预期频率" width="100"></el-table-column>
            <el-table-column prop="threshold" label="阈值" width="80"></el-table-column>
            <el-table-column prop="resolved" label="已解决" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.resolved ? 'success' : 'danger'">
                  {{ scope.row.resolved ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="采集报表" name="report">
          <el-table :data="currentTask?.collection_reports || []" border>
            <el-table-column prop="total_requests" label="总请求" width="100"></el-table-column>
            <el-table-column prop="success_count" label="成功" width="100"></el-table-column>
            <el-table-column prop="failure_count" label="失败" width="100"></el-table-column>
            <el-table-column prop="success_rate" label="成功率" width="100">
              <template #default="scope">
                {{ (scope.row.success_rate * 100).toFixed(2) }}%
              </template>
            </el-table-column>
            <el-table-column prop="data_records" label="数据量" width="100"></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <el-dialog v-model="approveDialogVisible" title="审批任务" width="400px">
      <el-form :model="approveForm" label-width="80px">
        <el-form-item label="审批人">
          <el-input v-model="approveForm.approved_by"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmApprove">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rollbackDialogVisible" title="回滚任务" width="400px">
      <el-form :model="rollbackForm" label-width="100px">
        <el-form-item label="回滚到任务ID">
          <el-input-number v-model="rollbackForm.rolled_back_from" :min="1"></el-input-number>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rollbackDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRollback">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const loading = ref(false)
const tasks = ref([])
const versions = ref([])
const selectedVersion = ref('')
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const approveDialogVisible = ref(false)
const rollbackDialogVisible = ref(false)
const currentTask = ref(null)
const activeTab = ref('failure')

const filters = reactive({
  target_site: '',
  proxy_pool: '',
  status: ''
})

const newTask = reactive({
  task_id: '',
  idempotency_key: '',
  target_site: '',
  proxy_pool: '',
  version: '',
  frequency_strategy: ''
})

const approveForm = reactive({
  approved_by: ''
})

const rollbackForm = reactive({
  rolled_back_from: 1
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const types = {
    pending: 'warning',
    approved: 'success',
    rolled_back: 'info',
    rejected: 'danger',
    completed: 'primary'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    pending: '待审批',
    approved: '已审批',
    rolled_back: '已回滚',
    rejected: '已拒绝',
    completed: '已完成'
  }
  return texts[status] || status
}

const fetchVersions = async () => {
  try {
    const res = await axios.get('/api/versions')
    versions.value = res.data
  } catch (e) {
    console.error(e)
  }
}

const fetchTasks = async () => {
  loading.value = true
  try {
    const params = {
      ...filters
    }
    if (selectedVersion.value) {
      params.version = selectedVersion.value
    }
    const res = await axios.get('/api/tasks', { params })
    tasks.value = res.data
  } catch (e) {
    ElMessage.error('获取任务列表失败')
    console.error(e)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.target_site = ''
  filters.proxy_pool = ''
  filters.status = ''
  selectedVersion.value = ''
  fetchTasks()
}

const showCreateDialog = () => {
  Object.keys(newTask).forEach(key => newTask[key] = '')
  newTask.idempotency_key = `key_${Date.now()}`
  createDialogVisible.value = true
}

const createTask = async () => {
  if (!newTask.task_id || !newTask.target_site || !newTask.proxy_pool) {
    ElMessage.warning('请填写必填字段')
    return
  }
  try {
    await axios.post('/api/tasks', newTask)
    ElMessage.success('创建任务成功')
    createDialogVisible.value = false
    fetchTasks()
    fetchVersions()
  } catch (e) {
    ElMessage.error('创建任务失败')
    console.error(e)
  }
}

const viewDetail = async (row) => {
  try {
    const res = await axios.get(`/api/tasks/${row.task_id}`)
    currentTask.value = res.data
    detailDialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取任务详情失败')
    console.error(e)
  }
}

const approveTask = (row) => {
  approveForm.approved_by = ''
  currentTask.value = row
  approveDialogVisible.value = true
}

const confirmApprove = async () => {
  if (!approveForm.approved_by) {
    ElMessage.warning('请填写审批人')
    return
  }
  try {
    await axios.post(`/api/tasks/${currentTask.value.task_id}/approve`, approveForm)
    ElMessage.success('审批成功')
    approveDialogVisible.value = false
    fetchTasks()
  } catch (e) {
    ElMessage.error('审批失败')
    console.error(e)
  }
}

const rollbackTask = (row) => {
  rollbackForm.rolled_back_from = row.id
  currentTask.value = row
  rollbackDialogVisible.value = true
}

const confirmRollback = async () => {
  try {
    await axios.post(`/api/tasks/${currentTask.value.task_id}/rollback`, rollbackForm)
    ElMessage.success('回滚成功')
    rollbackDialogVisible.value = false
    fetchTasks()
  } catch (e) {
    ElMessage.error('回滚失败')
    console.error(e)
  }
}

const retryTask = async (row) => {
  try {
    await ElMessageBox.confirm('确定要重试此任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await axios.post(`/api/tasks/${row.task_id}/retry`)
    ElMessage.success('重试任务已创建')
    fetchTasks()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('重试失败')
      console.error(e)
    }
  }
}

const confirmCaptcha = async (row) => {
  try {
    await axios.post(`/api/captcha-events/${row.id}/confirm`, { confirmed_by: 'admin' })
    ElMessage.success('验证码事件已确认')
    viewDetail(currentTask.value)
  } catch (e) {
    ElMessage.error('确认失败')
    console.error(e)
  }
}

const exportData = async () => {
  try {
    const params = {}
    if (filters.target_site) params.target_site = filters.target_site
    if (filters.status) params.status = filters.status
    
    const res = await axios.get('/api/export', {
      params,
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `crawler_monitor_${new Date().toISOString().slice(0, 10)}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
    console.error(e)
  }
}

onMounted(() => {
  fetchVersions()
  fetchTasks()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>