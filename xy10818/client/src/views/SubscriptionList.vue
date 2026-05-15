<template>
  <div class="list-container">
    <div class="toolbar">
      <div class="filters">
        <select v-model="filterStatus" @change="loadSubscriptions">
          <option value="">全部状态</option>
          <option value="pending">待复核</option>
          <option value="active">已生效</option>
          <option value="rejected">已拒绝</option>
          <option value="unsubscribed">已退订</option>
        </select>
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="showCreateModal = true">新建订阅</button>
        <button class="btn btn-secondary" @click="exportData">导出数据</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>应用名称</th>
            <th>事件类型</th>
            <th>版本</th>
            <th>状态</th>
            <th>投递地址</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sub in subscriptions" :key="sub.id">
            <td>{{ sub.app_name }}</td>
            <td>{{ sub.event_name }}</td>
            <td>v{{ sub.version }}</td>
            <td><span :class="['status-badge', sub.status]">{{ getStatusText(sub.status) }}</span></td>
            <td class="endpoint">{{ sub.delivery_endpoint || '-' }}</td>
            <td>{{ formatDate(sub.created_at) }}</td>
            <td>
              <button class="btn-link" @click="goToDetail(sub.id)">查看</button>
            </td>
          </tr>
          <tr v-if="subscriptions.length === 0">
            <td colspan="7" class="empty-state">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal" v-if="showCreateModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>新建订阅规则</h3>
          <button class="close-btn" @click="showCreateModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>应用 *</label>
            <select v-model="newSubscription.app_id">
              <option value="">请选择</option>
              <option v-for="app in apps" :key="app.id" :value="app.id">{{ app.app_name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>事件类型 *</label>
            <select v-model="newSubscription.event_type_id">
              <option value="">请选择</option>
              <option v-for="evt in eventTypes" :key="evt.id" :value="evt.id">{{ evt.event_name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>投递地址</label>
            <input type="text" v-model="newSubscription.delivery_endpoint" placeholder="https://..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" @click="createSubscription">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const subscriptions = ref([]);
const apps = ref([]);
const eventTypes = ref([]);
const filterStatus = ref('');
const showCreateModal = ref(false);
const newSubscription = ref({
  app_id: '',
  event_type_id: '',
  delivery_endpoint: ''
});

const loadSubscriptions = async () => {
  try {
    const params = {};
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await axios.get('/api/subscriptions', { params });
    subscriptions.value = res.data.data;
  } catch (err) {
    alert('加载失败: ' + (err.response?.data?.error || err.message));
  }
};

const loadApps = async () => {
  const res = await axios.get('/api/apps');
  apps.value = res.data.data;
};

const loadEventTypes = async () => {
  const res = await axios.get('/api/event-types');
  eventTypes.value = res.data.data;
};

const createSubscription = async () => {
  if (!newSubscription.value.app_id || !newSubscription.value.event_type_id) {
    alert('请选择应用和事件类型');
    return;
  }
  try {
    await axios.post('/api/subscriptions', newSubscription.value);
    showCreateModal.value = false;
    newSubscription.value = { app_id: '', event_type_id: '', delivery_endpoint: '' };
    loadSubscriptions();
    alert('创建成功，等待复核');
  } catch (err) {
    alert('创建失败: ' + (err.response?.data?.error || err.message));
  }
};

const exportData = async () => {
  window.open('/api/subscriptions/export/data?format=csv');
};

const goToDetail = (id) => {
  router.push(`/subscription/${id}`);
};

const getStatusText = (status) => {
  const map = {
    pending: '待复核',
    active: '已生效',
    rejected: '已拒绝',
    unsubscribed: '已退订'
  };
  return map[status] || status;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
};

onMounted(() => {
  loadSubscriptions();
  loadApps();
  loadEventTypes();
});
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.filters select, .form-group select, .form-group input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 150px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 8px;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  padding: 4px 8px;
}

.table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background: #f7fafc;
  font-weight: 600;
  color: #4a5568;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending { background: #fef3c7; color: #d97706; }
.status-badge.active { background: #d1fae5; color: #059669; }
.status-badge.rejected { background: #fee2e2; color: #dc2626; }
.status-badge.unsubscribed { background: #e2e8f0; color: #6b7280; }

.endpoint {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 40px !important;
  color: #9ca3af;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 500px;
  max-width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #9ca3af;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  text-align: right;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #374151;
}

.form-group select, .form-group input {
  width: 100%;
}
</style>
