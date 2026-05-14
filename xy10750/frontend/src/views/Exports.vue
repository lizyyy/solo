<template>
  <div class="exports-page">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>导出管理</span>
          <el-button type="primary" @click="handleCreateExport">
            <el-icon><Download /></el-icon>
            新建导出
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border>
        <el-table-column prop="export_id" label="导出ID" width="200" />
        <el-table-column prop="export_type" label="导出类型" width="150">
          <template #default="{ row }">
            <el-tag>{{ getExportTypeName(row.export_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total_records" label="记录数" width="100" />
        <el-table-column prop="created_by" label="创建人" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="completed_at" label="完成时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.completed_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'completed'"
              link
              type="primary"
              size="small"
              @click="handleDownload(row)"
            >
              下载
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
      v-model="exportDialogVisible"
      title="新建导出"
      width="500px"
    >
      <el-form :model="exportForm" label-width="100px">
        <el-form-item label="导出类型" :required="true">
          <el-select v-model="exportForm.export_type">
            <el-option label="用户偏好" value="preferences" />
            <el-option label="发送回执" value="receipts" />
            <el-option label="重试记录" value="retry_records" />
            <el-option label="统计报表" value="report" />
          </el-select>
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="exportForm.created_by" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleExportSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { exportApi } from '../api'

const tableData = ref([])
const exportDialogVisible = ref(false)

const filters = reactive({
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const exportForm = reactive({
  export_type: '',
  created_by: ''
})

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = {
    processing: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

const getExportTypeName = (type) => {
  const map = {
    preferences: '用户偏好',
    receipts: '发送回执',
    retry_records: '重试记录',
    report: '统计报表'
  }
  return map[type] || type
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
    const res = await exportApi.getList(params)
    tableData.value = res.data.data
    pagination.total = res.data.total
  } catch (error) {
    ElMessage.error('获取列表失败')
  }
}

const resetFilters = () => {
  filters.status = ''
  pagination.page = 1
  fetchList()
}

const handleCreateExport = () => {
  exportForm.export_type = ''
  exportForm.created_by = ''
  exportDialogVisible.value = true
}

const handleExportSubmit = async () => {
  if (!exportForm.export_type) {
    ElMessage.warning('请选择导出类型')
    return
  }

  try {
    await exportApi.create({
      export_type: exportForm.export_type,
      created_by: exportForm.created_by
    })
    ElMessage.success('导出任务创建成功')
    exportDialogVisible.value = false
    setTimeout(() => {
      fetchList()
    }, 1000)
  } catch (error) {
    ElMessage.error('创建导出任务失败')
  }
}

const handleDownload = (row) => {
  exportApi.download(row.export_id)
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.exports-page {
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