<template>
  <div class="drill-detail-page">
    <div class="page-header" v-if="drill">
      <el-page-header @back="$router.push('/')">
        <template #content>
          <div class="header-content">
            <span class="drill-title">{{ drill.name }}</span>
            <el-tag :type="getStatusType(drill.status)" size="large">
              {{ getStatusText(drill.status) }}
            </el-tag>
          </div>
        </template>
      </el-page-header>
    </div>

    <el-card v-loading="loading" class="detail-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="概览" name="overview">
          <router-view />
        </el-tab-pane>
        
        <el-tab-pane label="性能分析" name="analysis">
          <router-view />
        </el-tab-pane>
        
        <el-tab-pane label="瓶颈排序" name="bottlenecks">
          <router-view />
        </el-tab-pane>
        
        <el-tab-pane label="优化建议" name="suggestions">
          <router-view />
        </el-tab-pane>
        
        <el-tab-pane label="报告导出" name="report">
          <router-view />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { drillApi, analysisApi } from '@/api'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const drill = ref(null)
const analysis = ref(null)
const activeTab = ref('overview')

const getStatusType = (status) => {
  const typeMap = {
    pending: 'info',
    uploaded: 'warning',
    analyzed: 'success',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

const getStatusText = (status) => {
  const textMap = {
    pending: '待上传',
    uploaded: '已上传',
    analyzed: '已分析',
    failed: '失败'
  }
  return textMap[status] || status
}

const handleTabChange = (name) => {
  router.push({
    name: getTabRouteName(name),
    params: { id: route.params.id }
  })
}

const getTabRouteName = (tabName) => {
  const routeMap = {
    overview: 'DrillOverview',
    analysis: 'DrillAnalysis',
    bottlenecks: 'DrillBottlenecks',
    suggestions: 'DrillSuggestions',
    report: 'DrillReport'
  }
  return routeMap[tabName] || 'DrillOverview'
}

const fetchDrill = async () => {
  loading.value = true
  try {
    const drillId = route.params.id
    const response = await drillApi.get(drillId)
    drill.value = response.data
    
    if (drill.value.status === 'analyzed') {
      try {
        const analysisResponse = await analysisApi.get(drillId)
        analysis.value = analysisResponse.data
      } catch (e) {
        console.log('暂无分析结果')
      }
    }
  } catch (error) {
    console.error('获取演练详情失败:', error)
  } finally {
    loading.value = false
  }
}

watch(() => route.name, (name) => {
  const tabMap = {
    'DrillOverview': 'overview',
    'DrillAnalysis': 'analysis',
    'DrillBottlenecks': 'bottlenecks',
    'DrillSuggestions': 'suggestions',
    'DrillReport': 'report'
  }
  if (tabMap[name]) {
    activeTab.value = tabMap[name]
  }
}, { immediate: true })

onMounted(() => {
  fetchDrill()
})
</script>

<style scoped>
.drill-detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drill-title {
  font-size: 18px;
  font-weight: 600;
}

.detail-card {
  border-radius: 8px;
  min-height: 500px;
}

:deep(.el-tabs__content) {
  padding-top: 20px;
}
</style>
