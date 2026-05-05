<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-lg">体</span>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">少儿体操积分赛 - 赛后复核工具</h1>
              <p class="text-sm text-gray-500">数据导入 · 对齐分析 · 可视化复核</p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <button
              v-if="alignedData"
              @click="exportMarkdown"
              class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              导出 Markdown
            </button>
            <button
              v-if="alignedData"
              @click="exportJSON"
              class="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              导出 JSON 审计
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div v-if="!alignedData" class="space-y-6">
        <DataImport @dataLoaded="handleDataLoaded" @loadSample="loadSampleData" />
      </div>

      <div v-else class="space-y-6">
        <OverviewDashboard
          :aligned-data="alignedData"
          :analysis-results="analysisResults"
          :review-stats="reviewStats"
        />

        <div class="bg-white rounded-xl shadow-sm border">
          <div class="border-b">
            <nav class="flex space-x-8 px-6">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                :class="[
                  'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                {{ tab.name }}
                <span
                  v-if="tab.count !== undefined"
                  :class="[
                    'ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    tab.count > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                  ]"
                >
                  {{ tab.count }}
                </span>
              </button>
            </nav>
          </div>

          <div class="p-6">
            <ScoreAnalysis
              v-if="activeTab === 'scores'"
              :analysis-results="analysisResults"
              :aligned-data="alignedData"
            />

            <AppealAnalysis
              v-else-if="activeTab === 'appeals'"
              :analysis-results="analysisResults"
              :review-service="reviewService"
              @updated="refreshReviewStats"
            />

            <RankingAnalysis
              v-else-if="activeTab === 'ranking'"
              :analysis-results="analysisResults"
              :aligned-data="alignedData"
            />

            <DataReview
              v-else-if="activeTab === 'data'"
              :aligned-data="alignedData"
            />
          </div>
        </div>
      </div>
    </main>

    <footer class="mt-auto bg-white border-t">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <p class="text-center text-sm text-gray-500">
          少儿体操积分赛赛后复核工具 v1.0.0 · 数据保存在本地浏览器中
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import DataImport from './components/DataImport.vue'
import OverviewDashboard from './components/OverviewDashboard.vue'
import ScoreAnalysis from './components/ScoreAnalysis.vue'
import AppealAnalysis from './components/AppealAnalysis.vue'
import RankingAnalysis from './components/RankingAnalysis.vue'
import DataReview from './components/DataReview.vue'

import DataLoader from './services/DataLoader.js'
import DataAligner from './services/DataAligner.js'
import AnalyticsEngine from './services/AnalyticsEngine.js'
import ReviewService from './services/ReviewService.js'
import ExportService from './services/ExportService.js'

const dataLoader = new DataLoader()
const dataAligner = new DataAligner()
const analyticsEngine = new AnalyticsEngine()
const reviewService = new ReviewService()
const exportService = new ExportService()

const alignedData = ref(null)
const analysisResults = ref(null)
const activeTab = ref('scores')
const reviewStats = ref(reviewService.getStatistics())

const tabs = computed(() => [
  { id: 'scores', name: '成绩差异', count: analysisResults.value?.scoreDifferences?.issues?.length || 0 },
  { id: 'appeals', name: '申诉分析', count: analysisResults.value?.appealAnalysis?.total || 0 },
  { id: 'ranking', name: '排名影响', count: 0 },
  { id: 'data', name: '数据浏览', count: 0 }
])

async function handleDataLoaded(rawData) {
  try {
    const aligned = dataAligner.align(rawData)
    alignedData.value = aligned

    analyticsEngine.setAlignedData(aligned)
    analysisResults.value = analyticsEngine.analyze()
  } catch (error) {
    console.error('数据处理失败:', error)
    alert('数据处理失败: ' + error.message)
  }
}

async function loadSampleData() {
  const sampleData = await dataLoader.loadSampleData()
  if (sampleData) {
    await handleDataLoaded(sampleData)
  } else {
    alert('无法加载示例数据，请手动导入数据文件')
  }
}

function refreshReviewStats() {
  reviewStats.value = reviewService.getStatistics()
}

function exportMarkdown() {
  if (!alignedData.value || !analysisResults.value) return

  const markdown = exportService.generateMarkdownReview(
    alignedData.value,
    analysisResults.value,
    reviewService
  )
  
  const competitionName = alignedData.value.competition?.name || '复核报告'
  const filename = `${competitionName}_复核报告_${new Date().toISOString().split('T')[0]}.md`
  
  exportService.downloadFile(markdown, filename, 'text/markdown')
}

function exportJSON() {
  if (!alignedData.value || !analysisResults.value) return

  const json = exportService.generateJSONAudit(
    alignedData.value,
    analysisResults.value,
    reviewService
  )
  
  const competitionName = alignedData.value.competition?.name || '审计数据'
  const filename = `${competitionName}_审计明细_${Date.now()}.json`
  
  exportService.downloadFile(json, filename, 'application/json')
}
</script>
