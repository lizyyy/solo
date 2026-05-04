<template>
  <div class="departments-page">
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">🏥</div>
        <div class="stat-content">
          <div class="stat-value">{{ systemStore.stats.departments }}</div>
          <div class="stat-label">科室总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🛏️</div>
        <div class="stat-content">
          <div class="stat-value">{{ systemStore.stats.totalBeds }}</div>
          <div class="stat-label">床位总数</div>
        </div>
      </div>
      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ systemStore.stats.availableBeds }}</div>
          <div class="stat-label">可用床位</div>
        </div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">⚠️</div>
        <div class="stat-content">
          <div class="stat-value">{{ systemStore.bedUsageRate }}%</div>
          <div class="stat-label">床位使用率</div>
        </div>
      </div>
    </div>

    <div class="capacity-alert" v-if="overloadedDepartments.length > 0">
      <div class="alert-title">
        <span class="alert-icon">🚨</span>
        科室容量预警
      </div>
      <div class="alert-items">
        <div class="alert-item" v-for="dept in overloadedDepartments" :key="dept.id">
          <span class="dept-name">{{ dept.name }}</span>
          <span class="dept-status">可用床位: {{ dept.availableBeds }}/{{ dept.bedsCount }}</span>
          <span class="capacity-badge" :class="getCapacityClass(dept.capacityRatio)">
            {{ Math.round(dept.capacityRatio * 100) }}% 可用
          </span>
        </div>
      </div>
    </div>

    <div class="departments-grid">
      <div class="department-card" v-for="dept in systemStore.departmentsWithCapacity" :key="dept.id">
        <div class="dept-header">
          <div class="dept-info">
            <span class="dept-icon">🏥</span>
            <span class="dept-name">{{ dept.name }}</span>
          </div>
          <span class="dept-capacity" :class="getCapacityClass(dept.capacityRatio)">
            {{ dept.availableBeds }}/{{ dept.bedsCount }} 可用
          </span>
        </div>
        
        <div class="dept-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: (1 - dept.capacityRatio) * 100 + '%' }"
              :class="getCapacityClass(dept.capacityRatio)"
            ></div>
          </div>
          <div class="progress-labels">
            <span>占用: {{ dept.bedsCount - dept.availableBeds }}</span>
            <span>可用: {{ dept.availableBeds }}</span>
          </div>
        </div>

        <div class="dept-beds" v-if="getDepartmentBeds(dept.id).length > 0">
          <div class="beds-title">床位状态</div>
          <div class="beds-list">
            <div 
              class="bed-item" 
              v-for="bed in getDepartmentBeds(dept.id)" 
              :key="bed.id"
              :class="bed.status"
              :title="`${bed.name} - ${systemStore.getBedStatusLabel(bed.status)}`"
            >
              <span class="bed-icon">{{ getBedIcon(bed.status) }}</span>
              <span class="bed-name">{{ bed.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="beds-section">
      <div class="section-header">
        <h3>床位详情</h3>
        <div class="filter-controls">
          <select v-model="bedFilter" class="form-select">
            <option value="">全部状态</option>
            <option value="available">可用</option>
            <option value="occupied">已占用</option>
            <option value="maintenance">维护中</option>
          </select>
          <select v-model="deptFilter" class="form-select">
            <option value="">全部科室</option>
            <option v-for="dept in systemStore.departments" :key="dept.id" :value="dept.id">
              {{ dept.name }}
            </option>
          </select>
        </div>
      </div>
      
      <div class="beds-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>床位编号</th>
              <th>所属科室</th>
              <th>状态</th>
              <th>类型</th>
              <th>位置</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bed in filteredBeds" :key="bed.id">
              <td class="bed-name-cell">
                <span class="bed-status-dot" :style="{ backgroundColor: systemStore.getBedStatusColor(bed.status) }"></span>
                {{ bed.name }}
              </td>
              <td>{{ getDepartmentName(bed.departmentId) }}</td>
              <td>
                <span class="status-badge" :class="bed.status">
                  {{ systemStore.getBedStatusLabel(bed.status) }}
                </span>
              </td>
              <td>{{ bed.type || '普通' }}</td>
              <td>{{ bed.location || '-' }}</td>
            </tr>
            <tr v-if="filteredBeds.length === 0">
              <td colspan="5" class="empty-cell">暂无床位数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()

const bedFilter = ref('')
const deptFilter = ref('')

const overloadedDepartments = computed(() => {
  return systemStore.departmentsWithCapacity.filter(d => d.capacityRatio <= 0.3 && d.bedsCount > 0)
})

const filteredBeds = computed(() => {
  let beds = systemStore.beds
  if (bedFilter.value) {
    beds = beds.filter(b => b.status === bedFilter.value)
  }
  if (deptFilter.value) {
    beds = beds.filter(b => b.departmentId === deptFilter.value)
  }
  return beds
})

function getDepartmentBeds(deptId) {
  return systemStore.beds.filter(b => b.departmentId === deptId)
}

function getDepartmentName(deptId) {
  const dept = systemStore.departments.find(d => d.id === deptId)
  return dept ? dept.name : '未知'
}

function getCapacityClass(ratio) {
  if (ratio <= 0.2) return 'critical'
  if (ratio <= 0.4) return 'warning'
  return 'normal'
}

function getBedIcon(status) {
  const icons = {
    available: '🟢',
    occupied: '🔴',
    maintenance: '🟡'
  }
  return icons[status] || '⚪'
}

onMounted(() => {
  systemStore.fetchDepartments()
  systemStore.fetchBeds()
})
</script>

<style scoped>
.departments-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-gray-900);
}

