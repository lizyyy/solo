<template>
  <div class="receipts-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>发送回执管理</span>
          <el-button type="danger" @click="fetchAbnormalList">
            <el-icon><Warning /></el-icon>
            查看异常
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="用户ID">
          <el-input v-model="filters.user_id" placeholder="请输入用户ID" clearable />
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="filters.channel" placeholder="请选择渠道" clearable>
            <el-option label="邮箱" value="email" />
            <el-option label="短信" value="sms" />
            <el-option label="推送" value="push" />
            <el-option label="微信" value="wechat" />
            <el-option label="APP" value="app" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="待发送" value="pending" />
            <el-option label="已发送" value="sent" />
            <el-option label="已送达" value="delivered" />
            <el-option label="已阅读" value="read" />
            <el-option label="发送失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否有错误">
          <el-select v-model="filters.has_error" placeholder="请选择" clearable>
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="message_id" label="消息ID" width="200" />
        <el-table-column prop="user_id" label="用户ID" width="150" />
        <el-table-column prop="channel" label="渠道" width="100">
          <template #default="{ row }">
            <el-tag>{{ row.channel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="topic" label="主题" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_code" label="错误码" width="100" />
        <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip />
        <el-table-column prop="retry_count" label="重试次数" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleUpdate(row)">
              更新状态
            </el-button>
            <el-button
              v-if="row.status === 'failed'"
              link
              type="warning"
              size="small"
              @click="handleCreateRetry(row)"
            >
              创建重试
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
        class="pagination"
        @size-change="fetchList"
        @current-change="fetchList"
      />
    </el-card>

    <el-dialog
      v-model="updateDialogVisible"
      title="更新回执状态"
      width="500px"
    >
      <el-form :model="updateForm" label-width="100px">
        <el-form-item label="状态" :required="true">
          <el-select v-model="updateForm.status">
            <el-option label="待发送" value="pending" />
            <el-option label="已发送" value="sent" />
            <el-option label="已送达" value="delivered" />
            <el-option label="已阅读" value="read" />
            <el-option label="发送失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="错误码" v-if="updateForm.status === 'failed'">
          <el-input v-model="updateForm.error_code" />
        </el-form-item>
        <el-form-item label="错误信息" v-if="updateForm.status === 'failed'">
          <el-input v-model="updateForm.error_message" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="updateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { receiptApi, retryApi } from '../api'

const tableData = ref([])
const updateDialogVisible = ref(false)
const currentReceipt = ref(null)
const showAbnormalOnly = ref(false)

const filters = reactive({
  user_id: '',
  channel: '',
  status: '',
  has_error: null
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const updateForm = reactive({
  status: '',
  error_code: '',
  error_message: ''
})

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    sent: 'primary',
    delivered: 'success',
    read: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

const fetchList = async () => {
  try {
    const params = {
      ...filters,
      page: pagination.page,
      page_size: pagination.page_size
    }
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) {
        delete params[key]
      }
    })

    let res
    if (showAbnormalOnly.value) {
      res = await receiptApi.getAbnormal({
        page: pagination.page,
        page_size: pagination.page_size
      })
    } else {
      res = await receiptApi.getList(params)
    }
    tableData.value = res.data.data
    pagination.total = res.data.total
  } catch (error) {
    ElMessage.error('获取列表失败')
  }
}

const fetchAbnormalList = () => {
  showAbnormalOnly.value = true
  pagination.page = 1
  fetchList()
}

const resetFilters = () => {
  filters.user_id = ''
  filters.channel = ''
  filters.status = ''
  filters.has_error = null
  showAbnormalOnly.value = false
  pagination.page = 1
  fetchList()
}

const handleUpdate = (row) => {
  currentReceipt.value = row
  updateForm.status = row.status
  updateForm.error_code = row.error_code || ''
  updateForm.error_message = row.error_message || ''
  updateDialogVisible.value = true
}

const handleUpdateSubmit = async () => {
  if (!updateForm.status) {
    ElMessage.warning('请选择状态')
    return
  }

  try {
    await receiptApi.update(currentReceipt.value.id, {
      status: updateForm.status,
      error_code: updateForm.error_code,
      error_message: updateForm.error_message
    })
    ElMessage.success('更新成功')
    updateDialogVisible.value = false
    fetchList()
  } catch (error) {
    ElMessage.error('更新失败')
  }
}

const handleCreateRetry = async (row) => {
  try {
    await retryApi.create({
      receipt_id: row.id,
      preference_id: row.preference_id,
      retry_number: row.retry_count + 1
    })
    ElMessage.success('创建重试记录成功')
  } catch (error) {
    ElMessage.error('创建重试记录失败')
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.receipts-page {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>