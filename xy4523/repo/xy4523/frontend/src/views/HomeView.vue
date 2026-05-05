<template>
  <div class="home-view">
    <div class="page-header flex-between mb-4">
      <div>
        <h1 class="page-title">📊 今日概览</h1>
        <p class="page-subtitle text-muted">
          日期: {{ store.currentDate }} | 共评估 {{ store.assessments.length }} 个植物批次
        </p>
      </div>
      <div class="flex gap-2">
        <button 
          class="btn btn-primary" 
          @click="runAssessment"
          :disabled="store.loading"
        >
          <span v-if="store.loading" class="spinner"></span>
          运行评估
        </button>
        <button class="btn btn-success" @click="exportMarkdown">
          📄 导出工作单
        </button>
        <button class="btn btn-info" @click="exportJson">
          📋 导出审计
        </button>
      </div>
    </div>

    <div class="grid grid-4 mb-4">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(76, 175, 80, 0.1); color: #4caf50;">
          🌱
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color: #4caf50;">{{ store.assessments.length }}</div>
          <div class="stat-label">评估批次</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(76, 175, 80, 0.15); color: #4caf50;">
          ✅
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color: #4caf50;">{{ store.suitableCount }}</div>
          <div class="stat-label">适合授粉</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(255, 152, 0, 0.15); color: #ff9800;">
          ⚠️
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color: #ff9800;">{{ store.atRiskCount }}</div>
          <div class="stat-label">存在风险</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(33, 150, 243, 0.15); color: #2196f3;">
          🏠
        </div>
        <div class="stat-content">
          <div class="stat-value" style="color: #2196f3;">{{ store.greenhouses.length }}</div>
          <div class="stat-label">温室数量</div>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          📈 风险类型分布
        </div>
        <div class="card-body">
          <div v-if="Object.keys(store.groupedByRiskType).length === 0" class="text-center text-muted p-4">
            暂无数据，请先运行评估
          </div>
          <div v-else class="risk-list">
            <div 
              v-for="(group, type) in store.groupedByRiskType" 
              :key="type"
              class="risk-item flex-between"
            >
              <div class="flex gap-2 align-center">
                <span class="risk-icon">{{ getRiskIcon(type) }}</span>
                <span>{{ group.label }}</span>
              </div>
              <div class="flex gap-2 align-center">
                <span class="badge" :class="getRiskBadgeClass(type)">{{ group.count }}</span>
                <div class="progress-bar-wrapper">
                  <div 
                    class="progress-bar" 
                    :style="{ 
                      width: (group.count / store.assessments.length * 100) + '%',
                      background: getRiskColor(type)
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          🏠 温室状态
        </div>
        <div class="card-body">
          <div v-if="Object.keys(store.groupedByGreenhouse).length === 0" class="text-center text-muted p-4">
            暂无数据，请先导入温室和苗床数据
          </div>
          <div v-else>
            <div 
              v-for="(ghInfo, ghName) in store.groupedByGreenhouse" 
              :key="ghName"
              class="greenhouse-summary"
            >
              <div class="flex-between mb-2">
                <span class="text-bold">🏠 {{ ghName }}</span>
                <span class="badge" :class="ghInfo.suitable === ghInfo.total ? 'badge-success' : 'badge-warning'">
                  {{ ghInfo.suitable }}/{{ ghInfo.total }} 适合
                </span>
              </div>
              <div class="seedbed-grid">
                <div 
                  v-for="(sbInfo, sbCode) in ghInfo.seedbeds" 
                  :key="sbCode"
                  class="seedbed-card cursor-pointer"
                  @click="goToGreenhouse"
                >
                  <div class="seedbed-title">苗床 {{ sbCode }}</div>
                  <div class="seedbed-stats">
                    <span class="badge badge-info">{{ sbInfo.total }} 批次</span>
                    <span class="badge badge-success">{{ sbInfo.suitable }} 适合</span>
                  </div>
                  <div class="seedbed-progress">
                    <div 
                      class="progress-fill"
                      :style="{ 
                        width: (sbInfo.suitable / sbInfo.total * 100) + '%',
                        background: sbInfo.suitable === sbInfo.total ? '#4caf50' : '#ff9800'
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-header flex-between">
        <span>📋 最新评估列表</span>
        <button class="btn btn-sm btn-outline" @click="goToAssessment">
          查看全部 →
        </button>
      </div>
      <div class="card-body p-0">
        <table class="table">
          <thead>
            <tr>
              <th>温室</th>
              <th>苗床</th>
              <th>植物</th>
              <th>批次号</th>
              <th>花期状态</th>
              <th>风险类型</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="store.assessments.length === 0">
              <td colspan="8" class="text-center text-muted p-4">
                暂无评估数据，请先运行评估
              </td>
            </tr>
            <tr v-for="item in store.assessments.slice(0, 10)" :key="item.id">
              <td>{{ item.greenhouse_name }}</td>
              <td>{{ item.seedbed_code }}</td>
              <td>
                <span class="text-bold">{{ item.plant_name }}</span>
                <span v-if="item.variety" class="text-muted ml-1">({{ item.variety }})</span>
              </td>
              <td>{{ item.batch_number || '-' }}</td>
              <td>{{ item.flowering_stage }}</td>
              <td>
                <span class="badge" :class="getRiskBadgeClass(item.risk_type)">
                  {{ store.riskTypeLabels[item.risk_type] || item.risk_type }}
                </span>
              </td>
              <td>
                <span 
                  class="badge" 
                  :class="item.is_suitable_pollination ? 'badge-success' : 'badge-warning'"
                >
                  {{ item.is_suitable_pollination ? '✅ 适合' : '⚠️ 风险' }}
                </span>
                <span v-if="item.manual_override" class="ml-1 text-warning">
                  (人工改判)
                </span>
              </td>
              <td>
                <button class="btn btn-sm btn-outline" @click="viewDetail(item)">
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import { exportApi } from '@/utils/api'

