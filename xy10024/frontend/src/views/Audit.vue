<template>
  <div>
    <el-card>
      <template #header>
        <div class="filter-bar" style="width: 100%; margin: 0;">
          <el-input v-model="requestIdSearch" placeholder="搜索请求ID" style="width: 300px;" clearable />
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 350px;"
          />
          <el-button type="primary" @click="loadAuditLogs">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
        </div>
      </template>

      <div v-if="loading" style="text-align: center; padding: 40px;">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p style="margin-top: 16px;">加载中...</p>
      </div>

      <div v-else class="event-timeline">
        <div v-for="log in logs" :key="log.id" class="audit-log-item">
          <div class="audit-action">
            <el-tag :type="getActionType(log.action)" size="small" style="margin-right: 8px;">
              {{ log.action }}
            </el-tag>
            <span v-if="log.resource_type">
              {{ log.resource_type }}: {{ log.resource_id?.substring(0, 8) }}...
            </span>
          </div>
          <div class="audit-meta">
            <span v-if="log.user_id">用户: {{ log.user_id.substring(0, 8) }}...</span>
            <span v-if="log.request_id">请求ID: {{ log.request_id.substring(0, 12) }}...</span>
            <span>IP: {{ log.ip_address || '-' }}</span>
            <span>{{ formatDate(log.timestamp) }}</span>
          </div>
          <div v-if="log.before_state || log.after_state" class="audit-state">
            <div v-if="log.before_state" class="state-section">
              <div class="state-label">变更前</div>
              <div class="state-content">{{ formatState(log.before_state) }}</div>
            </div>
            <div v-if="log.after_state" class="state-section">
              <div class="state-label">变更后</div>
              <div class="state-content">{{ formatState(log.after_state) }}</div>
            </div>
          </div>
        </div>

        <el-empty v-if="logs.length === 0" description="暂无审计日志" />
      </div>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end;"
        @size-change="loadAuditLogs"
        @current-change="loadAuditLogs"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getAuditLogs, getEventsByRequestId } from '@/api/audit'
import dayjs from 'dayjs'

const loading = ref(false)
const logs = ref([])
const requestIdSearch = ref('')
const dateRange = ref([])

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

function formatState(state) {
  try {
    return JSON.stringify(state, null, 2)
  } catch {
    return String(state)
  }
}

function getActionType(action) {
  if (action.includes('create') || action.includes('borrow')) return 'success'
  if (action.includes('update') || action.includes('login')) return 'primary'
  if (action.includes('delete') || action.includes('return')) return 'danger'
  return 'info'
}

async function loadAuditLogs() {
  loading.value = true
  try {
    if (requestIdSearch.value) {
      try {
        const eventsRes = await getEventsByRequestId(requestIdSearch.value)
        logs.value = eventsRes.events?.map(e => ({
          id: e.id,
          action: e.event_type,
          resource_type: e.aggregate_type,
          resource_id: e.aggregate_id,
          user_id: e.created_by,
          request_id: e.request_id,
          timestamp: e.created_at,
          before_state: null,
          after_state: e.payload
        })) || []
        pagination.total = logs.value.length
        return
      } catch (e) {
        console.log('Search by request ID failed, using normal search')
      }
    }

    const params = {
      page: pagination.page,
      page_size: pagination.pageSize
    }

    const res = await getAuditLogs(params)
    logs.value = res.logs || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('Failed to load audit logs:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAuditLogs()
})
</script>
