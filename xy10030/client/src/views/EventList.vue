<template>
  <div class="page">
    <div class="page-header">
      <h2>活动列表</h2>
      <button class="btn btn-primary" @click="showCreateModal = true">
        创建活动
      </button>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>状态：</label>
        <select v-model="filters.status" @change="loadEvents">
          <option value="">全部</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="cancelled">已取消</option>
          <option value="completed">已完成</option>
        </select>
      </div>
      <div class="filter-group">
        <input 
          type="text" 
          v-model="filters.search" 
          placeholder="搜索活动标题或地点..." 
          @input="loadEvents"
        />
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="events.length === 0" class="empty">
      暂无活动数据
    </div>
    <div v-else class="event-list">
      <div v-for="event in events" :key="event.id" class="event-card">
        <div class="event-header">
          <h3 class="event-title">{{ event.title }}</h3>
          <span :class="['status-badge', 'status-' + event.status]">
            {{ statusText(event.status) }}
          </span>
        </div>
        <p class="event-desc">{{ event.description || '暂无描述' }}</p>
        <div class="event-meta">
          <span>📅 {{ formatDateTime(event.start_time) }} - {{ formatDateTime(event.end_time) }}</span>
          <span>📍 {{ event.location }}</span>
          <span>👥 {{ event.current_count }}/{{ event.capacity || '不限' }}</span>
        </div>
        <div class="event-actions">
          <button class="btn btn-link" @click="viewDetail(event)">查看详情</button>
          <button 
            v-if="event.status !== 'cancelled' && event.status !== 'completed'" 
            class="btn btn-link" 
            @click="editEvent(event)"
          >编辑</button>
          <button 
            v-if="event.status === 'published'" 
            class="btn btn-danger btn-link" 
            @click="handleCancel(event)"
          >取消活动</button>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ showCreateModal ? '创建活动' : '编辑活动' }}</h3>
          <button class="btn-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>活动标题 *</label>
            <input type="text" v-model="form.title" placeholder="请输入活动标题" />
          </div>
          <div class="form-group">
            <label>活动描述</label>
            <textarea v-model="form.description" rows="3" placeholder="请输入活动描述"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始时间 *</label>
              <input type="datetime-local" v-model="form.start_time" />
            </div>
            <div class="form-group">
              <label>结束时间 *</label>
              <input type="datetime-local" v-model="form.end_time" />
            </div>
          </div>
          <div class="form-group">
            <label>活动地点 *</label>
            <input type="text" v-model="form.location" placeholder="请输入活动地点" />
          </div>
          <div class="form-group">
            <label>人数容量 (0表示不限)</label>
            <input type="number" v-model.number="form.capacity" min="0" />
          </div>
          <div class="form-group" v-if="showCreateModal">
            <label>活动状态</label>
            <select v-model="form.status">
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeModal">取消</button>
          <button class="btn btn-primary" :disabled="submitting" @click="handleSubmit">
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
                  <div class="history-compare">
                    <div class="history-old">
                      <strong>变更前：</strong>
                      <pre>{{ JSON.stringify(log.old_data, null, 2) }}</pre>
                    </div>
                    <div class="history-new">
                      <strong>变更后：</strong>
                      <pre>{{ JSON.stringify(log.new_data, null, 2) }}</pre>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getEvents, createEvent, updateEvent, cancelEvent } from '../api/events';
