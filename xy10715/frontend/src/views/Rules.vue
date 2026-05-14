<template>
  <div class="rules-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>缓存规则列表</span>
          <el-button type="primary" @click="showCreateDialog = true">
            新建规则
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部">
            <el-option label="待处理" value="pending" />
            <el-option label="预热中" value="preheating" />
            <el-option label="已就绪" value="ready" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="搜索规则键" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRules">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rules" v-loading="loading" stripe>
        <el-table-column prop="rule_key" label="规则键" min-width="200" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="current_hit_rate" label="命中率" width="100">
          <template #default="{ row }">
            {{ row.current_hit_rate }}%
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/rules/${row.id}`)">
              详情
            </el-button>
            <el-button link type="success" @click="startPreheat(row)" :disabled="row.status !== 'pending'">
              预热
            </el-button>
            <el-button link type="warning" @click="showReviewDrawer(row)" :disabled="row.status === 'pending'">
              复核
            </el-button>
            <el-button link type="danger" @click="invalidate(row)" :disabled="row.status !== 'ready'">
              失效
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.per_page"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadRules"
        @size-change="loadRules"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>
  </div>

  <el-dialog v-model="showCreateDialog" title="新建缓存规则" width="600px">
    <el-form :model="newRule" label-width="100px">
      <el-form-item label="规则键">
        <el-input v-model="newRule.rule_key" placeholder="例如: user:info:*" />
      </el-form-item>
      <el-form-item label="匹配模式">
        <el-input v-model="newRule.rule_pattern" placeholder="正则表达式" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="newRule.description" type="textarea" />
      </el-form-item>
      <el-form-item label="TTL(秒)">
        <el-input-number v-model="newRule.ttl" :min="1" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showCreateDialog = false">取消</el-button>
      <el-button type="primary" @click="createRule" :loading="creating">
        创建
      </el-button>
    </template>
  </el-dialog>

  <el-drawer v-model="showDrawer" title="复核详情" size="600px">
    <div v-if="selectedRule" class="review-content">
      <h4>基本信息</h4>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="规则键">{{ selectedRule.rule_key }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedRule.status)">
            {{ getStatusText(selectedRule.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="命中率">{{ selectedRule.current_hit_rate }}%</el-descriptions-item>
      </el-descriptions>

      <h4 style="margin-top: 20px">原始输入</h4>
      <el-input
        type="textarea"
        :model-value="JSON.stringify(selectedRule.original_input, null, 2)"
        readonly
        :rows="4"
      />

      <h4 style="margin-top: 20px">处理结果</h4>
      <el-input
        type="textarea"
        :model-value="JSON.stringify(selectedRule.processed_result, null, 2)"
        readonly
        :rows="4"
      />

      <h4 style="margin-top: 20px">复核操作</h4>
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="复核备注">
          <el-input v-model="reviewForm.comment" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item>
          <el-button type="success" @click="confirmReview">确认无误</el-button>
          <el-button type="warning" @click="needAdjust">需要调整</el-button>
        </el-form-item>
      </el-form>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const rules = ref([])
const loading = ref(false)
const showCreateDialog = ref(false)
const showDrawer = ref(false)
const creating = ref(false)
const selectedRule = ref(null)

const filters = reactive({
  status: '',
  keyword: ''
})

const pagination = reactive({
  page: 1,
  per_page: 20,
  total: 0
})

const newRule = ref({
  rule_key: '',
  rule_pattern: '',
  description: '',
  ttl: 3600
})

const reviewForm = reactive({
  comment: ''
})

const processingIds = ref(new Set())

const getStatusType = (status) => {
  const map = { pending: 'info', preheating: 'warning', ready: 'success' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待处理', preheating: '预热中', ready: '已就绪' }
  return map[status] || status
}

const loadRules = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      per_page: pagination.per_page
    }
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    
    const res = await axios.get('/api/rules', { params })
    rules.value = res.data.data
    pagination.total = res.data.total
  } catch (err) {
    ElMessage.error('加载规则列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.status = ''
  filters.keyword = ''
  pagination.page = 1
  loadRules()
}

const createRule = async () => {
  if (!newRule.value.rule_key) {
    ElMessage.warning('请输入规则键')
    return
  }
  creating.value = true
  try {
    await axios.post('/api/rules', {
      ...newRule.value,
      original_input: newRule.value,
      processed_result: { pattern: newRule.value.rule_pattern }
    })
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    loadRules()
    newRule.value = { rule_key: '', rule_pattern: '', description: '', ttl: 3600 }
  } catch (err) {
    ElMessage.error('创建失败')
  } finally {
    creating.value = false
  }
}

const startPreheat = async (row) => {
  if (processingIds.value.has(row.id)) {
    ElMessage.warning('操作进行中，请稍候')
    return
  }
  processingIds.value.add(row.id)
  
  try {
    await axios.post(`/api/rules/${row.id}/preheat`, { total_keys: 100 })
    ElMessage.success('预热任务已启动')
    loadRules()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '启动预热失败')
  } finally {
    processingIds.value.delete(row.id)
  }
}

const invalidate = async (row) => {
  if (processingIds.value.has(row.id)) {
    ElMessage.warning('操作进行中，请稍候')
    return
  }
  processingIds.value.add(row.id)
  
  try {
    const eventRes = await axios.post(`/api/rules/${row.id}/invalidate`, {
      reason: '手动失效',
      operator: 'admin'
    })
    const eventId = eventRes.data.id
    
    await axios.post(`/api/invalidations/${eventId}/execute`, {
      pressure_level: 'medium',
      estimated_qps: 500,
      reason: '常规失效操作'
    })
    
    await axios.post(`/api/invalidations/${eventId}/complete`, { success: true })
    
    ElMessage.success('失效完成')
    loadRules()
  } catch (err) {
    ElMessage.error('失效操作失败')
  } finally {
    processingIds.value.delete(row.id)
  }
}

const showReviewDrawer = (row) => {
  selectedRule.value = row
  reviewForm.comment = ''
  showDrawer.value = true
}

const confirmReview = () => {
  ElMessage.success('复核确认完成')
  showDrawer.value = false
}

const needAdjust = () => {
  ElMessage.info('已标记为需要调整')
  showDrawer.value = false
}

onMounted(() => {
  loadRules()
})
</script>

<style scoped>
.rules-page {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  margin-bottom: 20px;
}

.review-content h4 {
  margin-bottom: 10px;
  color: #303133;
}
</style>
