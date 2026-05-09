<template>
  <div class="page">
    <div class="page-header">
      <h2>操作日志</h2>
      <button class="btn btn-primary" @click="exportLogs">导出CSV</button>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>实体类型：</label>
        <select v-model="filters.entityType" @change="loadLogs">
          <option value="">全部</option>
          <option value="event">活动</option>
          <option value="registration">报名</option>
          <option value="task">任务</option>
        </select>
      </div>
      <div class="filter-group">
        <label>操作类型：</label>
        <select v-model="filters.action" @change="loadLogs">
          <option value="">全部</option>
          <option value="create">创建</option>
          <option value="update">更新</option>
          <option value="cancel">取消</option>
          <option value="delete">删除</option>
          <option value="retry">重试</option>
        </select>
      </div>
      <div class="filter-group">
        <label>状态：</label>
        <select v-model="filters.status" @change="loadLogs">
          <option value="">全部</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="logs.length === 0" class="empty">暂无操作记录</div>
    <div v-else class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>实体类型</th>
            <th>操作类型</th>
            <th>状态</th>
            <th>原因</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ formatDateTime(log.created_at) }}</td>
            <td>{{ entityTypeText(log.entity_type) }}</td>
            <td>{{ actionText(log.action) }}</td>
            <td>
              <span :class="['status-badge', 'status-' + log.status]">
                {{ log.status === 'success' ? '成功' : '失败' }}
              </span>
            </td>
            <td>{{ log.reason || '-' }}</td>
            <td>
              <button class="btn btn-link btn-sm" @click="viewDetail(log)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>日志详情</h3>
          <button class="btn-close" @click="showDetailModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">日志ID</span>
              <span class="detail-value">{{ selectedLog?.id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">实体类型</span>
              <span class="detail-value">{{ entityTypeText(selectedLog?.entity_type) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">实体ID</span>
              <span class="detail-value">{{ selectedLog?.entity_id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">操作类型</span>
              <span class="detail-value">{{ actionText(selectedLog?.action) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">请求ID</span>
              <span class="detail-value">{{ selectedLog?.request_id || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">操作时间</span>
              <span class="detail-value">{{ formatDateTime(selectedLog?.created_at) }}</span>
            </div>
          </div>
          <div v-if="selectedLog?.reason" class="detail-section">
            <h4>操作原因</h4>
            <p>{{ selectedLog.reason }}</p>
          </div>
          <div class="detail-section">
            <h4>变更内容</h4>
            <div v-if="selectedLog?.old_data" class="compare-view">
              <div class="compare-item">
                <h5>变更前</h5>
                <pre>{{ JSON.stringify(selectedLog.old_data, null, 2) }}</pre>
              </div>
              <div class="compare-item">
                <h5>变更后</h5>
                <pre>{{ JSON.stringify(selectedLog.new_data, null, 2) }}</pre>
              </div>
            </div>
            <div v-else class="empty">
              {{ selectedLog?.new_data ? '创建操作' : '无变更数据' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getLogsReport, downloadCSV } from '../api/reports';

const loading = ref(false);
const logs = ref([]);
const showDetailModal = ref(false);
const selectedLog = ref(null);

const filters = reactive({
  entityType: '',
  action: '',
  status: ''
});

function entityTypeText(type) {
  const map = { event: '活动', registration: '报名', task: '任务' };
  return map[type] || type;
}

function actionText(action) {
  const map = { create: '创建', update: '更新', cancel: '取消', delete: '删除', retry: '重试', confirm: '确认' };
  return map[action] || action;
}

function formatDateTime(dateTime) {
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleString('zh-CN');
}

async function loadLogs() {
  loading.value = true;
  try {
    const params = {};
    if (filters.entityType) params.entityType = filters.entityType;
    if (filters.action) params.action = filters.action;
    if (filters.status) params.status = filters.status;
    
    const result = await getLogsReport(params, 'json');
    logs.value = result.data;
  } catch (error) {
    alert('加载失败：' + error.message);
  } finally {
    loading.value = false;
  }
}

function viewDetail(log) {
  selectedLog.value = log;
  showDetailModal.value = true;
}

function exportLogs() {
  const params = new URLSearchParams();
  if (filters.entityType) params.append('entityType', filters.entityType);
  if (filters.action) params.append('action', filters.action);
  if (filters.status) params.append('status', filters.status);
  params.append('format', 'csv');
  
  const url = '/api/reports/logs?' + params.toString();
  downloadCSV(url, `logs_${Date.now()}.csv`);
}

onMounted(() => {
  loadLogs();
});
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
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

.btn-primary:hover {
  background: #40a9ff;
}

.btn-link {
  background: none;
  padding: 0;
  color: #1890ff;
  text-decoration: underline;
}

.table-wrapper {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table thead {
  background: #fafafa;
}

.table th,
.table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

.table th {
  font-weight: 600;
  color: #333;
}

.table td {
  color: #666;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-success {
  background: #f6ffed;
  color: #52c41a;
}

.status-failed {
  background: #fff2f0;
  color: #ff4d4f;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #999;
  background: #fff;
  border-radius: 8px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 8px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
}

.modal-large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  line-height: 1;
}

.modal-body {
  padding: 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #999;
}

.detail-value {
  font-size: 14px;
  color: #333;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #333;
}

.detail-section p {
  margin: 0;
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 14px;
  color: #666;
}

.compare-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.compare-item h5 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #666;
}

.compare-item pre {
  background: #fafafa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}
</style>
