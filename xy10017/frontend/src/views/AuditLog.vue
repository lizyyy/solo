<template>
  <div class="container">
    <div class="page-header">
      <h2>操作日志</h2>
      <el-button type="primary" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出报告
      </el-button>
    </div>
    
    <div class="filter-bar">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="操作类型">
          <el-select v-model="filterForm.action" placeholder="全部操作" clearable style="width: 180px">
            <el-option
              v-for="(label, value) in actionLabels"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="资源类型">
          <el-select v-model="filterForm.resourceType" placeholder="全部资源" clearable style="width: 130px">
            <el-option
              v-for="(label, value) in resourceTypeLabels"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadLogs">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <el-card>
      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column prop="action" label="操作" width="150">
          <template #default="{ row }">
            <el-tag :type="getActionTagType(row.action)" size="small">
              {{ actionLabels[row.action] || row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="resourceType" label="资源" width="100">
          <template #default="{ row }">
            {{ resourceTypeLabels[row.resourceType] || row.resourceType }}
          </template>
        </el-table-column>
        <el-table-column prop="username" label="操作用户" width="120" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ipAddress" label="IP地址" width="140" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="操作时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="变更详情" width="100">
          <template #default="{ row }">
            <el-button
              v-if="row.changes?.length > 0"
              link
              type="primary"
              @click="showChanges(row)"
            >
              查看
            </el-button>
            <span v-else style="color: #909399">-</span>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>
    </el-card>
    
    <el-dialog v-model="changesDialogVisible" title="变更详情" width="600px">
      <el-table :data="currentChanges" stripe>
        <el-table-column prop="field" label="字段" width="150" />
        <el-table-column label="变更前">
          <template #default="{ row }">
            <pre style="margin: 0; white-space: pre-wrap; word-break: break-all">{{ formatValue(row.before) }}</pre>
          </template>
        </el-table-column>
        <el-table-column label="变更后">
          <template #default="{ row }">
            <pre style="margin: 0; white-space: pre-wrap; word-break: break-all">{{ formatValue(row.after) }}</pre>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { AuditLog, AuditAction, ResourceType } from '@/types'
import { listAuditLogs, exportAuditReport } from '@/api/audit'

const loading = ref(false)
const logs = ref<AuditLog[]>([])
const changesDialogVisible = ref(false)
const currentChanges = ref<any[]>([])

const dateRange = ref<string[]>([])

const filterForm = reactive({
  action: '' as AuditAction | '',
  resourceType: '' as ResourceType | '',
})

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
})

const actionLabels: Record<AuditAction, string> = {
  user_login: '用户登录',
  user_logout: '用户登出',
  push_created: '创建推送',
  push_updated: '更新推送',
  push_deleted: '删除推送',
  push_sent: '推送已发送',
  push_failed: '推送失败',
  push_cancelled: '取消推送',
  push_retried: '重试推送',
  report_exported: '导出报告',
}

const resourceTypeLabels: Record<ResourceType, string> = {
  user: '用户',
  push_message: '推送消息',
  audit_log: '审计日志',
  report: '报告',
}

function getActionTagType(action: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const successActions = ['user_login', 'push_created', 'push_updated', 'push_sent', 'report_exported']
  const warningActions = ['push_cancelled', 'push_retried']
  const dangerActions = ['push_failed', 'push_deleted']
  
  if (successActions.includes(action)) return 'success'
  if (warningActions.includes(action)) return 'warning'
  if (dangerActions.includes(action)) return 'danger'
  return 'info'
}

function formatDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function showChanges(row: AuditLog) {
  currentChanges.value = row.changes || []
  changesDialogVisible.value = true
}

async function loadLogs() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      limit: pagination.limit,
    }
    
    if (filterForm.action) {
      params.action = filterForm.action
    }
    
    if (filterForm.resourceType) {
      params.resourceType = filterForm.resourceType
    }
    
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    const result = await listAuditLogs(params)
    logs.value = result.data
    pagination.total = result.pagination.total
  } catch (e) {
    console.error('Failed to load logs:', e)
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filterForm.action = ''
  filterForm.resourceType = ''
  dateRange.value = []
  pagination.page = 1
  loadLogs()
}

async function handleExport() {
  try {
    const params: any = {}
    
    if (filterForm.action) {
      params.action = filterForm.action
    }
    
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    await exportAuditReport(params)
    ElMessage.success('报告导出成功')
  } catch (e) {
    ElMessage.error('导出报告失败')
  }
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
