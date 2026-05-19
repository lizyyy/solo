<template>
  <div class="remedial-page">
    <h2 class="page-title">补学任务管理</h2>
    
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>异常补学任务列表</span>
          <el-button type="primary" @click="loadData">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>
      
      <el-table
        :data="tableData"
        v-loading="loading"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column prop="task_id" label="任务ID" width="120" />
        <el-table-column prop="task_name" label="任务名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="task_type" label="任务类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.task_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="任务原因" min-width="180" show-overflow-tooltip />
        <el-table-column prop="is_abnormal" label="是否异常" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_abnormal ? 'danger' : 'success'">
              {{ row.is_abnormal ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="abnormal_reason" label="异常原因" min-width="180" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reviewed_by" label="复核人" width="120" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openReviewDrawer(row)">
              <el-icon><Edit /></el-icon>
              复核
            </el-button>
            <el-button link type="info" @click="viewErrorDetail(row)">
              <el-icon><View /></el-icon>
              错误明细
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        class="pagination"
      />
    </el-card>

    <el-drawer
      v-model="reviewDrawerVisible"
      title="补学任务复核"
      size="500px"
    >
      <div v-if="currentTask" class="review-content">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="任务ID">{{ currentTask.task_id }}</el-descriptions-item>
          <el-descriptions-item label="任务名称">{{ currentTask.task_name }}</el-descriptions-item>
          <el-descriptions-item label="任务类型">{{ currentTask.task_type }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="getStatusType(currentTask.status)">
              {{ getStatusText(currentTask.status) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <el-form :model="reviewForm" label-width="100px">
          <el-form-item label="处理状态" required>
            <el-select v-model="reviewForm.status" placeholder="请选择处理状态">
              <el-option label="待处理" value="pending" />
              <el-option label="处理中" value="processing" />
              <el-option label="已完成" value="completed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
          </el-form-item>
          <el-form-item label="是否异常" required>
            <el-radio-group v-model="reviewForm.is_abnormal">
              <el-radio :value="true">是</el-radio>
              <el-radio :value="false">否</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="异常原因" v-if="reviewForm.is_abnormal">
            <el-input
              v-model="reviewForm.abnormal_reason"
              type="textarea"
              :rows="3"
              placeholder="请输入异常原因"
            />
          </el-form-item>
          <el-form-item label="复核人" required>
            <el-input v-model="reviewForm.reviewed_by" placeholder="请输入复核人姓名" />
          </el-form-item>
          <el-form-item label="复核备注">
            <el-input
              v-model="reviewForm.review_notes"
              type="textarea"
              :rows="3"
              placeholder="请输入复核备注"
            />
          </el-form-item>
        </el-form>

        <div class="drawer-footer">
          <el-button @click="reviewDrawerVisible = false">取消</el-button>
          <el-button type="primary" @click="submitReview">提交复核</el-button>
        </div>
      </div>
    </el-drawer>

    <el-dialog
      v-model="errorDetailVisible"
      title="错误明细"
      width="600px"
    >
      <div v-if="currentTask" class="error-detail">
        <el-alert
          :title="currentTask.abnormal_reason || '暂无错误信息'"
          type="error"
          :closable="false"
          show-icon
        />
        <el-descriptions :column="1" border size="small" class="mt-20">
          <el-descriptions-item label="任务ID">{{ currentTask.task_id }}</el-descriptions-item>
          <el-descriptions-item label="任务名称">{{ currentTask.task_name }}</el-descriptions-item>
          <el-descriptions-item label="发生时间">{{ formatDate(currentTask.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="最后更新">{{ formatDate(currentTask.updated_at) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { remedialApi } from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const reviewDrawerVisible = ref(false)
const errorDetailVisible = ref(false)
const currentTask = ref(null)

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const reviewForm = reactive({
  task_id: null,
  status: '',
  is_abnormal: false,
  abnormal_reason: '',
  reviewed_by: '',
  review_notes: ''
})

const loadData = async () => {
  loading.value = true
  try {
    const response = await remedialApi.getAbnormal({
      page: pagination.page,
      page_size: pagination.page_size
    })
    if (response.data.success) {
      tableData.value = response.data.data.items
      pagination.total = response.data.data.total
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const openReviewDrawer = (row) => {
  currentTask.value = row
  Object.assign(reviewForm, {
    task_id: row.id,
    status: row.status,
    is_abnormal: row.is_abnormal,
    abnormal_reason: row.abnormal_reason || '',
    reviewed_by: '',
    review_notes: ''
  })
  reviewDrawerVisible.value = true
}

const viewErrorDetail = (row) => {
  currentTask.value = row
  errorDetailVisible.value = true
}

const submitReview = async () => {
  if (!reviewForm.status || !reviewForm.reviewed_by) {
    ElMessage.warning('请填写必填项')
    return
  }
  if (reviewForm.is_abnormal && !reviewForm.abnormal_reason) {
    ElMessage.warning('请输入异常原因')
    return
  }

  try {
    const response = await remedialApi.review(reviewForm)
    if (response.data.success) {
      ElMessage.success('复核成功')
      reviewDrawerVisible.value = false
      loadData()
    }
  } catch (error) {
    ElMessage.error('复核失败')
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    processing: 'primary',
    completed: 'success',
    cancelled: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

loadData()
</script>

<style scoped>
.remedial-page {
  padding: 0;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-card {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.review-content {
  padding: 0 20px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.error-detail {
  padding: 10px;
}

.mt-20 {
  margin-top: 20px;
}
</style>
