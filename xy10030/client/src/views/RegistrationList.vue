<template>
  <div class="page">
    <div class="page-header">
      <h2>报名管理</h2>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>状态：</label>
        <select v-model="filters.status" @change="loadRegistrations">
          <option value="">全部</option>
          <option value="confirmed">已确认</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>
      <div class="filter-group">
        <label>手机号：</label>
        <input 
          type="text" 
          v-model="filters.phone" 
          placeholder="输入手机号搜索..." 
          @keyup.enter="loadRegistrations"
        />
        <button class="btn btn-primary btn-sm" @click="loadRegistrations">搜索</button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="registrations.length === 0" class="empty">暂无报名记录</div>
    <div v-else class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>手机号</th>
            <th>邮箱</th>
            <th>状态</th>
            <th>报名时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="reg in registrations" :key="reg.id">
            <td>{{ reg.name }}</td>
            <td>{{ reg.phone }}</td>
            <td>{{ reg.email || '-' }}</td>
            <td>
              <span :class="['status-badge', 'status-' + reg.status]">
                {{ statusText(reg.status) }}
              </span>
            </td>
            <td>{{ formatDateTime(reg.created_at) }}</td>
            <td>
              <button class="btn btn-link btn-sm" @click="viewHistory(reg)">历史</button>
              <button 
                v-if="reg.status !== 'cancelled'" 
                class="btn btn-link btn-sm" 
                @click="editReg(reg)"
              >编辑</button>
              <button 
                v-if="reg.status !== 'cancelled'" 
                class="btn btn-danger btn-link btn-sm" 
                @click="handleCancel(reg)"
              >取消</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal">
        <div class="modal-header">
          <h3>编辑报名信息</h3>
          <button class="btn-close" @click="closeEditModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>姓名 *</label>
            <input type="text" v-model="editForm.name" />
          </div>
          <div class="form-group">
            <label>手机号 *</label>
            <input type="tel" v-model="editForm.phone" maxlength="11" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" v-model="editForm.email" />
          </div>
          <div class="form-group">
            <label>修改原因</label>
            <input type="text" v-model="editForm.reason" placeholder="可选" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" :disabled="submitting" @click="handleUpdate">
            {{ submitting ? '提交中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showHistoryModal" class="modal-overlay" @click.self="showHistoryModal = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>操作历史</h3>
          <button class="btn-close" @click="showHistoryModal = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="historyLoading" class="loading">加载中...</div>
          <div v-else-if="history.length === 0" class="empty">暂无历史记录</div>
          <div v-else class="history-list">
            <div v-for="log in history" :key="log.id" class="history-item">
              <div class="history-header">
                <span class="history-action">{{ actionText(log.action) }}</span>
                <span class="history-time">{{ formatDateTime(log.created_at) }}</span>
              </div>
              <div v-if="log.reason" class="history-reason">原因：{{ log.reason }}</div>
              <div class="history-detail" v-if="log.old_data">
                <details>
                  <summary>查看变更详情</summary>
                  <pre>{{ JSON.stringify(log.old_data, null, 2) }}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getRegistrations, updateRegistration, cancelRegistration, getRegistrationHistory } from '../api/registrations';

const loading = ref(false);
const historyLoading = ref(false);
const submitting = ref(false);

const registrations = ref([]);
const history = ref([]);

const showEditModal = ref(false);
const showHistoryModal = ref(false);
const editingReg = ref(null);

const filters = reactive({
  status: '',
  phone: ''
});

const editForm = reactive({
  name: '',
  phone: '',
  email: '',
  reason: ''
});

function statusText(status) {
  const map = { confirmed: '已确认', cancelled: '已取消' };
  return map[status] || status;
}

function actionText(action) {
  const map = { create: '创建', update: '更新', cancel: '取消', delete: '删除' };
  return map[action] || action;
}

function formatDateTime(dateTime) {
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleString('zh-CN');
}

async function loadRegistrations() {
  loading.value = true;
  try {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.phone.trim()) params.phone = filters.phone.trim();
    
    const result = await getRegistrations(params);
    registrations.value = result.data.registrations;
  } catch (error) {
    alert('加载失败：' + error.message);
  } finally {
    loading.value = false;
  }
}

function editReg(reg) {
  editingReg.value = reg;
  Object.assign(editForm, {
    name: reg.name,
    phone: reg.phone,
    email: reg.email || '',
    reason: ''
  });
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingReg.value = null;
}

async function viewHistory(reg) {
  historyLoading.value = true;
  try {
    const result = await getRegistrationHistory(reg.id);
    history.value = result.data.logs;
    showHistoryModal.value = true;
  } catch (error) {
    alert('加载历史记录失败：' + error.message);
  } finally {
    historyLoading.value = false;
  }
}

async function handleUpdate() {
  if (!editForm.name || !editForm.phone) {
    alert('请填写必填项');
    return;
  }
  
  submitting.value = true;
  try {
    await updateRegistration(editingReg.value.id, {
      ...editForm,
      version: editingReg.value.version
    });
    alert('修改成功');
    closeEditModal();
    loadRegistrations();
  } catch (error) {
    if (error.code === 'CONCURRENCY_ERROR') {
      alert('数据已被他人修改，请刷新后重试');
      loadRegistrations();
    } else {
      alert('修改失败：' + error.message);
    }
  } finally {
    submitting.value = false;
  }
}

async function handleCancel(reg) {
  const reason = prompt('请输入取消原因（可选）：');
  if (reason === null) return;
  
  try {
    await cancelRegistration(reg.id, reg.version, reason);
    alert('取消成功');
    loadRegistrations();
  } catch (error) {
    if (error.code === 'CONCURRENCY_ERROR') {
      alert('数据已被他人修改，请刷新后重试');
      loadRegistrations();
    } else {
      alert('取消失败：' + error.message);
    }
  }
}

onMounted(() => {
  loadRegistrations();
});
</script>

<style scoped>
.page-header {
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

.filter-group select,
.filter-group input {
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.filter-group select:focus,
.filter-group input:focus {
  border-color: #1890ff;
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

.btn-default {
  background: #fff;
  color: #333;
  border: 1px solid #d9d9d9;
}

.btn-danger {
  color: #ff4d4f;
}

.btn-link {
  background: none;
  padding: 0;
  color: #1890ff;
  text-decoration: underline;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.status-confirmed {
  background: #e6f7ff;
  color: #1890ff;
}

.status-cancelled {
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
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
}

.modal-large {
  max-width: 800px;
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
  max-height: 60vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.form-group input:focus {
  border-color: #1890ff;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.history-action {
  font-weight: 500;
  color: #1890ff;
}

.history-time {
  color: #999;
  font-size: 12px;
}

.history-reason {
  color: #666;
  font-size: 13px;
  margin-bottom: 8px;
}

.history-item pre {
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  border: 1px solid #eee;
  margin: 8px 0 0;
}
</style>
