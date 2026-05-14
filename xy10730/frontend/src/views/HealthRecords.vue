<template>
  <div class="health-records">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>健康巡检记录</span>
          <el-button type="primary" @click="handleExport">导出Excel</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="服务">
          <el-select v-model="filters.service_id" clearable placeholder="选择服务">
            <el-option
              v-for="service in services"
              :key="service.id"
              :label="service.name"
              :value="service.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="健康状态">
          <el-select v-model="filters.health_status" clearable placeholder="选择状态">
            <el-option label="健康" value="healthy" />
            <el-option label="警告" value="warning" />
            <el-option label="错误" value="error" />
            <el-option label="严重" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="检查状态">
          <el-select v-model="filters.check_status" clearable placeholder="选择状态">
            <el-option label="成功" value="success" />
            <el-option label="待复核" value="pending_review" />
            <el-option label="已拦截" value="intercepted" />
            <el-option label="可重试" value="retryable" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否已复核">
          <el-select v-model="filters.reviewed" clearable>
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="filters.start_time"
            type="datetime"
            placeholder="选择开始时间"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="filters.end_time"
            type="datetime"
            placeholder="选择结束时间"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRecords">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="records" border stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="service.name" label="服务名称" min-width="120">
          <template #default="{ row }">
            {{ row.service?.name }}
          </template>
        </el-table-column>
        <el-table-column prop="check_time" label="检查时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.check_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="health_status" label="健康状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getHealthStatusType(row.health_status)">
              {{ getHealthStatusLabel(row.health_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="check_status" label="检查状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getCheckStatusType(row.check_status)">
              {{ getCheckStatusLabel(row.check_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fault_level" label="故障等级" width="120">
          <template #default="{ row }">
            {{ getFaultLevelLabel(row.fault_level) }}
          </template>
        </el-table-column>
        <el-table-column prop="reviewed" label="已复核" width="80">
          <template #default="{ row }">
            {{ row.reviewed ? '是' : '否' }}
          </template>
        </el-table-column>
        <el-table-column prop="recovery_confirmed" label="已恢复确认" width="100">
          <template #default="{ row }">
            {{ row.recovery_confirmed ? '是' : '否' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">查看详情</el-button>
            <el-button
              v-if="!row.reviewed"
              link
              type="success"
              @click="openReviewDialog(row)"
            >
              复核
            </el-button>
            <el-button
              v-if="row.reviewed && !row.recovery_confirmed"
              link
              type="warning"
              @click="openConfirmRecovery(row)"
            >
              恢复确认
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="filters.page"
        v-model:page-size="filters.page_size"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        style="margin-top: 20px; justify-content: flex-end"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadRecords"
        @current-change="loadRecords"
      />
    </el-card>

    <el-drawer
      v-model="detailDrawerVisible"
      title="错误详情"
      size="50%"
    >
      <div v-if="currentRecord" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="服务名称">
            {{ currentRecord.service?.name }}
          </el-descriptions-item>
          <el-descriptions-item label="检查时间">
            {{ formatDate(currentRecord.check_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="健康状态">
            <el-tag :type="getHealthStatusType(currentRecord.health_status)">
              {{ getHealthStatusLabel(currentRecord.health_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="检查状态">
            <el-tag :type="getCheckStatusType(currentRecord.check_status)">
              {{ getCheckStatusLabel(currentRecord.check_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="故障等级">
            {{ getFaultLevelLabel(currentRecord.fault_level) }}
          </el-descriptions-item>
          <el-descriptions-item label="重试次数">
            {{ currentRecord.retry_count }}
          </el-descriptions-item>
          <el-descriptions-item label="是否已复核">
            {{ currentRecord.reviewed ? '是' : '否' }}
          </el-descriptions-item>
          <el-descriptions-item label="是否已恢复确认">
            {{ currentRecord.recovery_confirmed ? '是' : '否' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">错误详情</el-divider>
        <el-alert
          v-if="currentRecord.error_details"
          type="error"
          :closable="false"
          show-icon
        >
          <pre style="white-space: pre-wrap; margin: 0">{{ currentRecord.error_details }}</pre>
        </el-alert>
        <el-empty v-else description="无错误信息" />

        <el-divider content-position="left">探活结果</el-divider>
        <el-input
          type="textarea"
          :rows="4"
          :model-value="JSON.stringify(currentRecord.probe_result, null, 2)"
          readonly
        />

        <el-divider content-position="left">依赖检查结果</el-divider>
        <el-input
          type="textarea"
          :rows="4"
          :model-value="JSON.stringify(currentRecord.dependency_check_result, null, 2)"
          readonly
        />

        <el-divider content-position="left" v-if="currentRecord.review_comment">复核意见</el-divider>
        <el-alert v-if="currentRecord.review_comment" type="info" :closable="false" show-icon>
          <pre style="white-space: pre-wrap; margin: 0">{{ currentRecord.review_comment }}</pre>
          <div style="margin-top: 10px; font-size: 12px; color: #909399">
            复核人: {{ currentRecord.reviewed_by }} | 复核时间: {{ formatDate(currentRecord.reviewed_at) }}
          </div>
        </el-alert>
      </div>
    </el-drawer>

    <el-dialog v-model="reviewDialogVisible" title="复核记录" width="500px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="复核人">
          <el-input v-model="reviewForm.reviewed_by" placeholder="请输入复核人姓名" />
        </el-form-item>
        <el-form-item label="检查状态">
          <el-select v-model="reviewForm.check_status" placeholder="选择检查状态">
            <el-option label="成功" value="success" />
            <el-option label="待复核" value="pending_review" />
            <el-option label="已拦截" value="intercepted" />
            <el-option label="可重试" value="retryable" />
          </el-select>
        </el-form-item>
        <el-form-item label="复核意见">
          <el-input
            v-model="reviewForm.review_comment"
            type="textarea"
            :rows="4"
            placeholder="请输入复核意见"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReview">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="confirmDialogVisible" title="恢复确认" width="500px">
      <el-form :model="confirmForm" label-width="100px">
        <el-form-item label="确认人">
          <el-input v-model="confirmForm.confirmed_by" placeholder="请输入确认人姓名" />
        </el-form-item>
        <el-form-item label="确认意见">
          <el-input
            v-model="confirmForm.review_comment"
            type="textarea"
            :rows="4"
            placeholder="请输入确认意见"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitConfirmRecovery">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { healthRecordAPI, serviceAPI } from '@/api'

const records = ref([])
const services = ref([])
const total = ref(0)
const detailDrawerVisible = ref(false)
const reviewDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const currentRecord = ref(null)

const filters = reactive({
  service_id: null,
  health_status: null,
  check_status: null,
  start_time: null,
  end_time: null,
  reviewed: null,
  page: 1,
  page_size: 20
})

const reviewForm = reactive({
  reviewed_by: '',
  check_status: '',
  review_comment: ''
})

const confirmForm = reactive({
  confirmed_by: '',
  review_comment: ''
})

const loadServices = async () => {
  try {
    const res = await serviceAPI.getServices()
    services.value = res.data
  } catch (e) {
    ElMessage.error('加载服务列表失败')
  }
}

const loadRecords = async () => {
  try {
    const res = await healthRecordAPI.getRecords(filters)
    records.value = res.data.data.records
    total.value = res.data.data.total
  } catch (e) {
    ElMessage.error('加载巡检记录失败')
  }
}

const resetFilters = () => {
  Object.assign(filters, {
    service_id: null,
    health_status: null,
    check_status: null,
    start_time: null,
    end_time: null,
    reviewed: null,
    page: 1,
    page_size: 20
  })
  loadRecords()
}

const viewDetail = (row) => {
  currentRecord.value = row
  detailDrawerVisible.value = true
}

const openReviewDialog = (row) => {
  currentRecord.value = row
  Object.assign(reviewForm, {
    reviewed_by: '',
    check_status: row.check_status,
    review_comment: ''
  })
  reviewDialogVisible.value = true
}

const openConfirmRecovery = (row) => {
  currentRecord.value = row
  Object.assign(confirmForm, {
    confirmed_by: '',
    review_comment: ''
  })
  confirmDialogVisible.value = true
}

const submitReview = async () => {
  if (!reviewForm.reviewed_by) {
    ElMessage.warning('请输入复核人姓名')
    return
  }
  try {
    await healthRecordAPI.review(currentRecord.value.id, reviewForm)
    ElMessage.success('复核成功')
    reviewDialogVisible.value = false
    loadRecords()
  } catch (e) {
    ElMessage.error('复核失败')
  }
}

const submitConfirmRecovery = async () => {
  if (!confirmForm.confirmed_by) {
    ElMessage.warning('请输入确认人姓名')
    return
  }
  try {
    await healthRecordAPI.confirmRecovery(currentRecord.value.id, confirmForm)
    ElMessage.success('确认成功')
    confirmDialogVisible.value = false
    loadRecords()
  } catch (e) {
    ElMessage.error('确认失败')
  }
}

const handleExport = async () => {
  try {
    const res = await healthRecordAPI.export({
      service_id: filters.service_id,
      health_status: filters.health_status,
      check_status: filters.check_status,
      start_time: filters.start_time,
      end_time: filters.end_time,
      reviewed: filters.reviewed
    })
    
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    const disposition = res.headers['content-disposition']
    const filename = disposition?.match(/filename=(.*)/)?.[1] || '健康巡检记录.xlsx'
    link.setAttribute('download', decodeURIComponent(filename))
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

const getHealthStatusType = (status) => {
  const map = {
    healthy: 'success',
    warning: 'warning',
    error: 'danger',
    critical: 'danger'
  }
  return map[status] || 'info'
}

const getHealthStatusLabel = (status) => {
  const map = {
    healthy: '健康',
    warning: '警告',
    error: '错误',
    critical: '严重'
  }
  return map[status] || status
}

const getCheckStatusType = (status) => {
  const map = {
    success: 'success',
    pending_review: 'warning',
    intercepted: 'danger',
    retryable: 'info'
  }
  return map[status] || 'info'
}

const getCheckStatusLabel = (status) => {
  const map = {
    success: '成功',
    pending_review: '待复核',
    intercepted: '已拦截',
    retryable: '可重试'
  }
  return map[status] || status
}

const getFaultLevelLabel = (level) => {
  const map = {
    timeout: '超时',
    connection_error: '连接错误',
    multiple_faults: '多重故障',
    probe_fault: '探活故障',
    dependency_fault: '依赖故障',
    unknown: '未知'
  }
  return map[level] || level || '-'
}

onMounted(() => {
  loadServices()
  loadRecords()
})
</script>

<style scoped>
.health-records {
  height: 100%;
}

.filter-form {
  margin-bottom: 20px;
}

.detail-content {
  padding: 0 20px;
}
</style>