const store = useAppStore()
const router = useRouter()

const runAssessment = async () => {
  await store.runAssessment()
}

const exportMarkdown = () => {
  exportApi.markdown(store.currentDate)
}

const exportJson = () => {
  exportApi.json(store.currentDate)
}

const goToAssessment = () => {
  router.push('/assessment')
}

const goToGreenhouse = () => {
  router.push('/greenhouse')
}

const viewDetail = (item) => {
  router.push(`/detail/${item.plant_batch_id}`)
}

const getRiskIcon = (type) => {
  const icons = {
    suitable: '✅',
    temperature_risk: '🌡️',
    humidity_risk: '💧',
    cross_pollination: '🐝',
    before_flowering: '🌱',
    missed_flowering: '🍂',
    isolation_open: '🚪',
    no_operator: '👤',
    multiple_risks: '⚠️'
  }
  return icons[type] || '❓'
}

const getRiskColor = (type) => {
  const colors = {
    suitable: '#4caf50',
    temperature_risk: '#ff9800',
    humidity_risk: '#2196f3',
    cross_pollination: '#f44336',
    before_flowering: '#9e9e9e',
    missed_flowering: '#795548',
    isolation_open: '#ff5722',
    no_operator: '#607d8b',
    multiple_risks: '#e91e63'
  }
  return colors[type] || '#9e9e9e'
}

const getRiskBadgeClass = (type) => {
  if (type === 'suitable') return 'badge-success'
  return 'badge-warning'
}

onMounted(() => {
  store.fetchAssessments()
})

watch(() => store.currentDate, () => {
  store.fetchAssessments()
})
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
}

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.risk-item:last-child {
  border-bottom: none;
}

.risk-icon {
  font-size: 18px;
}

.progress-bar-wrapper {
  width: 100px;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  transition: width 0.3s ease;
}

.greenhouse-summary {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.greenhouse-summary:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.seedbed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.seedbed-card {
  padding: 12px;
  background-color: #f8faf8;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  transition: var(--transition);
}

.seedbed-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(45, 90, 39, 0.1);
}

.seedbed-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}

.seedbed-stats {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.seedbed-progress {
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.ml-1 {
  margin-left: 4px;
}

.text-warning {
  color: var(--warning-color);
}
</style>
