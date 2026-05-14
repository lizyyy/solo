<template>
  <div class="rule-detail">
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/rules' }">缓存规则</el-breadcrumb-item>
            <el-breadcrumb-item>{{ rule?.rule_key }}</el-breadcrumb-item>
          </el-breadcrumb>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </template>

      <el-descriptions :column="2" border v-if="rule">
        <el-descriptions-item label="规则键">{{ rule.rule_key }}</el-descriptions-item>
        <el-descriptions-item label="匹配模式">{{ rule.rule_pattern }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(rule.status)">{{ getStatusText(rule.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="命中率">{{ rule.current_hit_rate }}%</el-descriptions-item>
        <el-descriptions-item label="TTL">{{ rule.ttl }}秒</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ rule.created_at }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ rule.description }}</el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <el-tabs v-model="activeTab">
        <el-tab-pane label="原始输入与处理结果" name="input">
          <el-row :gutter="20">
            <el-col :span="12">
              <h4>原始输入</h4>
              <el-input
                type="textarea"
                :model-value="JSON.stringify(rule?.original_input, null, 2)"
                readonly
                :rows="10"
              />
            </el-col>
            <el-col :span="12">
              <h4>处理结果</h4>
              <el-input
                type="textarea"
                :model-value="JSON.stringify(rule?.processed_result, null, 2)"
                readonly
                :rows="10"
              />
            </el-col>
          </el-row>
        </el-tab-pane>

        <el-tab-pane label="预热批次" name="batches">
          <el-alert
            title="预热操作"
            type="info"
            :closable="false"
            style="margin-bottom: 20px"
          >
            <el-button type="success" @click="startPreheat" :disabled="rule?.status !== 'pending'" :loading="preheating">
              开始预热
            </el-button>
          </el-alert>
          <el-table :data="[]" stripe>
            <el-table-column prop="batch_key" label="批次号" width="200" />
            <el-table-column prop="total_keys" label="总数" width="100" />
            <el-table-column prop="success_keys" label="成功数" width="100" />
            <el-table-column prop="hit_rate" label="命中率" width="100">
              <template #default="{ row }">{{ row.hit_rate }}%</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="失效事件" name="invalidations">
          <el-alert
            title="失效操作"
            type="warning"
            :closable="false"
            style="margin-bottom: 20px"
          >
            <el-button type="danger" @click="createInvalidation" :disabled="rule?.status !== 'ready'">
              创建失效事件
            </el-button>
          </el-alert>
          
          <el-table :data="invalidations" stripe>
            <el-table-column prop="event_key" label="事件号" width="200" />
            <el-table-column prop="reason" label="原因" show-overflow-tooltip />
            <el-table-column prop="operator" label="操作人" width="100" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getEventStatusType(row.status)" size="small">
                  {{ getEventStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="250">
              <template #default="{ row }">
                <el-button link type="primary" @click="executeInvalidation(row)" :disabled="row.status !== 'pending'">
                  执行
                </el-button>
                <el-button link type="success" @click="completeInvalidation(row, true)" :disabled="row.status !== 'processing'">
                  成功
                </el-button>
                <el-button link type="danger" @click="completeInvalidation(row, false)" :disabled="row.status !== 'processing'">
                  失败
                </el-button>
                <el-button link type="warning" @click="showCorrectionDialog(row)" :disabled="row.status !== 'failed'">
                  修正
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="回源压力记录" name="pressure">
          <el-table :data="pressureLogs" stripe>
            <el-table-column prop="pressure_level" label="压力等级" width="120">
              <template #default="{ row }">
                <el-tag :type="getPressureType(row.pressure_level)" size="small">{{ row.pressure_level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="estimated_qps" label="预估QPS" width="120" />
            <el-table-column prop="reason" label="原因" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="created_at" label="记录时间" width="180" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="showCorrection" title="失效事件修正" width="600px">
      <el-form :model="correctionForm" label-width="100px">
        <el-form-item label="修正原因">
          <el-input v-model="correctionForm.reason" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="correctionForm.handler" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="correctionForm.comment" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCorrection = false">取消</el-button>
        <el-button type="primary" @click="submitCorrection" :loading="correcting">提交修正</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const route = useRoute()
const ruleId = route.params.id

const loading = ref(false)
const rule = ref(null)
const activeTab = ref('input')
const preheating = ref(false)
const invalidations = ref([])
const pressureLogs = ref([])
const showCorrection = ref(false)
const correcting = ref(false)
const selectedEvent = ref(null)

const processingIds = ref(new Set())

const correctionForm = reactive({
  reason: '',
  handler: '',
  comment: ''
})

const getStatusType = (status) => {
  const map = { pending: 'info', preheating: 'warning', ready: 'success' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待处理', preheating: '预热中', ready: '已就绪' }
  return map[status] || status
}

const getEventStatusType = (status) => {
  const map = { pending: 'info', processing: 'warning', completed: 'success', failed: 'danger', corrected: 'primary' }
  return map[status] || 'info'
}

const getEventStatusText = (status) => {
  const map = { pending: '待执行', processing: '执行中', completed: '已完成', failed: '失败', corrected: '已修正' }
  return map[status] || status
}

const getPressureType = (level) => {
  const map = { low: 'info', medium: 'warning', high: 'danger' }
  return map[level] || 'info'
}

const loadRule = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/rules/${ruleId}`)
    rule.value = res.data
  } catch (err) {
    ElMessage.error('加载规则详情失败')
  } finally {
    loading.value = false
  }
}

const startPreheat = async () => {
  if (processingIds.value.has(ruleId)) {
    ElMessage.warning('预热正在进行中')
    return
  }
  processingIds.value.add(ruleId)
  preheating.value = true
  
  try {
    const res = await axios.post(`/api/rules/${ruleId}/preheat`, { total_keys: 100 })
    ElMessage.success('预热任务已启动')
    
    setTimeout(async () => {
      await axios.post(`/api/batches/${res.data.id}/complete`, {
        success_keys: 95,
        failed_keys: 5,
        hit_rate: 95
      })
      loadRule()
      ElMessage.success('预热完成')
    }, 2000)
    
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '启动预热失败')
  } finally {
    preheating.value = false
    processingIds.value.delete(ruleId)
  }
}

const createInvalidation = async () => {
  try {
    const res = await axios.post(`/api/rules/${ruleId}/invalidate`, {
      reason: '业务数据更新',
      operator: 'admin'
    })
    invalidations.value.unshift(res.data)
    ElMessage.success('失效事件已创建')
  } catch (err) {
    ElMessage.error('创建失效事件失败')
  }
}

const executeInvalidation = async (event) => {
  if (processingIds.value.has(event.id)) {
    ElMessage.warning('操作进行中')
    return
  }
  processingIds.value.add(event.id)
  
  try {
    const res = await axios.post(`/api/invalidations/${event.id}/execute`, {
      pressure_level: 'medium',
      estimated_qps: 500,
      reason: '执行失效操作'
    })
    event.status = 'processing'
    
    pressureLogs.value.unshift({
      id: Date.now(),
      pressure_level: 'medium',
      estimated_qps: 500,
      reason: '执行失效操作',
      status: 'recorded',
      created_at: new Date().toISOString()
    })
    
    ElMessage.success('执行中，回源压力已记录')
  } catch (err) {
    ElMessage.error('执行失败')
  } finally {
    processingIds.value.delete(event.id)
  }
}

const completeInvalidation = async (event, success) => {
  if (processingIds.value.has(event.id)) {
    ElMessage.warning('操作进行中')
    return
  }
  processingIds.value.add(event.id)
  
  try {
    await axios.post(`/api/invalidations/${event.id}/complete`, {
      success,
      failure_reason: success ? '' : '网络超时'
    })
    event.status = success ? 'completed' : 'failed'
    loadRule()
    ElMessage.success(success ? '失效完成' : '已标记为失败')
  } catch (err) {
    ElMessage.error('操作失败')
  } finally {
    processingIds.value.delete(event.id)
  }
}

const showCorrectionDialog = (event) => {
  selectedEvent.value = event
  correctionForm.reason = ''
  correctionForm.handler = ''
  correctionForm.comment = ''
  showCorrection.value = true
}

const submitCorrection = async () => {
  if (!correctionForm.reason) {
    ElMessage.warning('请填写修正原因')
    return
  }
  correcting.value = true
  try {
    await axios.post(`/api/invalidations/${selectedEvent.value.id}/correct`, {
      correction_reason: correctionForm.reason,
      handler: correctionForm.handler,
      comment: correctionForm.comment
    })
    selectedEvent.value.status = 'corrected'
    ElMessage.success('修正记录已提交')
    showCorrection.value = false
  } catch (err) {
    ElMessage.error('提交修正失败')
  } finally {
    correcting.value = false
  }
}

onMounted(() => {
  loadRule()
})
</script>

<style scoped>
.rule-detail {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h4 {
  margin-bottom: 10px;
  color: #303133;
}
</style>
