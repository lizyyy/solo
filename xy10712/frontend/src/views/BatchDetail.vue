<template>
  <div class="batch-detail">
    <el-button @click="$router.back()" style="margin-bottom: 20px">
      <el-icon><ArrowLeft /></el-icon>
      返回
    </el-button>

    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <span>批次信息</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="批次名称">{{ batch.name }}</el-descriptions-item>
        <el-descriptions-item label="模板名称">{{ batch.template_name }}</el-descriptions-item>
        <el-descriptions-item label="灰度阶段">{{ batch.grayscale_stage }} / {{ batch.total_stages }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(batch.status)">{{ getStatusText(batch.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发送统计" :span="2">
          总数: {{ batch.total_emails }} / 已发送: {{ batch.sent_emails }} / 成功: {{ batch.success_count }} / 失败: {{ batch.failed_count }} / 拦截: {{ batch.intercepted_count }}
        </el-descriptions-item>
        <el-descriptions-item label="测试收件人" :span="2">
          <el-tag v-for="e in batch.test_recipients" :key="e" style="margin-right: 8px">{{ e }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>变量校验结果</span>
          <el-button type="primary" size="small" @click="recalculateValidations">重新校验</el-button>
        </div>
      </template>
      <el-table :data="validations" style="width: 100%">
        <el-table-column label="收件人" width="200">
          <template #default="{ row }">{{ getEmailById(row.email_id)?.recipient_email }}</template>
        </el-table-column>
        <el-table-column prop="variable_name" label="变量名" width="150" />
        <el-table-column prop="variable_value" label="变量值" />
        <el-table-column prop="is_valid" label="是否有效" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_valid ? 'success' : 'danger'">{{ row.is_valid ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" />
      </el-table>
    </el-card>

    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <span>邮件列表</span>
      </template>
      <el-table :data="emails" style="width: 100%">
        <el-table-column prop="recipient_email" label="收件人" width="220" />
        <el-table-column prop="recipient_name" label="姓名" width="120" />
        <el-table-column prop="is_test" label="测试" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.is_test" type="info">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="grayscale_stage" label="阶段" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getEmailStatusType(row.status)">{{ getEmailStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" />
        <el-table-column prop="sent_at" label="发送时间" width="180">
          <template #default="{ row }">{{ row.sent_at ? formatDate(row.sent_at) : '-' }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="hover">
      <template #header>
        <span>操作日志</span>
      </template>
      <el-table :data="logs" style="width: 100%">
        <el-table-column prop="action" label="操作" width="150" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="details" label="详情" />
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { batchApi } from '@/api'

const route = useRoute()
const batch = ref({})
const emails = ref([])
const validations = ref([])
const logs = ref([])

const loadBatch = async () => {
  try {
    const res = await batchApi.get(route.params.id)
    batch.value = res.data
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const loadEmails = async () => {
  try {
    const res = await batchApi.getEmails(route.params.id)
    emails.value = res.data
  } catch (error) {
    ElMessage.error('加载邮件失败')
  }
}

const loadValidations = async () => {
  try {
    const res = await batchApi.getValidations(route.params.id)
    validations.value = res.data
  } catch (error) {
    ElMessage.error('加载校验失败')
  }
}

const loadLogs = async () => {
  try {
    const res = await batchApi.getLogs(route.params.id)
    logs.value = res.data
  } catch (error) {
    ElMessage.error('加载日志失败')
  }
}

const recalculateValidations = async () => {
  try {
    await batchApi.recalculateValidations(route.params.id)
    ElMessage.success('校验已重新计算')
    loadValidations()
    loadBatch()
  } catch (error) {
    ElMessage.error('重新校验失败')
  }
}

const getEmailById = (emailId) => {
  return emails.value.find(e => e.id === emailId)
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

const getEmailStatusType = (status) => {
  const map = {
    pending: 'info',
    sending: 'warning',
    success: 'success',
    failed: 'danger',
    intercepted: 'danger',
    retry: 'warning'
  }
  return map[status] || 'info'
}

const getEmailStatusText = (status) => {
  const map = {
    pending: '待发送',
    sending: '发送中',
    success: '成功',
    failed: '失败',
    intercepted: '已拦截',
    retry: '重试中'
  }
  return map[status] || status
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadBatch()
  loadEmails()
  loadValidations()
  loadLogs()
})
</script>
