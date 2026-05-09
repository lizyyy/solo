<template>
  <div class="container">
    <div class="page-header">
      <h2>推送详情</h2>
      <el-button @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回列表
      </el-button>
    </div>
    
    <el-card v-loading="loading">
      <template v-if="message">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题" :span="2">
            {{ message.title }}
          </el-descriptions-item>
          <el-descriptions-item label="内容" :span="2">
            <div style="white-space: pre-wrap">{{ message.content }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            {{ pushTypeLabels[message.pushType] || message.pushType }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :class="`status-tag status-${message.status}`" effect="light">
              {{ statusLabels[message.status] || message.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-tag :type="message.priority > 0 ? 'warning' : message.priority < 0 ? 'info' : ''">
              {{ message.priority }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="重试次数">
            {{ message.retryCount }} / {{ message.maxRetries }}
          </el-descriptions-item>
          <el-descriptions-item label="目标用户" v-if="message.targetUsers?.length">
            {{ message.targetUsers.join(', ') }}
          </el-descriptions-item>
          <el-descriptions-item label="定时发送" v-if="message.scheduledAt">
            {{ formatDate(message.scheduledAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="发送结果" v-if="['sent', 'failed', 'partially_failed'].includes(message.status)">
            送达: {{ message.deliveredCount || 0 }} / 失败: {{ message.failedCount || 0 }}
            <template v-if="message.totalRecipients">
              / 总计: {{ message.totalRecipients }}
            </template>
          </el-descriptions-item>
          <el-descriptions-item label="错误信息" v-if="message.errorMessage" :span="2">
            <el-alert
              :title="message.errorMessage"
              type="error"
              show-icon
              :closable="false"
            />
          </el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ typeof message.createdBy === 'object' ? message.createdBy?.username : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            {{ message.version }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(message.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="发送时间" v-if="message.sentAt">
            {{ formatDate(message.sentAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="失败时间" v-if="message.failedAt">
            {{ formatDate(message.failedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDate(message.updatedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="消息ID" :span="2">
            {{ message.idempotencyKey }}
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="action-bar">
          <template v-if="authStore.isOperator">
            <el-button
              v-if="['pending', 'queued'].includes(message.status)"
              type="primary"
              @click="handleEdit"
            >
              编辑
            </el-button>
            <el-button
              v-if="['pending', 'queued'].includes(message.status)"
              type="warning"
              @click="handleCancel"
            >
              取消发送
            </el-button>
            <el-button
              v-if="['failed', 'partially_failed'].includes(message.status) && message.retryCount < message.maxRetries"
              type="success"
              @click="handleRetry"
            >
              重试 ({{ message.retryCount + 1 }}/{{ message.maxRetries }})
            </el-button>
            <el-button type="danger" @click="handleDelete">
              删除
            </el-button>
          </template>
        </div>
      </template>
      
      <template v-else>
        <el-empty description="推送信息不存在" />
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores/auth'
import type { PushMessage } from '@/types'
import {
  getPushMessage,
  cancelPushMessage,
  retryPushMessage,
  deletePushMessage,
} from '@/api/push'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const message = ref<PushMessage | null>(null)

const messageId = computed(() => route.params.id as string)

const statusLabels: Record<string, string> = {
  pending: '待处理',
  queued: '队列中',
  processing: '处理中',
  sent: '已发送',
  failed: '失败',
  partially_failed: '部分失败',
  cancelled: '已取消',
}

const pushTypeLabels: Record<string, string> = {
  broadcast: '广播',
  targeted: '定向',
  system: '系统',
}

function formatDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

async function loadMessage() {
  loading.value = true
  try {
    message.value = await getPushMessage(messageId.value)
  } catch (e) {
    ElMessage.error('加载推送信息失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/push')
}

function handleEdit() {
  router.push(`/push/${messageId.value}/edit`)
}

async function handleCancel() {
  if (!message.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要取消推送 "${message.value.title}" 吗？`,
      '确认取消',
      { type: 'warning' }
    )
    
    await cancelPushMessage(messageId.value)
    ElMessage.success('推送已取消')
    loadMessage()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Failed to cancel:', e)
    }
  }
}

async function handleRetry() {
  if (!message.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要重试推送 "${message.value.title}" 吗？`,
      '确认重试',
      { type: 'warning' }
    )
    
    await retryPushMessage(messageId.value)
    ElMessage.success('重试任务已加入队列')
    loadMessage()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Failed to retry:', e)
    }
  }
}

async function handleDelete() {
  if (!message.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除推送 "${message.value.title}" 吗？此操作不可撤销。`,
      '确认删除',
      { type: 'error' }
    )
    
    await deletePushMessage(messageId.value)
    ElMessage.success('推送已删除')
    router.push('/push')
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Failed to delete:', e)
    }
  }
}

onMounted(() => {
  loadMessage()
})
</script>

<style scoped>
.action-bar {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #ebeef5;
  display: flex;
  gap: 12px;
}
</style>
