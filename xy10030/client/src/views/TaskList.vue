<template>
  <div class="page">
    <div class="page-header">
      <h2>失败任务管理</h2>
      <div class="header-actions">
        <button class="btn btn-primary" @click="loadTasks">刷新</button>
        <button class="btn btn-primary" @click="handleRetryAll">重试全部待处理</button>
      </div>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>状态：</label>
        <select v-model="filters.status" @change="loadTasks">
          <option value="">全部</option>
          <option value="pending">待处理</option>
          <option value="retrying">重试中</option>
          <option value="completed">已完成</option>
          <option value="failed">已失败</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="tasks.length === 0" class="empty">暂无失败任务</div>
    <div v-else class="task-list">
      <div v-for="task in tasks" :key="task.id" class="task-card">
        <div class="task-header">
          <span class="task-type">{{ taskTypeText(task.task_type) }}</span>
          <span :class="['task-status', 'status-' + task.status]">
            {{ statusText(task.status) }}
          </span>
        </div>
        <div class="task-info">
          <div class="info-row">
            <span class="info-label">重试次数：</span>
            <span>{{ task.retry_count }}/{{ task.max_retries }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">创建时间：</span>
            <span>{{ formatDateTime(task.created_at) }}</span>
          </div>
          <div v-if="task.last_retry_at" class="info-row">
            <span class="info-label">最后重试：</span>
            <span>{{ formatDateTime(task.last_retry_at) }}</span>
          </div>
        </div>
        <div v-if="task.error_message" class="task-error">
          <strong>错误信息：</strong>
          <p>{{ task.error_message }}</p>
        </div>
        <div class="task-data" v-if="task.data">
          <details>
            <summary>查看任务数据</summary>
            <pre>{{ JSON.stringify(task.data, null, 2) }}</pre>
          </details>
        </div>
        <div class="task-actions">
          <button 
            v-if="task.status === 'pending' && task.retry_count < task.max_retries" 
            class="btn btn-primary btn-sm" 
            :disabled="retryingTaskId === task.id"
            @click="handleRetry(task)"
          >
            {{ retryingTaskId === task.id ? '重试中...' : '重试' }}
          </button>
          <button 
            v-if="task.status === 'failed'" 
            class="btn btn-default btn-sm" 
            disabled
          >
            已达到最大重试次数
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getFailedTasks, retryTask, retryAllTasks } from '../api/tasks';

const loading = ref(false);
const retryingTaskId = ref(null);
const tasks = ref([]);

const filters = reactive({
  status: ''
});

function taskTypeText(type) {
  const map = {
    'confirm_registration': '确认报名',
    'cancel_registration': '取消报名'
  };
  return map[type] || type;
}

function statusText(status) {
  const map = {
    pending: '待处理',
    retrying: '重试中',
    completed: '已完成',
    failed: '已失败'
  };
  return map[status] || status;
}

function formatDateTime(dateTime) {
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleString('zh-CN');
}

async function loadTasks() {
  loading.value = true;
  try {
    const params = {};
    if (filters.status) params.status = filters.status;
    
    const result = await getFailedTasks(params);
    tasks.value = result.data.tasks;
  } catch (error) {
    alert('加载失败：' + error.message);
  } finally {
    loading.value = false;
  }
}

async function handleRetry(task) {
  retryingTaskId.value = task.id;
  try {
    const result = await retryTask(task.id);
    if (result.success) {
      alert('重试成功');
    } else {
      alert('重试失败：' + result.message);
    }
    loadTasks();
  } catch (error) {
    alert('重试失败：' + error.message);
  } finally {
    retryingTaskId.value = null;
  }
}

async function handleRetryAll() {
  if (!confirm('确认重试所有待处理任务？')) return;
  
  try {
    const result = await retryAllTasks();
    alert(`批量重试完成：${result.data.success}成功，${result.data.failed}失败`);
    loadTasks();
  } catch (error) {
    alert('批量重试失败：' + error.message);
  }
}

onMounted(() => {
  loadTasks();
});
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  color: #666;
}

.filter-group select {
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.btn-primary {
  background: #1890ff;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
}

.btn-default {
  background: #fff;
  color: #999;
  border: 1px solid #d9d9d9;
  cursor: not-allowed;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.task-list {
  display: grid;
  gap: 16px;
}

.task-card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-type {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.task-status {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: #fffbe6;
  color: #faad14;
}

.status-retrying {
  background: #e6f7ff;
  color: #1890ff;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-failed {
  background: #fff2f0;
  color: #ff4d4f;
}

.task-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.info-row {
  font-size: 14px;
  color: #666;
}

.info-label {
  color: #999;
}

.task-error {
  background: #fff2f0;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #ff4d4f;
}

.task-error p {
  margin: 4px 0 0;
  word-break: break-all;
}

.task-data {
  margin-bottom: 12px;
}

.task-data details {
  font-size: 13px;
}

.task-data pre {
  background: #fafafa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  margin-top: 8px;
}

.task-actions {
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #999;
  background: #fff;
  border-radius: 8px;
}
</style>
