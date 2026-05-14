<template>
  <div class="session-detail">
    <div class="page-header">
      <h2>会话详情 #{{ session?.id }}</h2>
      <el-space>
        <el-button type="primary" @click="recalculate">
          <el-icon><Refresh /></el-icon> 重算状态
        </el-button>
        <el-button @click="$router.back()">返回</el-button>
      </el-space>
    </div>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="info-card">
          <template #header>基本信息</template>
          <div class="info-item">
            <label>State:</label>
            <span class="mono">{{ session?.state }}</span>
          </div>
          <div class="info-item">
            <label>Client ID:</label>
            <span class="mono">{{ session?.client_id || '-' }}</span>
          </div>
          <div class="info-item">
            <label>状态:</label>
            <el-tag :type="getStatusType(session?.status)">{{ session?.status }}</el-tag>
          </div>
          <div class="info-item">
            <label>路径:</label>
            <el-tag :type="getPathType(session?.status_path)">{{ getPathLabel(session?.status_path) }}</el-tag>
          </div>
          <div class="info-item" v-if="session?.error_message">
            <label>错误:</label>
            <span class="error-text">{{ session?.error_message }}</span>
          </div>
          <div class="info-item">
            <label>创建时间:</label>
            <span>{{ formatDate(session?.created_at) }}</span>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card class="timeline-card">
          <template #header>调试时间线</template>
          <el-timeline>
            <el-timeline-item
              v-for="event in session?.timeline_events || []"
              :key="event.id"
              :timestamp="formatDate(event.timestamp)"
              :type="getTimelineType(event.status)"
              :color="getTimelineColor(event.path)"
            >
              <h4>{{ event.title }}</h4>
              <p>{{ event.description }}</p>
              <el-tag size="small" :type="getPathType(event.path)">
                {{ getPathLabel(event.path) }} 路径
              </el-tag>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>回调记录 ({{ session?.callbacks?.length || 0 }})</template>
          <el-table :data="session?.callbacks || []" size="small" stripe>
            <el-table-column prop="state" label="State" width="120" show-overflow-tooltip />
            <el-table-column prop="code" label="Code" width="120" show-overflow-tooltip />
            <el-table-column prop="error" label="Error" width="120" />
            <el-table-column prop="received_at" label="时间" width="160">
              <template #default="{ row }">{{ formatDate(row.received_at) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>Token交换 ({{ session?.token_exchanges?.length || 0 }})</template>
          <el-table :data="session?.token_exchanges || []" size="small" stripe>
            <el-table-column prop="grant_type" label="Grant Type" width="100" />
            <el-table-column prop="success" label="成功" width="80">
              <template #default="{ row }">
                <el-icon :color="row.success ? '#67c23a' : '#f56c6c'">
                  <component :is="row.success ? 'Check' : 'Close'" />
                </el-icon>
              </template>
            </el-table-column>
            <el-table-column prop="error" label="错误" show-overflow-tooltip />
            <el-table-column prop="requested_at" label="时间" width="160">
              <template #default="{ row }">{{ formatDate(row.requested_at) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px">
      <template #header>模拟Token交换</template>
      <el-form :inline="true" :model="tokenForm" label-width="80px">
        <el-form-item label="Code">
          <el-input v-model="tokenForm.code" placeholder="授权码" />
        </el-form-item>
        <el-form-item label="Grant Type">
          <el-select v-model="tokenForm.grant_type" style="width: 150px">
            <el-option label="authorization_code" value="authorization_code" />
            <el-option label="refresh_token" value="refresh_token" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="tokenResult.success" style="width: 120px">
            <el-option :label="'成功'" :value="true" />
            <el-option :label="'失败'" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="simulateTokenExchange">执行模拟</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { Refresh, Check, Close } from '@element-plus/icons-vue'

const route = useRoute()
const session = ref(null)
const tokenForm = ref({
  code: 'test_code',
  grant_type: 'authorization_code'
})
const tokenResult = ref({ success: true })

const loadSession = async () => {
  try {
    const res = await api.getSession(route.params.id)
    session.value = res.data
  } catch (e) {
    ElMessage.error('加载会话失败')
  }
}

const recalculate = async () => {
  try {
    const res = await api.recalculateSession(route.params.id)
    session.value = res.data
    ElMessage.success('状态重算成功')
  } catch (e) {
    ElMessage.error('重算失败')
  }
}

const simulateTokenExchange = async () => {
  try {
    const exchangeRes = await api.createTokenExchange({
      state: session.value.state,
      code: tokenForm.value.code,
      grant_type: tokenForm.value.grant_type
    })
    
    await api.updateTokenExchange(exchangeRes.data.id, {
      success: tokenResult.value.success,
      access_token: tokenResult.value.success ? 'mock_token_' + Date.now() : undefined,
      error: tokenResult.value.success ? undefined : 'simulated_error',
      error_description: tokenResult.value.success ? undefined : '模拟的Token交换错误',
      completed_at: new Date().toISOString()
    })
    
    ElMessage.success('Token交换模拟完成')
    loadSession()
  } catch (e) {
    ElMessage.error('模拟失败')
  }
}

const getStatusType = (status) => {
  const map = { completed: 'success', failed: 'danger', callback_received: 'warning' }
  return map[status] || 'info'
}

const getPathType = (path) => {
  const map = { success: 'success', blocked: 'danger', compensation: 'warning', review: 'info' }
  return map[path] || 'info'
}

const getPathLabel = (path) => {
  const map = { success: '成功', blocked: '拦截', compensation: '补偿', review: '复核', pending: '待处理' }
  return map[path] || path
}

const getTimelineType = (status) => {
  const map = { completed: 'success', failed: 'danger', processing: 'warning' }
  return map[status] || 'primary'
}

const getTimelineColor = (path) => {
  const map = { success: '#67c23a', blocked: '#f56c6c', compensation: '#e6a23c', review: '#909399' }
  return map[path] || '#409eff'
}

const formatDate = (dateStr) => {
  return dateStr ? new Date(dateStr).toLocaleString('zh-CN') : '-'
}

onMounted(() => {
  loadSession()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  color: #303133;
}

.info-item {
  margin-bottom: 16px;
}

.info-item label {
  display: block;
  font-weight: 500;
  color: #606266;
  margin-bottom: 4px;
}

.mono {
  font-family: monospace;
  word-break: break-all;
}

.error-text {
  color: #f56c6c;
  word-break: break-all;
}

.timeline-card h4 {
  margin: 0 0 8px 0;
  color: #303133;
}

.timeline-card p {
  margin: 0 0 8px 0;
  color: #606266;
}
</style>
