<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BatchManagement from './views/BatchManagement.vue'
import PromotionManagement from './views/PromotionManagement.vue'
import PromotionDetail from './views/PromotionDetail.vue'
import IssueManagement from './views/IssueManagement.vue'
import RuleVerification from './views/RuleVerification.vue'
import { initializeData, getStatistics } from './utils/dataService'

const activeTab = ref('batches')
const stats = ref({
  batches: { total: 0, nearExpiry: 0, urgency: 0, attention: 0, earlyWarning: 0, prescription: 0, otc: 0, locked: 0 },
  promotions: { total: 0, draft: 0, review: 0, active: 0, ended: 0 }
})
const selectedPromotionId = ref(null)
const showPromotionDetail = ref(false)

const tabs = [
  { key: 'batches', label: '药品批次', icon: 'Box' },
  { key: 'promotions', label: '促销活动', icon: 'Star' },
  { key: 'issues', label: '问题列表', icon: 'Warning' },
  { key: 'rules', label: '规则验证', icon: 'Document' }
]

function loadStatistics() {
  stats.value = getStatistics()
}

function handleTabChange(tab) {
  activeTab.value = tab
  if (tab === 'promotions') {
    showPromotionDetail.value = false
    selectedPromotionId.value = null
  }
}

function handleViewPromotion(promotionId) {
  selectedPromotionId.value = promotionId
  showPromotionDetail.value = true
  activeTab.value = 'promotions'
}

function handleBackFromDetail() {
  showPromotionDetail.value = false
  selectedPromotionId.value = null
  loadStatistics()
}

onMounted(() => {
  initializeData()
  loadStatistics()
})

function refreshAll() {
  loadStatistics()
  ElMessage.success('数据已刷新')
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <el-icon :size="28" color="#409eff"><Box /></el-icon>
        <h1>药店近效期组合促销台</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="refreshAll">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </header>

    <div class="stats-bar">
      <div class="stat-item" @click="activeTab = 'batches'">
        <div class="stat-label">总批次</div>
        <div class="stat-value">{{ stats.batches.total }}</div>
      </div>
      <div class="stat-item urgency" @click="activeTab = 'batches'">
        <div class="stat-label">紧急层 (≤30天)</div>
        <div class="stat-value">{{ stats.batches.urgency }}</div>
      </div>
      <div class="stat-item attention" @click="activeTab = 'batches'">
        <div class="stat-label">关注层 (31-90天)</div>
        <div class="stat-value">{{ stats.batches.attention }}</div>
      </div>
      <div class="stat-item warning" @click="activeTab = 'batches'">
        <div class="stat-label">预警层 (91-180天)</div>
        <div class="stat-value">{{ stats.batches.earlyWarning }}</div>
      </div>
      <div class="stat-item" @click="activeTab = 'promotions'">
        <div class="stat-label">促销活动</div>
        <div class="stat-value">{{ stats.promotions.total }}</div>
      </div>
      <div class="stat-item active" @click="activeTab = 'promotions'">
        <div class="stat-label">生效中</div>
        <div class="stat-value">{{ stats.promotions.active }}</div>
      </div>
    </div>

    <div class="main-content">
      <aside class="sidebar">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-item"
          :class="{ active: activeTab === tab.key && (tab.key !== 'promotions' || !showPromotionDetail) }"
          @click="handleTabChange(tab.key)"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
          <el-tag
            v-if="tab.key === 'batches' && stats.batches.nearExpiry > 0"
            type="danger"
            size="small"
            effect="light"
          >
            {{ stats.batches.nearExpiry }}
          </el-tag>
          <el-tag
            v-else-if="tab.key === 'issues'"
            type="warning"
            size="small"
            effect="light"
          >
            查看
          </el-tag>
        </div>
      </aside>

      <main class="content-area">
        <BatchManagement
          v-if="activeTab === 'batches'"
          @refresh="loadStatistics"
          @view-promotion="handleViewPromotion"
        />
        
        <PromotionManagement
          v-else-if="activeTab === 'promotions' && !showPromotionDetail"
          @refresh="loadStatistics"
          @view-detail="handleViewPromotion"
        />
        
        <PromotionDetail
          v-else-if="activeTab === 'promotions' && showPromotionDetail"
          :promotion-id="selectedPromotionId"
          @back="handleBackFromDetail"
          @refresh="loadStatistics"
        />
        
        <IssueManagement
          v-else-if="activeTab === 'issues'"
          @refresh="loadStatistics"
        />
        
        <RuleVerification
          v-else-if="activeTab === 'rules'"
          @refresh="loadStatistics"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.stats-bar {
  display: flex;
  gap: 16px;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.stat-item {
  flex: 1;
  min-width: 140px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border-left: 3px solid #909399;
}

.stat-item:hover {
  background: #eef2f7;
  transform: translateY(-2px);
}

.stat-item.urgency {
  border-left-color: #f56c6c;
  background: #fef0f0;
}

.stat-item.attention {
  border-left-color: #e6a23c;
  background: #fdf6ec;
}

.stat-item.warning {
  border-left-color: #409eff;
  background: #ecf5ff;
}

.stat-item.active {
  border-left-color: #67c23a;
  background: #f0f9eb;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.main-content {
  display: flex;
  min-height: calc(100vh - 180px);
}

.sidebar {
  width: 200px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  padding: 16px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  cursor: pointer;
  color: #606266;
  transition: all 0.3s;
}

.nav-item:hover {
  background: #f5f7fa;
  color: #409eff;
}

.nav-item.active {
  background: #ecf5ff;
  color: #409eff;
  border-right: 3px solid #409eff;
  font-weight: 500;
}

.nav-item .el-tag {
  margin-left: auto;
}

.content-area {
  flex: 1;
  padding: 24px;
}
</style>
