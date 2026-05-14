<template>
  <div class="batches">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>批次列表</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建批次
          </el-button>
        </div>
      </template>

      <el-table :data="batches" style="width: 100%">
        <el-table-column prop="name" label="批次名称" width="200" />
        <el-table-column prop="template_name" label="模板名称" width="200" />
        <el-table-column label="灰度进度">
          <template #default="{ row }">
            {{ row.grayscale_stage }} / {{ row.total_stages }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发送统计" width="200">
          <template #default="{ row }">
            成功: {{ row.success_count }} / 失败: {{ row.failed_count }}
          </template>
        </el-table-column>
        <el-table-column prop="created_by" label="创建人" width="100" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/batches/${row.id}`)">详情</el-button>
            <el-dropdown @command="(cmd) => handleBatchAction(cmd, row)">
              <el-button link type="primary" size="small">更多操作<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="advance" :disabled="['success', 'failed', 'intercepted'].includes(row.status)">推进灰度</el-dropdown-item>
                  <el-dropdown-item command="intercept" :disabled="['success', 'failed', 'intercepted'].includes(row.status)">拦截批次</el-dropdown-item>
                  <el-dropdown-item command="compensate" :disabled="['pending', 'in_progress'].includes(row.status)">启动补偿</el-dropdown-item>
                  <el-dropdown-item command="manual">人工复核</el-dropdown-item>
                  <el-dropdown-item command="export">导出数据</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建批次" width="800px">
      <el-form :model="batchForm" label-width="120px">
        <el-form-item label="批次名称">
          <el-input v-model="batchForm.name" placeholder="请输入批次名称" />
        </el-form-item>
        <el-form-item label="选择模板">
          <el-select v-model="batchForm.template_id" placeholder="请选择模板" style="width: 100%">
            <el-option v-for="t in templates" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="测试收件人">
          <el-select v-model="batchForm.test_recipients" multiple placeholder="请输入测试邮箱" style="width: 100%">
            <el-option v-for="e in testEmails" :key="e" :label="e" :value="e" />
          </el-select>
        </el-form-item>
        <el-form-item label="灰度阶段数">
          <el-input-number v-model="batchForm.total_stages" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="收件人列表">
          <div v-for="(r, idx) in batchForm.recipients" :key="idx" style="display: flex; gap: 10px; margin-bottom: 10px">
            <el-input v-model="r.email" placeholder="邮箱" style="width: 200px" />
            <el-input v-model="r.name" placeholder="姓名" style="width: 150px" />
            <el-button link type="danger" @click="batchForm.recipients.splice(idx, 1)">删除</el-button>
          </div>
          <el-button type="dashed" @click="batchForm.recipients.push({email: '', name: '', variables: {}})">
            添加收件人
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createBatch">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCompensateDialog" title="启动补偿" width="500px">
      <el-form :model="compensateForm" label-width="100px">
        <el-form-item label="补偿类型">
          <el-select v-model="compensateForm.compensation_type">
            <el-option label="重发失败邮件" value="retry_failed" />
            <el-option label="补发未发送邮件" value="send_pending" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="compensateForm.details" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompensateDialog = false">取消</el-button>
        <el-button type="primary" @click="doCompensate">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showInterceptDialog" title="拦截批次" width="500px">
      <el-form label-width="100px">
        <el-form-item label="拦截原因">
          <el-input v-model="interceptReason" type="textarea" :rows="3" placeholder="请输入拦截原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showInterceptDialog = false">取消</el-button>
        <el-button type="danger" @click="doIntercept">确认拦截</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchApi, templateApi } from '@/api'

const batches = ref([])
const templates = ref([])
const showCreateDialog = ref(false)
const showCompensateDialog = ref(false)
const showInterceptDialog = ref(false)
const currentBatch = ref(null)
const interceptReason = ref('')

const testEmails = ['test1@example.com', 'test2@example.com', 'test3@example.com']

const batchForm = ref({
  name: '',
  template_id: null,
  test_recipients: [],
  total_stages: 3,
  recipients: []
})

const compensateForm = ref({
  compensation_type: 'retry_failed',
  details: ''
})

const loadBatches = async () => {
  try {
    const res = await batchApi.list()
    batches.value = res.data
  } catch (error) {
    ElMessage.error('加载批次失败')
  }
}

const loadTemplates = async () => {
  try {
    const res = await templateApi.list({ status: 'approved' })
    templates.value = res.data
  } catch (error) {
    ElMessage.error('加载模板失败')
  }
}

const createBatch = async () => {
  try {
    await batchApi.create(batchForm.value)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    loadBatches()
    batchForm.value = { name: '', template_id: null, test_recipients: [], total_stages: 3, recipients: [] }
  } catch (error) {
    ElMessage.error('创建失败')
  }
}

const handleBatchAction = async (command, row) => {
  currentBatch.value = row
  switch (command) {
    case 'advance':
      try {
        await batchApi.advanceStage(row.id)
        ElMessage.success('已推进到下一灰度阶段')
        loadBatches()
      } catch (error) {
        ElMessage.error('推进失败')
      }
      break
    case 'intercept':
      showInterceptDialog.value = true
      break
    case 'compensate':
      showCompensateDialog.value = true
      break
    case 'manual':
      try {
        await batchApi.manualReview(row.id)
        ElMessage.success('已转入人工复核')
        loadBatches()
      } catch (error) {
        ElMessage.error('操作失败')
      }
      break
    case 'export':
      try {
        const res = await batchApi.export(row.id, 'xlsx')
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.download = `batch_${row.id}.xlsx`
        link.click()
        ElMessage.success('导出成功')
      } catch (error) {
        ElMessage.error('导出失败')
      }
      break
  }
}

const doIntercept = async () => {
  try {
    await batchApi.intercept(currentBatch.value.id, interceptReason.value)
    ElMessage.success('批次已拦截')
    showInterceptDialog.value = false
    loadBatches()
  } catch (error) {
    ElMessage.error('拦截失败')
  }
}

const doCompensate = async () => {
  try {
    await batchApi.compensate(currentBatch.value.id, compensateForm.value)
    ElMessage.success('补偿已启动')
    showCompensateDialog.value = false
    loadBatches()
  } catch (error) {
    ElMessage.error('启动补偿失败')
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    validating: 'warning',
    ready: 'success',
    in_progress: 'primary',
    partial_success: 'warning',
    success: 'success',
    failed: 'danger',
    intercepted: 'danger',
    compensating: 'warning',
    manual_review: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    validating: '校验中',
    validation_failed: '校验失败',
    ready: '就绪',
    in_progress: '进行中',
    partial_success: '部分成功',
    success: '成功',
    failed: '失败',
    intercepted: '已拦截',
    compensating: '补偿中',
    compensated: '已补偿',
    manual_review: '人工复核'
  }
  return map[status] || status
}

onMounted(() => {
  loadBatches()
  loadTemplates()
})
</script>
