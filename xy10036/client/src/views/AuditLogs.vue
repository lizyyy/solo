<template>
  <div>
    <div class="page-header">
      <h2>操作日志</h2>
    </div>

    <div class="table-container">
      <div class="filter-bar">
        <div class="filter-item">
          <label>实体类型：</label>
          <el-select v-model="filters.entityType" placeholder="全部" clearable style="width: 140px" @change="loadLogs(1)">
            <el-option label="设备" value="device" />
            <el-option label="借用记录" value="borrow_record" />
            <el-option label="用户" value="user" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>操作类型：</label>
          <el-select v-model="filters.action" placeholder="全部" clearable style="width: 140px" @change="loadLogs(1)">
            <el-option label="创建" value="create" />
            <el-option label="更新" value="update" />
            <el-option label="删除" value="delete" />
            <el-option label="借用" value="borrow" />
            <el-option label="归还" value="return" />
            <el-option label="状态变更" value="status_change" />
          </el-select>
        </div>
        <div class="filter-item">
          <label>开始时间：</label>
          <el-date-picker
            v-model="filters.startTime"
            type="datetime"
            placeholder="选择开始时间"
            style="width: 200px"
            @change="loadLogs(1)"
          />
        </div>
        <div class="filter-item">
          <label>结束时间：</label>
          <el-date-picker
            v-model="filters.endTime"
            type="datetime"
            placeholder="选择结束时间"
            style="width: 200px"
            @change="loadLogs(1)"
          />
        </div>
        <el-button type="primary" @click="loadLogs(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table :data="logs" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="operatorName" label="操作人" width="120" />
        <el-table-column label="操作类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getActionTagType(row.action)" size="small">
              {{ getActionText(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="实体类型" width="120">
          <template #default="{ row }">
            {{ getEntityTypeText(row.entityType) }}
          </template>
        </el-table-column>
        <el-table-column prop="entityName" label="实体名称" min-width="150" />
        <el-table-column label="操作时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP地址" width="130" />
        <el-table-column prop="requestId" label="请求ID" min-width="200" show-overflow-tooltip />
        <el-table-column label="详情" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDetailDialog(row)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadLogs(1)"
          @current-change="loadLogs"
        />
      </div>
    </div>

    <el-dialog
      v-model="detailDialogVisible"
      title="操作日志详情"
      width="800px"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item label="操作人">{{ currentLog?.operatorName }}</el-descriptions-item>
        <el-descriptions-item label="操作人ID">{{ currentLog?.operatorId }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">
          <el-tag :type="currentLog ? getActionTagType(currentLog.action) : ''" size="small">
            {{ currentLog ? getActionText(currentLog.action) : '' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="实体类型">
          {{ currentLog ? getEntityTypeText(currentLog.entityType) : '' }}
        </el-descriptions-item>
        <el-descriptions-item label="实体名称">{{ currentLog?.entityName }}</el-descriptions-item>
        <el-descriptions-item label="实体ID">{{ currentLog?.entityId }}</el-descriptions-item>
        <el-descriptions-item label="操作时间">
          {{ currentLog ? formatTime(currentLog.createdAt) : '' }}
        </el-descriptions-item>
        <el-descriptions-item label="请求ID">{{ currentLog?.requestId }}</el-descriptions-item>
        <el-descriptions-item label="IP地址">{{ currentLog?.ip || '-' }}</el-descriptions-item>
        <el-descriptions-item label="User-Agent" :span="2">
          <span style="word-break: break-all">{{ currentLog?.userAgent || '-' }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">变更内容</el-divider>

      <el-row :gutter="20">
        <el-col :span="12">
          <div class="log-section">
            <h4>变更前</h4>
            <pre class="log-content">{{ currentLog?.before ? formatJson(currentLog.before) : '-' }}</pre>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="log-section">
            <h4>变更后</h4>
            <pre class="log-content">{{ currentLog?.after ? formatJson(currentLog.after) : '-' }}</pre>
          </div>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import api from '../utils/api'
import type { AuditLog, AuditAction, EntityType } from '../../../shared/types'

const loading = ref(false)
const logs = ref<AuditLog[]>([])

const filters = reactive({
  entityType: '',
  action: '',
  startTime: null,
  endTime: null
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const detailDialogVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)

function getActionText(action: AuditAction): string {
  const map: Record<AuditAction, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    borrow: '借用',
    return: '归还',
    status_change: '状态变更'
  }
  return map[action] || action
}

function getActionTagType(action: AuditAction): 'success' | 'primary' | 'danger' | 'warning' | 'info' {
  const map: Record<AuditAction, 'success' | 'primary' | 'danger' | 'warning' | 'info'> = {
    create: 'success',
    update: 'primary',
    delete: 'danger',
    borrow: 'warning',
    return: 'success',
    status_change: 'info'
  }
  return map[action] || 'info'
}

function getEntityTypeText(entityType: EntityType): string {
  const map: Record<EntityType, string> = {
    device: '设备',
    borrow_record: '借用记录',
    user: '用户'
  }
  return map[entityType] || entityType
}

function formatTime(time: string): string {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

function formatJson(obj: Record<string, any>): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

function resetFilters(): void {
  filters.entityType = ''
  filters.action = ''
  filters.startTime = null
  filters.endTime = null
  loadLogs(1)
}

async function loadLogs(page: number = pagination.page): Promise<void> {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page,
      pageSize: pagination.pageSize
    }
    
    if (filters.entityType) params.entityType = filters.entityType
    if (filters.action) params.action = filters.action
    if (filters.startTime) params.startTime = dayjs(filters.startTime).toISOString()
    if (filters.endTime) params.endTime = dayjs(filters.endTime).toISOString()

    const result = await api.get('/audit', params)
    
    logs.value = result.items
    pagination.total = result.total
    pagination.page = result.page
  } catch (error: any) {
    ElMessage.error(error.message || '加载操作日志失败')
  } finally {
    loading.value = false
  }
}

function openDetailDialog(log: AuditLog): void {
  currentLog.value = log
  detailDialogVisible.value = true
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.log-section h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #606266;
}

.log-content {
  margin: 0;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  max-height: 300px;
  overflow-y: auto;
  word-break: break-all;
}
</style>
