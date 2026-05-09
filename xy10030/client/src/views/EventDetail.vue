<template>
  <div class="page">
    <div class="page-header">
      <button class="btn btn-link" @click="router.back()">← 返回</button>
      <h2>活动详情</h2>
      <button class="btn btn-link" @click="loadHistory">查看历史</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!event" class="empty">活动不存在</div>
    <div v-else>
      <div class="event-detail-card">
        <div class="event-header">
          <h2 class="event-title">{{ event.title }}</h2>
          <span :class="['status-badge', 'status-' + event.status]">
            {{ statusText(event.status) }}
          </span>
        </div>
        <p class="event-desc">{{ event.description || '暂无描述' }}</p>
        <div class="event-info-grid">
          <div class="info-item">
            <span class="info-label">开始时间</span>
            <span class="info-value">{{ formatDateTime(event.start_time) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">结束时间</span>
            <span class="info-value">{{ formatDateTime(event.end_time) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">活动地点</span>
            <span class="info-value">{{ event.location }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">报名情况</span>
            <span class="info-value">{{ event.current_count }}/{{ event.capacity || '不限' }}</span>
          </div>
        </div>

        <div v-if="event.status === 'published'" class="registration-section">
          <h3>我要报名</h3>
          <div class="registration-form">
            <div class="form-row">
              <div class="form-group">
                <label>姓名 *</label>
                <input type="text" v-model="regForm.name" placeholder="请输入姓名" />
              </div>
              <div class="form-group">
                <label>手机号 *</label>
                <input type="tel" v-model="regForm.phone" placeholder="请输入手机号" maxlength="11" />
              </div>
            </div>
            <div class="form-group">
              <label>邮箱</label>
              <input type="email" v-model="regForm.email" placeholder="请输入邮箱（选填）" />
            </div>
            <button 
              class="btn btn-primary" 
              :disabled="regSubmitting || !canRegister" 
              @click="handleRegister"
            >
              {{ regSubmitting ? '提交中...' : (canRegister ? '确认报名' : '报名已截止/已满员') }}
            </button>
          </div>
        </div>
      </div>

      <div class="registrations-section">
        <div class="section-header">
          <h3>报名列表 ({{ registrations.length }}人)</h3>
          <div class="filters">
            <select v-model="regFilters.status" @change="loadRegistrations">
              <option value="">全部状态</option>
              <option value="confirmed">已确认</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>

        <div v-if="regLoading" class="loading">加载中...</div>
        <div v-else-if="registrations.length === 0" class="empty">暂无报名记录</div>
        <div v-else class="registration-list">
          <div v-for="reg in registrations" :key="reg.id" class="registration-item">
            <div class="reg-info">
              <span class="reg-name">{{ reg.name }}</span>
              <span class="reg-phone">{{ reg.phone }}</span>
              <span v-if="reg.email" class="reg-email">{{ reg.email }}</span>
              <span :class="['reg-status', 'status-' + reg.status]">{{ regStatusText(reg.status) }}</span>
            </div>
            <div class="reg-actions">
              <button class="btn btn-link" @click="viewRegHistory(reg)">历史</button>
              <button 
                v-if="reg.status !== 'cancelled'" 
                class="btn btn-link" 
                @click="editRegistration(reg)"
              >编辑</button>
              <button 
                v-if="reg.status !== 'cancelled'" 
                class="btn btn-danger btn-link" 
                @click="handleCancelReg(reg)"
              >取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditRegModal" class="modal-overlay" @click.self="closeEditRegModal">
      <div class="modal">
        <div class="modal-header">
          <h3>编辑报名信息</h3>
          <button class="btn-close" @click="closeEditRegModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>姓名 *</label>
            <input type="text" v-model="editRegForm.name" placeholder="请输入姓名" />
          </div>
          <div class="form-group">
            <label>手机号 *</label>
            <input type="tel" v-model="editRegForm.phone" placeholder="请输入手机号" maxlength="11" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" v-model="editRegForm.email" placeholder="请输入邮箱（选填）" />
          </div>
          <div class="form-group">
            <label>修改原因</label>
            <input type="text" v-model="editRegForm.reason" placeholder="请输入修改原因（可选）" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeEditRegModal">取消</button>
          <button class="btn btn-primary" :disabled="regSubmitting" @click="handleUpdateReg">
            {{ regSubmitting ? '提交中...' : '确认修改' }}
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getEventById, getEventRegistrations, getEventHistory } from '../api/events';
import { createRegistration, updateRegistration, cancelRegistration, getRegistrationHistory } from '../api/registrations';

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const regLoading = ref(false);
const historyLoading = ref(false);
const regSubmitting = ref(false);

const event = ref(null);
const registrations = ref([]);
const history = ref([]);

const showEditRegModal = ref(false);
const showHistoryModal = ref(false);
const editingReg = ref(null);
const historyEntityType = ref('event');

const regFilters = reactive({
  status: ''
});

const regForm = reactive({
  name: '',
  phone: '',
  email: ''
});

const editRegForm = reactive({
  name: '',
  phone: '',
  email: '',
  reason: ''
});

const canRegister = computed(() => {
  if (!event.value) return false;
  if (event.value.status !== 'published') return false;
  if (event.value.capacity > 0 && event.value.current_count >= event.value.capacity) return false;
  const now = new Date();
  const startTime = new Date(event.value.start_time);
  if (now > startTime) return false;
  return true;
});

function statusText(status) {
  const map = { draft: '草稿', published: '已发布', cancelled: '已取消', completed: '已完成' };
  return map[status] || status;
}

function regStatusText(status) {
  const map = { confirmed: '已确认', cancelled: '已取消' };
  return map[status] || status;
}

function actionText(action) {
  const map = { create: '创建', update: '更新', cancel: '取消', delete: '删除', retry: '重试', confirm: '确认' };
  return map[action] || action;
}

function formatDateTime(dateTime) {
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleString('zh-CN');
}

async function loadEvent() {
  loading.value = true;
  try {
    const result = await getEventById(route.params.id);
    event.value = result.data;
  } catch (error) {
    alert('加载活动详情失败：' + error.message);
  } finally {
    loading.value = false;
  }
}

async function loadRegistrations() {
  regLoading.value = true;
  try {
    const result = await getEventRegistrations(route.params.id, {
      status: regFilters.status || undefined
    });
    registrations.value = result.data.registrations;
  } catch (error) {
    alert('加载报名列表失败：' + error.message);
  } finally {
    regLoading.value = false;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    const result = historyEntityType.value === 'event' 
      ? await getEventHistory(route.params.id)
      : await getRegistrationHistory(editingReg.value?.id);
    history.value = result.data.logs;
    showHistoryModal.value = true;
  } catch (error) {
    alert('加载历史记录失败：' + error.message);
  } finally {
    historyLoading.value = false;
  }
}

async function handleRegister() {
  if (!regForm.name || !regForm.phone) {
    alert('请填写姓名和手机号');
    return;
  }
  
  if (!/^1[3-9]\d{9}$/.test(regForm.phone)) {
    alert('请输入正确的手机号');
    return;
  }
  
  regSubmitting.value = true;
  try {
    await createRegistration(event.value.id, { ...regForm });
    alert('报名成功！');
    Object.assign(regForm, { name: '', phone: '', email: '' });
    loadEvent();
    loadRegistrations();
  } catch (error) {
    if (error.code === 'CONCURRENCY_ERROR') {
      alert('活动状态已变更，请刷新页面后重试');
    } else {
      alert('报名失败：' + error.message);
    }
  } finally {
    regSubmitting.value = false;
  }
}

function editRegistration(reg) {
  editingReg.value = reg;
  Object.assign(editRegForm, {
    name: reg.name,
    phone: reg.phone,
    email: reg.email || '',
    reason: ''
  });
  showEditRegModal.value = true;
}

function viewRegHistory(reg) {
  editingReg.value = reg;
  historyEntityType.value = 'registration';
  loadHistory();
}

function closeEditRegModal() {
  showEditRegModal.value = false;
  editingReg.value = null;
}

async function handleUpdateReg() {
  if (!editRegForm.name || !editRegForm.phone) {
    alert('请填写必填项');
    return;
  }
  
  regSubmitting.value = true;
  try {
    await updateRegistration(editingReg.value.id, {
      ...editRegForm,
      version: editingReg.value.version
    });
    alert('修改成功');
    closeEditRegModal();
    loadRegistrations();
  } catch (error) {
    if (error.code === 'CONCURRENCY_ERROR') {
      alert('数据已被他人修改，请刷新后重试');
      loadRegistrations();
    } else {
      alert('修改失败：' + error.message);
    }
  } finally {
    regSubmitting.value = false;
  }
}

async function handleCancelReg(reg) {
  const reason = prompt('请输入取消原因（可选）：');
  if (reason === null) return;
  
  try {
    await cancelRegistration(reg.id, reg.version, reason);
    alert('取消成功');
    loadEvent();
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
  loadEvent();
  loadRegistrations();
});
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.event-detail-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.event-title {
  margin: 0;
  font-size: 24px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-draft { background: #f0f0f0; color: #666; }
.status-published { background: #e6f7ff; color: #1890ff; }
.status-cancelled { background: #fff2f0; color: #ff4d4f; }
.status-completed { background: #f6ffed; color: #52c41a; }

.event-desc {
  color: #666;
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 24px;
}

.event-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  color: #999;
  font-size: 12px;
}

.info-value {
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.registration-section {
  border-top: 1px solid #f0f0f0;
  padding-top: 24px;
}

.registration-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
}

.registration-form {
  background: #fafafa;
  padding: 20px;
  border-radius: 8px;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
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

.registrations-section {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
}

.filters select {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.registration-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.registration-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
}

.reg-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.reg-name {
  font-weight: 500;
  color: #333;
}

.reg-phone,
.reg-email {
  color: #666;
  font-size: 14px;
}

.reg-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.reg-status.status-confirmed {
  background: #e6f7ff;
  color: #1890ff;
}

.reg-status.status-cancelled {
  background: #fff2f0;
  color: #ff4d4f;
}

.reg-actions {
  display: flex;
  gap: 16px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #999;
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

.modal-header h3 {
  margin: 0;
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
