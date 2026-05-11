<template>
  <div class="pending-requests">
    <div class="header">
      <h1>待提交请求</h1>
      <p class="subtitle">断网或网络异常时，失败的请求会保存在本地。网络恢复后可在此重新提交。</p>
      <p class="notice">⚠️ 注意：修改类请求（PUT/DELETE）不会自动恢复，请刷新页面获取最新数据后手动操作。</p>
    </div>

    <div class="actions">
      <button class="btn btn-primary" @click="recoverAll" :disabled="pendingCount === 0 || recovering">
        {{ recovering ? '提交中...' : '一键恢复全部' }}
      </button>
      <button class="btn btn-secondary" @click="clearAll" :disabled="pendingCount === 0">
        清空全部
      </button>
    </div>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>

    <div v-if="pendingCount === 0" class="empty">
      <p>暂无待提交请求</p>
      <p class="hint">网络正常时操作会自动完成，无需手动恢复</p>
    </div>

    <div v-else class="requests-list">
      <div v-for="(info, requestId) in pendingRequests" :key="requestId" class="request-card">
        <div class="request-header">
          <span class="method" :class="info.method.toLowerCase()">{{ info.method }}</span>
          <span class="url">{{ info.url }}</span>
        </div>
        <div class="request-meta">
          <span class="request-id">{{ requestId }}</span>
          <span class="time">{{ formatTime(info.timestamp) }}</span>
        </div>
        <div v-if="info.data" class="request-data">
          <details>
            <summary>请求数据 ({{ Object.keys(info.data).length }} 字段)</summary>
            <pre>{{ JSON.stringify(info.data, null, 2) }}</pre>
          </details>
        </div>
        <div class="request-actions">
          <button class="btn btn-sm btn-primary" @click="recoverSingle(requestId)" :disabled="recovering">
            重新提交
          </button>
          <button class="btn btn-sm btn-secondary" @click="removeSingle(requestId)">
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { getPendingRequests, removePendingRequest, recoverPendingRequests, getPendingRequestCount } from '../utils/api.js';

const pendingRequests = ref({});
const pendingCount = ref(0);
const recovering = ref(false);
const message = ref('');
const messageType = ref('info');

let checkInterval = null;

function refreshPending() {
  pendingRequests.value = getPendingRequests();
  pendingCount.value = getPendingRequestCount();
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
}

function showMessage(msg, type = 'info') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

async function recoverAll() {
  if (recovering.value || pendingCount.value === 0) return;
  
  recovering.value = true;
  try {
    const results = await recoverPendingRequests();
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    refreshPending();
    if (failed === 0) {
      showMessage(`成功恢复 ${success} 个请求`, 'success');
    } else {
      showMessage(`恢复完成：成功 ${success} 个，失败 ${failed} 个`, 'warning');
    }
  } catch (error) {
    showMessage('恢复失败：' + error.message, 'error');
  } finally {
    recovering.value = false;
  }
}

async function recoverSingle(requestId) {
  if (recovering.value) return;
  
  recovering.value = true;
  try {
    const results = await recoverPendingRequests();
    const thisResult = results.find(r => r.requestId === requestId);
    refreshPending();
    if (thisResult && thisResult.success) {
      showMessage('提交成功', 'success');
    } else {
      showMessage('提交失败，请检查网络后重试', 'error');
    }
  } catch (error) {
    showMessage('提交失败：' + error.message, 'error');
  } finally {
    recovering.value = false;
  }
}

function removeSingle(requestId) {
  removePendingRequest(requestId);
  refreshPending();
  showMessage('已删除', 'info');
}

function clearAll() {
  if (!confirm('确定要清空所有待提交请求吗？未提交的数据将丢失。')) return;
  
  const pending = getPendingRequests();
  for (const key in pending) {
    removePendingRequest(key);
  }
  refreshPending();
  showMessage('已清空全部待提交请求', 'info');
}

onMounted(() => {
  refreshPending();
  checkInterval = setInterval(refreshPending, 3000);
});

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
});
</script>

<style scoped>
.pending-requests {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  margin-bottom: 24px;
}

.subtitle {
  color: #666;
  font-size: 14px;
  margin-top: 8px;
}

.notice {
  color: #b45309;
  font-size: 13px;
  margin-top: 8px;
  padding: 8px 12px;
  background: #fffbeb;
  border-radius: 4px;
  display: inline-block;
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.message {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.message.success {
  background: #d4edda;
  color: #155724;
}

.message.warning {
  background: #fff3cd;
  color: #856404;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
}

.message.info {
  background: #e2e3e5;
  color: #383d41;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty .hint {
  font-size: 14px;
  margin-top: 8px;
  color: #999;
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.request-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.method {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  font-family: monospace;
}

.method.post {
  background: #d1fae5;
  color: #065f46;
}

.method.put {
  background: #dbeafe;
  color: #1e40af;
}

.method.delete {
  background: #fee2e2;
  color: #991b1b;
}

.url {
  font-family: monospace;
  font-size: 14px;
  color: #374151;
  word-break: break-all;
}

.request-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 12px;
}

.request-id {
  font-family: monospace;
}

.request-data {
  margin-bottom: 12px;
}

.request-data details {
  font-size: 13px;
}

.request-data summary {
  cursor: pointer;
  color: #6b7280;
  user-select: none;
}

.request-data pre {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  margin-top: 8px;
}

.request-actions {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #d1d5db;
}
</style>