const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const events = ref([]);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showHistoryModal = ref(false);
const historyLoading = ref(false);
const history = ref([]);
const editingEvent = ref(null);
const filters = reactive({
 status: '',
 search: ''
});
const defaultForm = {
 title: '',
 description: '',
 start_time: '',
 end_time: '',
 location: '',
 capacity: 0,
 status: 'draft'
};
const form = reactive({ ...defaultForm });
function statusText(status) {
 const map = {
 draft: '草稿',
 published: '已发布',
 cancelled: '已取消',
 completed: '已完成'
 };
 return map[status] || status;
}
function actionText(action) {
 const map = {
 create: '创建',
 update: '更新',
 cancel: '取消',
 delete: '删除',
 retry: '重试',
 confirm: '确认'
 };
 return map[action] || action;
}
function formatDateTime(dateTime) {
 if (!dateTime)
 return '';
 const date = new Date(dateTime);
 return date.toLocaleString('zh-CN', {
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 hour: '2-digit',
 minute: '2-digit'
 });
}
async function loadEvents() {
 loading.value = true;
 try {
 const result = await getEvents({
 status: filters.status || undefined,
 search: filters.search || undefined
 });
 events.value = result.data.events;
 }
 catch (error) {
 alert('加载活动列表失败：' + error.message);
 }
 finally {
 loading.value = false;
 }
}
function viewDetail(event) {
 router.push(`/events/${event.id}`);
}
function editEvent(event) {
 editingEvent.value = event;
 Object.assign(form, {
 title: event.title,
 description: event.description || '',
 start_time: event.start_time?.slice(0, 16) || '',
 end_time: event.end_time?.slice(0, 16) || '',
 location: event.location,
 capacity: event.capacity
 });
 showEditModal.value = true;
}
function closeModal() {
 showCreateModal.value = false;
 showEditModal.value = false;
 editingEvent.value = null;
 Object.assign(form, defaultForm);
}
async function handleSubmit() {
 if (!form.title || !form.start_time || !form.end_time || !form.location) {
 alert('请填写必填项');
 return;
 }
 submitting.value = true;
 try {
 if (showCreateModal.value) {
 await createEvent({
 ...form,
 start_time: new Date(form.start_time).toISOString(),
 end_time: new Date(form.end_time).toISOString()
 });
 alert('创建成功');
 }
 else if (editingEvent.value) {
 await updateEvent(editingEvent.value.id, {
 ...form,
 version: editingEvent.value.version,
 start_time: new Date(form.start_time).toISOString(),
 end_time: new Date(form.end_time).toISOString()
 });
 alert('更新成功');
 }
 closeModal();
 loadEvents();
 }
 catch (error) {
 if (error.code === 'CONCURRENCY_ERROR') {
 alert('数据已被他人修改，请刷新页面后重试');
 loadEvents();
 }
 else {
 alert('操作失败：' + error.message);
 }
 }
 finally {
 submitting.value = false;
 }
}
async function handleCancel(event) {
 const reason = prompt('请输入取消原因（可选）：');
 if (reason === null)
 return;
 try {
 await cancelEvent(event.id, event.version, reason);
 alert('活动已取消');
 loadEvents();
 }
 catch (error) {
 if (error.code === 'CONCURRENCY_ERROR') {
 alert('数据已被他人修改，请刷新页面后重试');
 loadEvents();
 }
 else {
 alert('取消失败：' + error.message);
 }
 }
}
onMounted(() => {
 loadEvents();
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
  font-size: 24px;
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
  transition: border-color 0.3s;
}

.filter-group select:focus,
.filter-group input:focus {
  border-color: #1890ff;
}

.event-list {
  display: grid;
  gap: 16px;
}

.event-card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s;
}

.event-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.event-title {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-draft {
  background: #f0f0f0;
  color: #666;
}

.status-published {
  background: #e6f7ff;
  color: #1890ff;
}

.status-cancelled {
  background: #fff2f0;
  color: #ff4d4f;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.event-desc {
  color: #666;
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.6;
}

.event-meta {
  display: flex;
  gap: 24px;
  color: #999;
  font-size: 14px;
  margin-bottom: 16px;
}

.event-actions {
  display: flex;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
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

.btn-primary:hover {
  background: #40a9ff;
}

.btn-default {
  background: #fff;
  color: #333;
  border: 1px solid #d9d9d9;
}

.btn-default:hover {
  border-color: #1890ff;
  color: #1890ff;
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

.btn-link:hover {
  color: #40a9ff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  max-width: 600px;
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
  font-size: 18px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  line-height: 1;
}

.btn-close:hover {
  color: #333;
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

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: #1890ff;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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

.history-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}

.history-old pre,
.history-new pre {
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  border: 1px solid #eee;
}
</style>
