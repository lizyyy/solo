<template>
  <div class="detail-container">
    <div class="back-bar">
      <button class="btn-link" @click="goBack">&larr; 返回列表</button>
    </div>

    <div class="detail-card" v-if="subscription">
      <div class="card-header">
        <h2>订阅规则详情</h2>
        <span :class="['status-badge', subscription.status]">{{ getStatusText(subscription.status) }}</span>
      </div>

      <div class="card-body">
        <div class="info-grid">
          <div class="info-item">
            <label>应用名称</label>
            <div>{{ subscription.app_name }}</div>
          </div>
          <div class="info-item">
            <label>事件类型</label>
            <div>{{ subscription.event_name }} ({{ subscription.event_code }})</div>
          </div>
          <div class="info-item">
            <label>版本</label>
            <div>v{{ subscription.version }}</div>
          </div>
          <div class="info-item">
            <label>投递地址</label>
            <div>{{ subscription.delivery_endpoint || '-' }}</div>
          </div>
          <div class="info-item">
            <label>创建时间</label>
            <div>{{ formatDate(subscription.created_at) }}</div>
          </div>
          <div class="info-item">
            <label>复核时间</label>
            <div>{{ formatDate(subscription.reviewed_at) }}</div>
          </div>
        </div>

        <div class="section" v-if="subscription.snapshot_before || subscription.snapshot_after">
          <h3>复核前后变化对比</h3>
          <div class="snapshot-compare">
            <div class="snapshot-col before">
              <h4>复核前</h4>
              <pre>{{ JSON.stringify(subscription.snapshot_before, null, 2) }}</pre>
            </div>
            <div class="snapshot-arrow">&rarr;</div>
            <div class="snapshot-col after">
              <h4>复核后</h4>
              <pre>{{ JSON.stringify(subscription.snapshot_after, null, 2) }}</pre>
            </div>
          </div>
        </div>

        <div class="section" v-if="subscription.filter_conditions && subscription.filter_conditions.length > 0">
          <h3>过滤条件</h3>
          <table class="filter-table">
            <thead>
              <tr>
                <th>字段</th>
                <th>操作符</th>
                <th>值</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fc in subscription.filter_conditions" :key="fc.id">
                <td>{{ fc.field_name }}</td>
                <td>{{ fc.operator }}</td>
                <td>{{ fc.field_value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="action-section" v-if="subscription.status === 'pending'">
          <h3>复核操作</h3>
          <div class="review-form">
            <div class="form-group">
              <label>操作人</label>
              <input type="text" v-model="reviewData.reviewed_by" placeholder="请输入操作人姓名" />
            </div>
            <div class="form-group">
              <label>备注</label>
              <textarea v-model="reviewData.comment" placeholder="复核备注（可选）"></textarea>
            </div>
            <div class="action-buttons">
              <button class="btn btn-success" @click="doReview('approve')">通过</button>
              <button class="btn btn-danger" @click="doReview('reject')">拒绝</button>
            </div>
          </div>
        </div>

        <div class="action-section" v-if="subscription.status === 'active'">
          <h3>退订操作</h3>
          <div class="review-form">
            <div class="form-group">
              <label>退订原因</label>
              <textarea v-model="unsubscribeData.reason" placeholder="请输入退订原因"></textarea>
            </div>
            <div class="form-group">
              <label>操作人</label>
              <input type="text" v-model="unsubscribeData.operated_by" placeholder="请输入操作人姓名" />
            </div>
            <div class="action-buttons">
              <button class="btn btn-danger" @click="doUnsubscribe">执行退订</button>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>投递记录</h3>
          <div class="records-table">
            <table class="data-table">
              <thead>
                <tr>
                  <th>状态</th>
                  <th>HTTP状态</th>
                  <th>错误信息</th>
                  <th>重试次数</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in deliveryRecords" :key="record.id">
                  <td><span :class="['status-badge', record.status]">{{ record.status }}</span></td>
                  <td>{{ record.http_status || '-' }}</td>
                  <td>{{ record.error_message || '-' }}</td>
                  <td>{{ record.retry_attempt || 0 }}</td>
                  <td>{{ formatDate(record.created_at) }}</td>
                </tr>
                <tr v-if="deliveryRecords.length === 0">
                  <td colspan="5" class="empty-state">暂无投递记录</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="loading" v-else>加载中...</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const subscription = ref(null);
const deliveryRecords = ref([]);
const reviewData = ref({ reviewed_by: '', comment: '' });
const unsubscribeData = ref({ reason: '', operated_by: '' });

const loadDetail = async () => {
  try {
    const res = await axios.get(`/api/subscriptions/${route.params.id}`);
    subscription.value = res.data;
  } catch (err) {
    alert('加载失败: ' + (err.response?.data?.error || err.message));
  }
};

const loadDeliveryRecords = async () => {
  try {
    const res = await axios.get('/api/delivery-records', {
      params: { subscription_id: route.params.id, limit: 20 }
    });
    deliveryRecords.value = res.data.data;
  } catch (err) {
    console.error('加载投递记录失败');
  }
};

const doReview = async (action) => {
  if (!reviewData.value.reviewed_by) {
    alert('请输入操作人');
    return;
  }
  try {
    await axios.post(`/api/subscriptions/${route.params.id}/review`, {
      action,
      reviewed_by: reviewData.value.reviewed_by,
      comment: reviewData.value.comment
    });
    alert(`复核${action === 'approve' ? '通过' : '拒绝'}成功`);
    loadDetail();
  } catch (err) {
    alert('操作失败: ' + (err.response?.data?.error || err.message));
  }
};

const doUnsubscribe = async () => {
  if (!unsubscribeData.value.reason) {
    alert('请输入退订原因');
    return;
  }
  try {
    await axios.post(`/api/subscriptions/${route.params.id}/unsubscribe`, unsubscribeData.value);
    alert('退订成功');
    loadDetail();
  } catch (err) {
    alert('退订失败: ' + (err.response?.data?.error || err.message));
  }
};

const goBack = () => {
  router.push('/');
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
  loadDetail();
  loadDeliveryRecords();
});
</script>

<style scoped>
.back-bar {
  margin-bottom: 16px;
}

.detail-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
}

