<template>
  <div class="logs-page">
    <h2 class="page-title">操作日志</h2>
    
    <el-card class="filter-card">
      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="操作类型">
          <el-select v-model="filters.operation_type" placeholder="请选择操作类型" clearable>
            <el-option label="创建" value="create" />
            <el-option label="更新" value="update" />
            <el-option label="复核" value="review" />
            <el-option label="确认" value="confirm" />
            <el-option label="导出" value="export" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标类型">
          <el-select v-model="filters.target_type" placeholder="请选择目标类型" clearable>
            <el-option label="学员进度" value="progress" />
            <el-option label="补学任务" value="remedial_task" />
            <el-option label="证书资格" value="certificate" />
          </el-select>
        </el-form-item>
        <el-form-item label="有错误">
          <el-select v-model="filters.has_error" placeholder="请选择" clearable>
            <el-option label="是" :value="true" />
            <el-option label="否" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetFilters">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table
        :data="tableData"
        v-loading="loading"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column prop="id" label="日志ID" width="80" />
        <el-table-column prop="operation_type" label="操作类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getOperationTypeColor(row.operation_type)">
              {{ getOperationTypeName(row.operation_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="target_type" label="目标类型" width="120">
          <template #default="{ row }">
            {{ getTargetTypeName(row.target_type) }}
          </template>
        </el-table-column>
        <el-table-column prop="target_id" label="目标ID" width="120" />
        <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.error_message" style="color: #f56c6c;">
              {{ row.error_message }}
            </span>
            <span v-else style="color: #67c23a;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="操作时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)" v-if="row.old_value || row.new_value">
              <el-icon><View /></el-icon>
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        class="pagination"
      />
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="操作详情"
      width="700px"
    >
      <div v-if="currentLog" class="log-detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="操作类型">
            <el-tag :type="getOperationTypeColor(currentLog.operation_type)">
              {{ getOperationTypeName(currentLog.operation_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="操作人">{{ currentLog.operator }}</el-descriptions-item>
          <el-descriptions-item label="目标类型">{{ getTargetTypeName(currentLog.target_type) }}</el-descriptions-item>
          <el-descriptions-item label="目标ID">{{ currentLog.target_id }}</el-descriptions-item>
          <el-descriptions-item label="操作时间" :span="2">{{ formatDate(currentLog.created_at) }}</el-descriptions-item>
        </el-descriptions>

        <el-divider v-if="currentLog.error_message" content-position="left">错误信息</el-divider>
        <el-alert
          v-if="currentLog.error_message"
          :title="currentLog.error_message"
          type="error"
          :closable="false"
          show-icon
        />

        <el-divider content-position="left">变更详情</el-divider>
        <el-row :gutter="20">
          <el-col :span="12" v-if="currentLog.old_value">
            <div class="section-title">变更前（old_value）</div>
            <pre class="json-content">{{ JSON.stringify(currentLog.old_value, null, 2) }}</pre>
          </el-col>
          <el-col :span="12" v-if="currentLog.new_value">
            <div class="section-title">变更后（new_value）</div>
            <pre class="json-content">{{ JSON.stringify(currentLog.new_value, null, 2) }}</pre>
          </el-col>
        </el-row>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { logApi } from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const tableData = ref([])
const detailDialogVisible = ref(false)
const currentLog = ref(null)

const filters = reactive({
  operation_type: '',
  target_type: '',
  has_error: ''
})

const pagination = reactive({
  page: 1,
  page_size: 50,
  total: 0
})

const loadData = async () => {
  loading.value = true
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

    const response = await logApi.getList(params)
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

const resetFilters = () => {
  Object.assign(filters, {
    operation_type: '',
    target_type: '',
    has_error: ''
  })
  pagination.page = 1
  loadData()
}

const viewDetail = (row) => {
  currentLog.value = row
  detailDialogVisible.value = true
}

const getOperationTypeColor = (type) => {
  const map = {
    create: 'success',
    update: 'primary',
    review: 'warning',
    confirm: 'info',
    export: 'info'
  }
  return map[type] || 'info'
}

const getOperationTypeName = (type) => {
  const map = {
    create: '创建',
    update: '更新',
    review: '复核',
    confirm: '确认',
    export: '导出'
  }
  return map[type] || type
}

const getTargetTypeName = (type) => {
  const map = {
    progress: '学员进度',
    remedial_task: '补学任务',
    certificate: '证书资格'
  }
  return map[type] || type
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

loadData()
</script>

<style scoped>
.logs-page {
  padding: 0;
}

.page-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
}

.table-card {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.log-detail {
  padding: 10px 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #606266;
}

.json-content {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
}
</style>
