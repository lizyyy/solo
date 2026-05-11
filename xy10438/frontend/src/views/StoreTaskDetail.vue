<template>
  <div class="task-detail">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">
        返回列表
      </el-button>
      <h2 style="margin: 0 0 0 16px;">任务详情</h2>
      <el-tag :type="getTaskStatusTag(task.status)" style="margin-left: 16px;">
        {{ getTaskStatusText(task.status) }}
      </el-tag>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>基本信息</span>
              <div class="header-actions">
                <el-button
                  v-if="canConfirm"
                  type="primary"
                  :icon="Check"
                  @click="showConfirmDialog"
                >
                  确认换签
                </el-button>
                <el-button
                  v-if="canReportException"
                  type="danger"
                  :icon="Warning"
                  @click="showExceptionDialog"
                >
                  上报异常
                </el-button>
              </div>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="门店">
              {{ task.store_name }} ({{ task.store_code }})
            </el-descriptions-item>
            <el-descriptions-item label="区域">
              {{ task.region_name }}
            </el-descriptions-item>
            <el-descriptions-item label="调价单">
              {{ task.adjustment_title }}
            </el-descriptions-item>
            <el-descriptions-item label="调价单号">
              {{ task.adjustment_no }}
            </el-descriptions-item>
            <el-descriptions-item label="生效时间">
              <span :style="{ color: isBeforeEffectTime ? '#f56c6c' : '#67c23a' }">
                {{ formatTime(task.effect_time) }}
                <span v-if="isBeforeEffectTime" style="font-size: 12px;">(未生效)</span>
                <span v-else style="font-size: 12px;">(已生效)</span>
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="过期时间">
              {{ task.expire_time ? formatTime(task.expire_time) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="确认人" v-if="task.confirmer_name">
              {{ task.confirmer_name }}
            </el-descriptions-item>
            <el-descriptions-item label="确认时间" v-if="task.confirmed_at">
              {{ formatTime(task.confirmed_at) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <span>商品换签明细</span>
          </template>
          <el-table :data="task.items" border>
            <el-table-column type="selection" v-if="canPartialConfirm" width="55" />
            <el-table-column prop="sku" label="SKU" width="120" />
            <el-table-column prop="product_name" label="商品名称" min-width="200" />
            <el-table-column prop="category" label="分类" width="150" />
            <el-table-column label="原价" width="100">
              <template #default="scope">
                ¥{{ scope.row.original_price }}
              </template>
            </el-table-column>
            <el-table-column label="新价" width="100">
              <template #default="scope">
                <span style="color: #f56c6c; font-weight: bold;">
                  ¥{{ scope.row.new_price }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'confirmed' ? 'success' : 'warning'" size="small">
                  {{ scope.row.status === 'confirmed' ? '已确认' : '待确认' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="确认时间" width="160">
              <template #default="scope">
                {{ scope.row.confirmed_at ? formatTime(scope.row.confirmed_at) : '-' }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card style="margin-top: 20px;" v-if="task.exceptions?.length">
          <template #header>
            <span>异常记录 ({{ task.exceptions.length }})</span>
          </template>
          <el-table :data="task.exceptions" border>
            <el-table-column label="异常类型" width="120">
              <template #default="scope">
                <el-tag :type="getExceptionTypeTag(scope.row.type)" size="small">
                  {{ getExceptionTypeText(scope.row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
            <el-table-column prop="reporter_name" label="上报人" width="100" />
            <el-table-column label="上报时间" width="160">
              <template #default="scope">
                {{ formatTime(scope.row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'open' ? 'danger' : 'success'" size="small">
                  {{ scope.row.status === 'open' ? '未处理' : '已解决' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <span>任务进度</span>
          </template>
          <div class="progress-info">
            <el-progress
              :percentage="progressPercent"
              :stroke-width="20"
              :color="progressColor"
            >
              <template #default="{ percentage }">
                <span style="font-size: 14px;">{{ confirmedItemCount }}/{{ task.items?.length || 0 }}</span>
              </template>
            </el-progress>
            <div class="progress-stats">
              <div class="stat-item">
                <span class="stat-label">待确认</span>
                <span class="stat-value">{{ pendingItemCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已确认</span>
                <span class="stat-value" style="color: #67c23a;">{{ confirmedItemCount }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="confirmDialogVisible"
      title="确认换签"
      width="500px"
    >
      <el-alert
        v-if="isBeforeEffectTime"
        title="未到生效时间"
        type="error"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        当前时间未到生效时间（{{ formatTime(task.effect_time) }}），不能确认换签。
      </el-alert>
      <p v-else>
        确认所有商品的价签已更换完成？
      </p>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          :disabled="isBeforeEffectTime"
          @click="confirmTask"
        >
          确认
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="exceptionDialogVisible"
      title="上报异常"
      width="500px"
    >
      <el-form :model="exceptionForm" label-width="100px">
        <el-form-item label="异常类型" required>
          <el-select v-model="exceptionForm.type" placeholder="请选择异常类型" style="width: 100%;">
            <el-option label="价签缺失" value="tag_missing" />
            <el-option label="价格不符" value="price_mismatch" />
            <el-option label="价签损坏" value="damaged_tag" />
            <el-option label="位置错误" value="wrong_location" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联商品">
          <el-select v-model="exceptionForm.adjustmentItemId" placeholder="可选，选择具体商品" clearable style="width: 100%;">
            <el-option
              v-for="item in task.items"
              :key="item.id"
              :label="item.product_name"
              :value="item.adjustment_item_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述" required>
          <el-input
            v-model="exceptionForm.description"
            type="textarea"
            :rows="3"
            placeholder="请描述异常情况"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exceptionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitException">
          提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Check, Warning } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { storeTasksAPI } from '@/api'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const task = ref({})
const selectedItems = ref([])

const confirmDialogVisible = ref(false)
const exceptionDialogVisible = ref(false)
const exceptionForm = ref({
  type: '',
  adjustmentItemId: null,
  description: ''
})

const pendingItemCount = computed(() => {
  return (task.value.items || []).filter(i => i.status !== 'confirmed').length
})

const confirmedItemCount = computed(() => {
  return (task.value.items || []).filter(i => i.status === 'confirmed').length
})

const progressPercent = computed(() => {
  const total = task.value.items?.length || 0
  if (total === 0) return 0
  return Math.round(confirmedItemCount.value / total * 100)
})

const progressColor = computed(() => {
  if (task.value.status === 'has_exception') return '#f56c6c'
  if (progressPercent.value >= 100) return '#67c23a'
  if (progressPercent.value >= 50) return '#409eff'
  return '#e6a23c'
})

const isBeforeEffectTime = computed(() => {
  if (!task.value.effect_time) return false
  return dayjs().isBefore(dayjs(task.value.effect_time))
})

const canConfirm = computed(() => {
  return task.value.status !== 'confirmed'
})

const canPartialConfirm = computed(() => {
  return task.value.status !== 'confirmed' && !isBeforeEffectTime.value
})

const canReportException = computed(() => {
  return task.value.status !== 'confirmed'
})

const loadDetail = async () => {
  loading.value = true
  try {
    const data = await storeTasksAPI.get(route.params.id)
    task.value = data
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}

const showConfirmDialog = () => {
  confirmDialogVisible.value = true
}

const showExceptionDialog = () => {
  exceptionForm.value = {
    type: '',
    adjustmentItemId: null,
    description: ''
  }
  exceptionDialogVisible.value = true
}

const confirmTask = async () => {
  try {
    await storeTasksAPI.confirm(route.params.id, {
      confirmedBy: 'system',
      itemIds: selectedItems.value.length > 0 ? selectedItems.value : undefined
    })
    ElMessage.success('确认成功')
    confirmDialogVisible.value = false
    loadDetail()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

const submitException = async () => {
  if (!exceptionForm.value.type || !exceptionForm.value.description) {
    ElMessage.warning('请填写完整的异常信息')
    return
  }

  try {
    await storeTasksAPI.reportException(route.params.id, {
      type: exceptionForm.value.type,
      description: exceptionForm.value.description,
      adjustmentItemId: exceptionForm.value.adjustmentItemId,
      reportedBy: 'system'
    })
    ElMessage.success('异常上报成功')
    exceptionDialogVisible.value = false
    loadDetail()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

const getTaskStatusText = (status) => {
  const map = {
    pending: '待确认',
    partial_confirmed: '部分确认',
    confirmed: '已确认',
    has_exception: '有异常'
  }
  return map[status] || status
}

const getTaskStatusTag = (status) => {
  const map = {
    pending: 'warning',
    partial_confirmed: 'info',
    confirmed: 'success',
    has_exception: 'danger'
  }
  return map[status] || 'info'
}

const getExceptionTypeText = (type) => {
  const map = {
    tag_missing: '价签缺失',
    price_mismatch: '价格不符',
    damaged_tag: '价签损坏',
    wrong_location: '位置错误',
    other: '其他'
  }
  return map[type] || type
}

const getExceptionTypeTag = (type) => {
  const map = {
    tag_missing: 'danger',
    price_mismatch: 'warning',
    damaged_tag: 'info',
    wrong_location: '',
    other: 'info'
  }
  return map[type] || ''
}

const formatTime = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const goBack = () => {
  router.push('/store-tasks')
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-info {
  padding: 20px 0;
}

.progress-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}
</style>
