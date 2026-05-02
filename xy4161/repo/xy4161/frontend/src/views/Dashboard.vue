<template>
  <div class="dashboard">
    <div class="page-header">
      <h2>仪表盘</h2>
      <button class="btn-primary" @click="loadStats">刷新数据</button>
    </div>

    <div v-if="loading" class="loading">
      <p>加载中...</p>
    </div>

    <div v-else class="dashboard-content">
      <div class="alerts-section">
        <div v-if="stats?.pendingReworks?.length > 0" class="alert-card warning">
          <div class="alert-header">
            <span class="alert-icon">⚠️</span>
            <h3>待复核返工申请 ({{ stats.pendingReworks.length }})</h3>
          </div>
          <div class="alert-list">
            <div v-for="rework in stats.pendingReworks" :key="rework.id" class="alert-item">
              <div class="alert-info">
                <span class="case-number">{{ rework.case_number }}</span>
                <span v-if="rework.tooth_number" class="tooth-num">牙位 #{{ rework.tooth_number }}</span>
                <span class="reason">{{ rework.reason_description }}</span>
              </div>
              <div class="alert-action">
                <router-link :to="`/cases/${rework.case_id}`" class="btn-sm">查看详情</router-link>
              </div>
            </div>
          </div>
        </div>

        <div v-if="stats?.overdueFeedbacks?.length > 0" class="alert-card error">
          <div class="alert-header">
            <span class="alert-icon">🔴</span>
            <h3>逾期未跟进试戴反馈 ({{ stats.overdueFeedbacks.length }})</h3>
          </div>
          <div class="alert-list">
            <div v-for="feedback in stats.overdueFeedbacks" :key="feedback.id" class="alert-item">
              <div class="alert-info">
                <span class="case-number">{{ feedback.case_number }}</span>
                <span v-if="feedback.tooth_number" class="tooth-num">牙位 #{{ feedback.tooth_number }}</span>
                <span class="detail">就位: {{ feedback.fit_status }} | 需返工: {{ feedback.needs_rework ? '是' : '否' }}</span>
              </div>
              <div class="alert-action">
                <router-link :to="`/cases/${feedback.case_id}`" class="btn-sm">跟进</router-link>
              </div>
            </div>
          </div>
        </div>

        <div v-if="stats?.excessiveRework?.length > 0" class="alert-card critical">
          <div class="alert-header">
            <span class="alert-icon">🚨</span>
            <h3>高频返工警告 ({{ stats.excessiveRework.length }})</h3>
          </div>
          <div class="alert-list">
            <div v-for="tooth in stats.excessiveRework" :key="tooth.id" class="alert-item">
              <div class="alert-info">
                <span class="case-number">{{ tooth.case_number }}</span>
                <span class="tooth-num">牙位 #{{ tooth.tooth_number }}</span>
                <span class="rework-count">返工 {{ tooth.rework_count }} 次</span>
              </div>
              <div class="alert-action">
                <router-link :to="`/cases/${tooth.case_id}`" class="btn-sm">查看</router-link>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!hasAlerts" class="no-alerts">
          <div class="success-icon">✅</div>
          <h3>系统运行正常</h3>
          <p>没有发现需要紧急处理的问题</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <h4>病例状态分布</h4>
          <div class="stat-list">
            <div v-for="stat in stats?.caseStats" :key="stat.status" class="stat-item">
              <span class="stat-label">{{ getStatusLabel(stat.status) }}</span>
              <span class="stat-value">{{ stat.count }}</span>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <h4>返工原因统计</h4>
          <div class="stat-list">
            <div v-for="stat in stats?.reworkStats" :key="stat.reason_code" class="stat-item">
              <span class="stat-label">{{ getReworkReasonLabel(stat.reason_code) }}</span>
              <span class="stat-value">{{ stat.count }}</span>
            </div>
            <div v-if="!stats?.reworkStats?.length" class="empty-stat">
              暂无返工记录
            </div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <h3>快捷操作</h3>
        <div class="action-buttons">
          <router-link to="/cases" class="action-btn">
            <span class="btn-icon">📋</span>
            <span>查看所有病例</span>
          </router-link>
          <router-link to="/import" class="action-btn">
            <span class="btn-icon">📥</span>
            <span>导入数据</span>
          </router-link>
          <router-link to="/cases" class="action-btn">
            <span class="btn-icon">➕</span>
            <span>新建病例</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCaseStore } from '../stores/cases'

