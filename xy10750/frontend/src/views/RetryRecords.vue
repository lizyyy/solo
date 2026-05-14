<template>
  <div class="retry-page">
    <el-card shadow="hover">
      <template #header>
        <span>重试记录管理</span>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="待确认" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已执行" value="executed" />
            <el-option label="执行失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="人工确认">
          <el-select v-model="filters.manual_confirmed" placeholder="请选择" clearable>
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
        <el-table-column prop="receipt_id" label="回执ID" width="100" />
        <el-table-column prop="retry_number" label="重试次数" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="manual_confirmed" label="人工确认" width="100">
          <template #default="{ row }">
            <el-tag :type="row.manual_confirmed ? 'success' : 'info'">
              {{ row.manual_confirmed ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confirmed_by" label="确认人" width="120" />
        <el-table-column prop="confirmed_at" label="确认时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.confirmed_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="executed_at" label="执行时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.executed_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="result" label="执行结果" width="100" />
        <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              link
              type="primary"
              size="small"
              @click="handleConfirm(row)"
            >
              人工确认
            </el-button>
            <el-button
              v-if="row.status === 'confirmed'"
              link
              type="success"
              size="small"
              @click="handleExecute(row)"
            >
              执行重试
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
      v-model="confirmDialogVisible"
      title="人工确认重试"
      width="500px"
    >
      <el-form :model="confirmForm" label-width="100px">
        <el-form-item label="确认人" :required="true">
          <el-input v-model="confirmForm.confirmed_by" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { retryApi } from '../api'

const tableData = ref([])
const confirmDialogVisible = ref(false)
const currentRetry = ref(null)

const filters = reactive({
  status: '',
  manual_confirmed: null
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const confirmForm = reactive({
  confirmed_by: ''
})

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    confirmed: 'warning',
    executed: 'success',
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
    const res = await retryApi.getList(params)
    tableData.value = res.data.data
    pagination.total = res.data.total
  } catch (error) {
    ElMessage.error('获取列表失败')
  }
}

const resetFilters = () => {
  filters.status = ''
  filters.manual_confirmed = null
  pagination.page = 1
  fetchList()
}

const handleConfirm = (row) => {
  currentRetry.value = row
  confirmForm.confirmed_by = ''
  confirmDialogVisible.value = true
}

const handleConfirmSubmit = async () => {
  if (!confirmForm.confirmed_by) {
    ElMessage.warning('请填写确认人')
    return
  }

  try {
    await retryApi.confirm(currentRetry.value.id, {
      confirmed_by: confirmForm.confirmed_by
    })
    ElMessage.success('确认成功')
    confirmDialogVisible.value = false
    fetchList()
  } catch (error) {
    ElMessage.error('确认失败')
  }
}

const handleExecute = async (row) => {
  try {
    await ElMessageBox.confirm(
      '确定要执行重试吗？',
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await retryApi.execute(row.id)
    ElMessage.success('执行重试成功')
    fetchList()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('执行重试失败')
    }
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.retry-page {
  width: 100%;
}

.filter-form {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>