.stat-label {
  font-size: 14px;
  color: var(--color-gray-600);
}

.stat-card.success .stat-value {
  color: var(--color-green);
}

.stat-card.warning .stat-value {
  color: var(--color-yellow);
}

.capacity-alert {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fcd34d;
  border-radius: var(--radius);
  padding: 16px 20px;
}

.alert-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 12px;
}

.alert-icon {
  font-size: 18px;
}

.alert-items {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: var(--radius-sm);
}

.dept-name {
  font-weight: 600;
  color: var(--color-gray-900);
}

.dept-status {
  font-size: 13px;
  color: var(--color-gray-600);
}

.capacity-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-green);
  color: white;
}

.capacity-badge.critical {
  background: var(--color-red);
}

.capacity-badge.warning {
  background: var(--color-yellow);
  color: var(--color-gray-900);
}

.departments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.department-card {
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dept-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dept-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dept-icon {
  font-size: 24px;
}

.dept-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-gray-900);
}

.dept-capacity {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  background: #dcfce7;
  color: var(--color-green);
}

.dept-capacity.critical {
  background: #fee2e2;
  color: var(--color-red);
}

.dept-capacity.warning {
  background: #fef3c7;
  color: var(--color-yellow);
}

.dept-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  height: 8px;
  background: var(--color-gray-100);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-green);
  transition: width 0.3s ease;
}

.progress-fill.critical {
  background: var(--color-red);
}

.progress-fill.warning {
  background: var(--color-yellow);
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-gray-600);
}

.dept-beds {
  border-top: 1px solid var(--color-gray-100);
  padding-top: 16px;
}

.beds-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-700);
  margin-bottom: 10px;
}

.beds-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bed-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-gray-50);
  border-radius: 6px;
  font-size: 12px;
}

.bed-item.available {
  background: #dcfce7;
}

.bed-item.occupied {
  background: #fee2e2;
}

.bed-item.maintenance {
  background: #fef3c7;
}

.bed-icon {
  font-size: 10px;
}

.beds-section {
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--color-gray-100);
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0;
}

.filter-controls {
  display: flex;
  gap: 12px;
}

.form-select {
  padding: 8px 12px;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: white;
  min-width: 120px;
}

.beds-table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 14px 20px;
  text-align: left;
  border-bottom: 1px solid var(--color-gray-100);
}

.data-table th {
  background: var(--color-gray-50);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-600);
}

.data-table td {
  font-size: 14px;
  color: var(--color-gray-800);
}

.bed-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.bed-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.available {
  background: #dcfce7;
  color: var(--color-green);
}

.status-badge.occupied {
  background: #fee2e2;
  color: var(--color-red);
}

.status-badge.maintenance {
  background: #fef3c7;
  color: var(--color-yellow);
}

.empty-cell {
  text-align: center;
  color: var(--color-gray-500);
  padding: 40px 20px !important;
}
</style>
