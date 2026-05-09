<template>
  <div class="page">
    <div class="page-header">
      <h2>数据统计与报告</h2>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">活动总数</div>
          <div class="stat-value">{{ stats?.events?.total || 0 }}</div>
          <div class="stat-detail">
            <span class="text-green">已发布 {{ stats?.events?.published || 0 }}</span>
            <span class="text-red">已取消 {{ stats?.events?.cancelled || 0 }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">报名总数</div>
          <div class="stat-value">{{ stats?.registrations?.total || 0 }}</div>
          <div class="stat-detail">
            <span class="text-blue">已确认 {{ stats?.registrations?.confirmed || 0 }}</span>
            <span class="text-red">已取消 {{ stats?.registrations?.cancelled || 0 }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">失败任务</div>
          <div class="stat-value">{{ stats?.tasks?.pending || 0 }}</div>
          <div class="stat-detail">
            <span class="text-orange">待处理 {{ stats?.tasks?.pending || 0 }}</span>
            <span class="text-red">已失败 {{ stats?.tasks?.failed || 0 }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h3>活动报告</h3>
          <button class="btn btn-primary" @click="exportEvents">导出CSV</button>
        </div>
        <div v-if="eventsLoading" class="loading">加载中...</div>
        <div v-else-if="eventsReport.length === 0" class="empty">暂无数据</div>
        <div v-else class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>活动标题</th>
                <th>时间</th>
                <th>地点</th>
                <th>状态</th>
                <th>已确认</th>
                <th>已取消</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in eventsReport" :key="event.id">
                <td>{{ event.title }}</td>
                <td>{{ formatDate(event.start_time) }}</td>
                <td>{{ event.location }}</td>
                <td>
                  <span :class="['status-badge', 'status-' + event.status]">
                    {{ statusText(event.status) }}
                  </span>
                </td>
                <td>{{ event.confirmed_count || 0 }}</td>
                <td>{{ event.cancelled_count || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h3>报名报告</h3>
          <div class="header-actions">
            <select v-model="selectedEventId" @change="loadRegistrationsReport">
              <option value="">全部活动</option>
              <option v-for="e in eventsReport" :key="e.id" :value="e.id">
                {{ e.title }}
              </option>
            </select>
            <button class="btn btn-primary" @click="exportRegistrations">导出CSV</button>
          </div>
        </div>
        <div v-if="regLoading" class="loading">加载中...</div>
        <div v-else-if="regsReport.length === 0" class="empty">暂无数据</div>
        <div v-else class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>手机号</th>
                <th>邮箱</th>
                <th>活动</th>
                <th>状态</th>
                <th>报名时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="reg in regsReport" :key="reg.id">
                <td>{{ reg.name }}</td>
                <td>{{ reg.phone }}</td>
                <td>{{ reg.email || '-' }}</td>
                <td>{{ reg.event_title }}</td>
                <td>
                  <span :class="['status-badge', 'status-' + reg.status]">
                    {{ regStatusText(reg.status) }}
                  </span>
                </td>
                <td>{{ formatDateTime(reg.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getStatistics, getEventsReport, getRegistrationsReport, downloadCSV } from '../api/reports';

const loading = ref(false);
const eventsLoading = ref(false);
const regLoading = ref(false);

const stats = ref(null);
const eventsReport = ref([]);
const regsReport = ref([]);
const selectedEventId = ref('');

function statusText(status) {
  const map = { draft: '草稿', published: '已发布', cancelled: '已取消', completed: '已完成' };
  return map[status] || status;
}

function regStatusText(status) {
  const map = { confirmed: '已确认', cancelled: '已取消' };
  return map[status] || status;
}

function formatDate(dateTime) {
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleDateString('zh-CN');
}

function formatDateTime(dateTime) {
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleString('zh-CN');
}

async function loadStats() {
  loading.value = true;
  try {
    const result = await getStatistics();
    stats.value = result.data;
  } catch (error) {
    console.error('加载统计失败：', error);
  } finally {
    loading.value = false;
  }
}

async function loadEventsReport() {
  eventsLoading.value = true;
  try {
    const result = await getEventsReport('json');
    eventsReport.value = result.data;
  } catch (error) {
    console.error('加载活动报告失败：', error);
  } finally {
    eventsLoading.value = false;
  }
}

async function loadRegistrationsReport() {
  regLoading.value = true;
  try {
    const result = await getRegistrationsReport(selectedEventId.value || null, 'json');
    regsReport.value = result.data;
  } catch (error) {
    console.error('加载报名报告失败：', error);
  } finally {
    regLoading.value = false;
  }
}

function exportEvents() {
  downloadCSV('/api/reports/events?format=csv', `events_${Date.now()}.csv`);
}

function exportRegistrations() {
  const params = new URLSearchParams();
  if (selectedEventId.value) params.append('eventId', selectedEventId.value);
  params.append('format', 'csv');
  downloadCSV('/api/reports/registrations?' + params.toString(), `registrations_${Date.now()}.csv`);
}

onMounted(() => {
  loadStats();
  loadEventsReport();
  loadRegistrationsReport();
});
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 12px;
}

.stat-detail {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.text-green { color: #52c41a; }
.text-blue { color: #1890ff; }
.text-red { color: #ff4d4f; }
.text-orange { color: #faad14; }

.section {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
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

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.header-actions select {
  padding: 6px 12px;
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

.btn-primary {
  background: #1890ff;
  color: #fff;
}

.btn-primary:hover {
  background: #40a9ff;
}

.table-wrapper {
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

.status-draft { background: #f0f0f0; color: #666; }
.status-published { background: #e6f7ff; color: #1890ff; }
.status-cancelled { background: #fff2f0; color: #ff4d4f; }
.status-completed { background: #f6ffed; color: #52c41a; }
.status-confirmed { background: #e6f7ff; color: #1890ff; }

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