.card-header h2 {
  font-size: 20px;
  color: #1f2937;
}

.card-body {
  padding: 24px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.info-item label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.info-item div {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.section h3 {
  font-size: 16px;
  color: #1f2937;
  margin-bottom: 16px;
}

.snapshot-compare {
  display: flex;
  gap: 16px;
  align-items: center;
}

.snapshot-col {
  flex: 1;
  background: #f7fafc;
  border-radius: 8px;
  padding: 16px;
}

.snapshot-col.before {
  border-left: 4px solid #f59e0b;
}

.snapshot-col.after {
  border-left: 4px solid #10b981;
}

.snapshot-col h4 {
  font-size: 14px;
  margin-bottom: 12px;
  color: #374151;
}

.snapshot-col pre {
  font-size: 12px;
  white-space: pre-wrap;
  color: #4b5563;
  max-height: 200px;
  overflow-y: auto;
}

.snapshot-arrow {
  font-size: 24px;
  color: #9ca3af;
}

.filter-table, .data-table {
  width: 100%;
  border-collapse: collapse;
}

.filter-table th, .filter-table td,
.data-table th, .data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.filter-table th, .data-table th {
  background: #f7fafc;
  font-weight: 600;
  color: #4a5568;
  font-size: 13px;
}

.action-section {
  margin-top: 32px;
  padding: 24px;
  background: #f0fdf4;
  border-radius: 8px;
  border: 1px solid #86efac;
}

.action-section h3 {
  margin-bottom: 16px;
  color: #166534;
}

.review-form {
  max-width: 500px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.form-group input, .form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  padding: 4px 0;
  font-size: 14px;
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
.status-badge.success { background: #d1fae5; color: #059669; }
.status-badge.failed { background: #fee2e2; color: #dc2626; }

.empty-state {
  text-align: center;
  padding: 32px !important;
  color: #9ca3af;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}

.records-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}
</style>
