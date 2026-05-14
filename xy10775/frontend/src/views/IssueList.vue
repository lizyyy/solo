<template>
  <div>
    <a-card style="margin-bottom: 16px">
      <template #title>
        <span>🔍 筛选条件</span>
      </template>
      <a-form :model="filters" layout="inline">
        <a-form-item label="页面路径">
          <a-input
            v-model:value="filters.page_path"
            placeholder="输入页面路径搜索"
            style="width: 200px"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="filters.status" placeholder="选择状态" style="width: 150px" allow-clear>
            <a-select-option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="规则类别">
          <a-select v-model:value="filters.rule_category" placeholder="选择类别" style="width: 150px" allow-clear>
            <a-select-option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="fetchIssues">查询</a-button>
            <a-button @click="resetFilters">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card>
      <template #title>
        <a-space>
          <span>📋 无障碍问题列表</span>
          <a-tag color="blue">总计: {{ stats.total }}</a-tag>
        </a-space>
      </template>

      <a-table
        :columns="columns"
        :data-source="issues"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 10 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="viewDetail(record)">查看详情</a-button>
              <a-button type="link" size="small" @click="openReviewDrawer(record)">复核</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer
      v-model:open="drawerVisible"
      title="问题复核"
      width="600"
      :destroy-on-close="true"
    >
      <a-descriptions v-if="currentIssue" bordered column="1" size="small">
        <a-descriptions-item label="规则项">{{ currentIssue.rule_name }} ({{ currentIssue.rule_id }})</a-descriptions-item>
        <a-descriptions-item label="页面路径">{{ currentIssue.page_path }}</a-descriptions-item>
        <a-descriptions-item label="当前状态">
          <a-tag :color="getStatusColor(currentIssue.status)">{{ currentIssue.status }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="问题描述">{{ currentIssue.description }}</a-descriptions-item>
        <a-descriptions-item label="修复建议">{{ currentIssue.repair_suggestion }}</a-descriptions-item>
        <a-descriptions-item v-if="currentIssue.screenshot" label="截图">
          <img :src="getScreenshotUrl(currentIssue.screenshot)" style="max-width: 100%" />
        </a-descriptions-item>
      </a-descriptions>

      <a-divider />

      <a-form :model="reviewForm" layout="vertical">
        <a-form-item label="处理人">
          <a-input v-model:value="reviewForm.handler" placeholder="输入处理人姓名" />
        </a-form-item>
        <a-form-item label="处理理由">
          <a-textarea v-model:value="reviewForm.handle_reason" :rows="3" placeholder="描述处理情况" />
        </a-form-item>
        <a-form-item label="复核状态">
          <a-select v-model:value="reviewForm.status" style="width: 100%">
            <a-select-option value="已修复">标记为已修复</a-select-option>
            <a-select-option value="已复核">复核通过</a-select-option>
            <a-select-option value="修复失败">修复失败，需返工</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="reviewForm.status === '修复失败'" label="复核意见">
          <a-textarea v-model:value="reviewForm.review_reason" :rows="3" placeholder="请说明失败原因，便于复盘" />
        </a-form-item>
        <a-form-item label="复核人">
          <a-input v-model:value="reviewForm.reviewer" placeholder="输入复核人姓名" />
        </a-form-item>
      </a-form>

      <template #footer>
        <a-space style="float: right">
          <a-button @click="drawerVisible = false">取消</a-button>
          <a-button type="primary" @click="submitReview" :loading="submitting">提交复核</a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { message } from 'ant-design-vue'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const issues = ref([])
const stats = ref({ total: 0 })
const drawerVisible = ref(false)
const currentIssue = ref(null)

const statusOptions = ['待处理', '处理中', '已修复', '已复核', '修复失败']
const categoryOptions = ['颜色对比度', '键盘导航', '屏幕阅读器', '语义化', '表单', '图片']

const filters = ref({
  page_path: '',
  status: undefined,
  rule_category: undefined,
})

const reviewForm = ref({
  handler: '',
  handle_reason: '',
  status: '',
  review_reason: '',
  reviewer: '',
})

const columns = [
  { title: '规则项', dataIndex: 'rule_name', key: 'rule_name', width: 180 },
  { title: '规则类别', dataIndex: 'rule_category', key: 'rule_category', width: 120 },
  { title: '页面路径', dataIndex: 'page_path', key: 'page_path', width: 150, ellipsis: true },
  { title: '问题描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '处理人', dataIndex: 'handler', key: 'handler', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' },
]

const getStatusColor = (status) => {
  const colors = {
    '待处理': 'default',
    '处理中': 'blue',
    '已修复': 'green',
    '已复核': 'purple',
    '修复失败': 'red',
  }
  return colors[status] || 'default'
}

const getScreenshotUrl = (screenshot) => {
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(screenshot)}&image_size=square_hd`
}

const fetchIssues = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/issues', { params: filters.value })
    issues.value = res.data.items
    stats.value.total = res.data.total
  } catch (e) {
    message.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const res = await axios.get('/api/stats')
    stats.value = res.data
  } catch (e) {}
}

const resetFilters = () => {
  filters.value = { page_path: '', status: undefined, rule_category: undefined }
  fetchIssues()
}

const viewDetail = (record) => {
  router.push(`/issue/${record.id}`)
}

const openReviewDrawer = (record) => {
  currentIssue.value = record
  reviewForm.value = {
    handler: record.handler || '',
    handle_reason: record.handle_reason || '',
    status: '',
    review_reason: '',
    reviewer: '',
  }
  drawerVisible.value = true
}

const submitReview = async () => {
  if (!reviewForm.value.status) {
    message.error('请选择复核状态')
    return
  }
  submitting.value = true
  try {
    await axios.put(`/api/issues/${currentIssue.value.id}`, reviewForm.value)
    message.success('复核提交成功')
    drawerVisible.value = false
    fetchIssues()
  } catch (e) {
    message.error('提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchIssues()
  fetchStats()
})
</script>
