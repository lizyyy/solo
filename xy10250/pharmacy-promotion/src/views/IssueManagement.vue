<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ISSUE_TYPES, ISSUE_TYPE_LABEL } from '../data/constants'
import { getIssuesList, updateIssueStatus } from '../utils/dataService'

const emit = defineEmits(['refresh'])

const issues = ref([])
const loading = ref(false)
const filters = ref({
  type: '',
  status: ''
})

const currentIssue = ref(null)
const showDetailDialog = ref(false)

function loadIssues() {
  loading.value = true
  setTimeout(() => {
    issues.value = getIssuesList(filters.value)
    loading.value = false
  }, 300)
}

function handleSearch() {
  loadIssues()
}

function handleReset() {
  filters.value = {
    type: '',
    status: ''
  }
  loadIssues()
}

function handleViewDetail(issue) {
  currentIssue.value = issue
  showDetailDialog.value = true
}

function handleResolve(issue) {
  ElMessageBox.confirm(
    '确定要将此问题标记为已解决吗？',
    '确认操作',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const result = updateIssueStatus(issue.id, 'resolved')
    if (result.success) {
      ElMessage.success('问题已标记为已解决')
      loadIssues()
      emit('refresh')
    }
  }).catch(() => {})
}

function handleReopen(issue) {
  const result = updateIssueStatus(issue.id, 'pending')
  if (result.success) {
    ElMessage.success('问题已重新打开')
    loadIssues()
    emit('refresh')
  }
}

function getIssueTypeLabel(type) {
  return ISSUE_TYPE_LABEL[type] || type
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function getStatusTagType(status) {
  return status === 'pending' ? 'warning' : 'success'
}

function getStatusLabel(status) {
  return status === 'pending' ? '待处理' : '已解决'
}

onMounted(() => {
  loadIssues()
})
</script>

<template>
  <div class="issue-management">
    <div class="page-header">
      <h2>问题列表</h2>
      <div class="header-actions">
        <el-button @click="handleReset">
          <el-icon><Refresh /></el-icon>
          重置筛选
        </el-button>
      </div>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="问题类型">
          <el-select v-model="filters.type" placeholder="全部" clearable style="width: 180px">
            <el-option
              v-for="(label, value) in ISSUE_TYPE_LABEL"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="处理状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 150px">
            <el-option label="待处理" value="pending" />
            <el-option label="已解决" value="resolved" />
          </el-select>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table
        :data="issues"
        v-loading="loading"
        stripe
        style="width: 100%"
        empty-text="暂无问题记录"
      >
        <el-table-column label="问题类型" width="150">
          <template #default="{ row }">
            <el-tag type="info">{{ getIssueTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="source" label="来源" width="150" />
        
        <el-table-column label="错误信息" min-width="300">
          <template #default="{ row }">
            <div class="error-list">
              <div v-for="(error, index) in row.errors" :key="index" class="error-item">
                <el-icon color="#f56c6c"><Warning /></el-icon>
                {{ error }}
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              type="success"
              link
              size="small"
              @click="handleResolve(row)"
            >
              标记解决
            </el-button>
            <el-button
              v-else
              type="warning"
              link
              size="small"
              @click="handleReopen(row)"
            >
              重新打开
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="showDetailDialog"
      title="问题详情"
      width="700px"
      :close-on-click-modal="false"
    >
      <div v-if="currentIssue" class="issue-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="问题类型">
            <el-tag type="info">{{ getIssueTypeLabel(currentIssue.type) }}</el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="来源">
            {{ currentIssue.source }}
          </el-descriptions-item>
          
          <el-descriptions-item label="处理状态">
            <el-tag :type="getStatusTagType(currentIssue.status)">
              {{ getStatusLabel(currentIssue.status) }}
            </el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(currentIssue.createdAt) }}
          </el-descriptions-item>
          
          <el-descriptions-item label="解决时间" v-if="currentIssue.resolvedAt">
            {{ formatDateTime(currentIssue.resolvedAt) }}
          </el-descriptions-item>
          
          <el-descriptions-item label="行号" v-if="currentIssue.rowNumber">
            第 {{ currentIssue.rowNumber }} 行
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="error-section">
          <h4>错误信息</h4>
          <el-alert
            v-for="(error, index) in currentIssue.errors"
            :key="index"
            type="error"
            :closable="false"
            show-icon
            style="margin-bottom: 8px"
          >
            {{ error }}
          </el-alert>
        </div>
        
        <div v-if="currentIssue.warnings?.length > 0" class="warning-section">
          <h4>警告信息</h4>
          <el-alert
            v-for="(warning, index) in currentIssue.warnings"
            :key="index"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 8px"
          >
            {{ warning }}
          </el-alert>
        </div>
        
        <div v-if="currentIssue.data" class="data-section">
          <h4>原始数据</h4>
          <el-card class="data-card">
            <pre>{{ JSON.stringify(currentIssue.data, null, 2) }}</pre>
          </el-card>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button
          v-if="currentIssue?.status === 'pending'"
          type="success"
          @click="handleResolve(currentIssue)"
        >
          标记为已解决
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.issue-management {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-card {
  background: #fff;
}

.filter-form {
  margin: 0;
}

.table-card {
  background: #fff;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #606266;
}

.issue-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-section,
.warning-section,
.data-section {
  margin-top: 16px;
}

.error-section h4,
.warning-section h4,
.data-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #303133;
}

.data-card {
  background: #f5f7fa;
}

.data-card pre {
  margin: 0;
  font-size: 12px;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