const store = useCaseStore()
const loading = ref(false)

const stats = computed(() => store.dashboardStats)

const hasAlerts = computed(() => {
  const s = stats.value
  if (!s) return false
  return (
    (s.pendingReworks?.length > 0) ||
    (s.overdueFeedbacks?.length > 0) ||
    (s.excessiveRework?.length > 0)
  )
})

const statusLabels = {
  PRESCRIPTION_RECEIVED: '处方已接收',
  SCAN_RECEIVED: '口扫已接收',
  DESIGNING: '设计中',
  DESIGN_APPROVED: '设计已批准',
  MANUFACTURING: '加工中',
  QUALITY_CHECK: '质检中',
  TRY_IN: '试戴中',
  TRY_IN_FEEDBACK_RECEIVED: '试戴反馈已接收',
  FINAL_DELIVERY: '最终交付',
  COMPLETED: '已完成',
  REWORK_IN_PROGRESS: '返工进行中',
  CANCELLED: '已取消'
}

const reworkReasonLabels = {
  DESIGN_ISSUE: '设计问题',
  MANUFACTURING_DEFECT: '加工缺陷',
  FIT_ISSUE: '就位问题',
  OCCLUSION_ISSUE: '咬合问题',
  ESTHETICS_ISSUE: '美学问题',
  MATERIAL_DEFECT: '材料缺陷',
  DOCTOR_REQUEST: '医生要求',
  PATIENT_REQUEST: '患者要求',
  OTHER: '其他'
}

const getStatusLabel = (status) => statusLabels[status] || status

const getReworkReasonLabel = (code) => reworkReasonLabels[code] || code

const loadStats = async () => {
  loading.value = true
  try {
    await store.fetchDashboardStats()
  } catch (e) {
    console.error('Failed to load stats:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #303133;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #909399;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.alerts-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-card {
  background: white;
  border-radius: 8px;
  padding: 1.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-left: 4px solid;
}

.alert-card.warning {
  border-left-color: #e6a23c;
}

.alert-card.error {
  border-left-color: #f56c6c;
}

.alert-card.critical {
  border-left-color: #ff4d4f;
  background: #fff1f0;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.alert-icon {
  font-size: 1.2rem;
}

.alert-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.alert-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem;
  background: #f5f7fa;
  border-radius: 6px;
}

.alert-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.case-number {
  font-weight: 600;
  color: #409eff;
}

.tooth-num {
  background: #e6a23c;
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.reason, .detail {
  color: #606266;
  font-size: 0.9rem;
}

.rework-count {
  background: #f56c6c;
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.btn-sm {
  background: #409eff;
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.85rem;
}

.btn-sm:hover {
  background: #66b1ff;
}

.no-alerts {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.no-alerts h3 {
  color: #67c23a;
  margin-bottom: 0.5rem;
}

.no-alerts p {
  color: #909399;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 1.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-card h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #ebeef5;
}

.stat-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  color: #606266;
}

.stat-value {
  font-weight: 600;
  color: #409eff;
}

.empty-stat {
  color: #909399;
  text-align: center;
  padding: 1rem;
}

.quick-actions {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.quick-actions h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.2rem 2rem;
  background: #f5f7fa;
  border-radius: 8px;
  text-decoration: none;
  color: #606266;
  transition: all 0.2s;
  min-width: 140px;
}

.action-btn:hover {
  background: #ecf5ff;
  color: #409eff;
  transform: translateY(-2px);
}

.btn-icon {
  font-size: 1.8rem;
}
</style>
