<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTestStore } from '@/stores/testStore'
import { importMultipleFiles } from '@/utils/importUtils'
import { analyzeTestRound, generateRiskItems } from '@/utils/analysisUtils'
import { exportMarkdownReport, exportRiskCSV, exportJSONAuditPackage } from '@/utils/exportUtils'
import type { ReviewRecord, RiskItem } from '@/types'
import DataImport from '@/components/DataImport.vue'
import TestRoundList from '@/components/TestRoundList.vue'
import TestRoundDetail from '@/components/TestRoundDetail.vue'
import DataChart from '@/components/DataChart.vue'
import AnalysisPanel from '@/components/AnalysisPanel.vue'
import ReviewPanel from '@/components/ReviewPanel.vue'

const store = useTestStore()
const activeTab = ref<'import' | 'list' | 'detail' | 'analysis' | 'review' | 'export'>('import')
const isDragging = ref(false)
const importErrors = ref<string[]>([])
const importWarnings = ref<string[]>([])
const successMessage = ref('')

const tabs = [
  { id: 'import', label: '数据导入' },
  { id: 'list', label: '测试列表' },
  { id: 'detail', label: '测试详情', disabled: computed(() => !store.selectedTestRound) },
  { id: 'analysis', label: '分析结果', disabled: computed(() => !store.selectedAnalysisResult) },
  { id: 'review', label: '复核改判', disabled: computed(() => !store.selectedTestRound) },
  { id: 'export', label: '导出数据' }
]

function switchTab(tabId: string) {
  const tab = tabs.find(t => t.id === tabId)
  if (tab && !tab.disabled?.value) {
    activeTab.value = tabId as typeof activeTab.value
  }
}

async function handleFileDrop(files: FileList) {
  isDragging.value = false
  await processFiles(files)
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    await processFiles(input.files)
  }
  input.value = ''
}

async function processFiles(files: FileList) {
  importErrors.value = []
  importWarnings.value = []
  successMessage.value = ''
  
  const result = await importMultipleFiles(files)
  
  if (result.errors.length > 0) {
    importErrors.value = result.errors
  }
  
  if (result.warnings.length > 0) {
    importWarnings.value = result.warnings
  }
  
  if (result.success) {
    for (const testRound of result.testRounds) {
      store.addTestRound(testRound)
      
      const analysisResult = analyzeTestRound(testRound)
      store.addAnalysisResult(analysisResult)
      
      const riskItems = generateRiskItems(testRound, analysisResult)
      for (const item of riskItems) {
        store.addRiskItem(item)
      }
    }
    
    successMessage.value = `成功导入 ${result.testRounds.length} 个测试数据`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function selectTestRound(id: string) {
  store.selectTestRound(id)
  if (store.selectedTestRound) {
    activeTab.value = 'detail'
  }
}

function saveReview(review: ReviewRecord) {
  store.addReviewRecord(review)
  successMessage.value = '复核记录已保存'
  setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

function updateRiskItem(itemId: string, status: RiskItem['status'], notes?: string) {
  store.updateRiskItemStatus(itemId, status, '当前用户', notes)
}

function exportMarkdown() {
  if (store.selectedTestRound && store.selectedAnalysisResult) {
    const supportConfig = store.selectedTestRound.supportConfigId 
      ? store.getSupportConfig(store.selectedTestRound.supportConfigId) 
      : null
    
    exportMarkdownReport(
      store.selectedTestRound,
      store.selectedAnalysisResult,
      store.selectedReviewRecord,
      supportConfig
    )
  }
}

function exportCSV() {
  if (store.riskItems.length > 0) {
    exportRiskCSV(store.riskItems)
  }
}

function exportJSON() {
  exportJSONAuditPackage(
    store.testRounds,
    store.analysisResults,
    store.reviewRecords,
    store.riskItems,
    store.supportConfigs
  )
}

function clearAllData() {
  if (confirm('确定要清除所有数据吗？此操作不可撤销。')) {
    store.clearAll()
    activeTab.value = 'import'
    successMessage.value = '已清除所有数据'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  }
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>风洞实验复盘工具</h1>
    </header>
    
    <main class="app-main">
      <div v-if="successMessage" class="alert alert-success">
        {{ successMessage }}
      </div>
      
      <div class="tab-container">
        <div class="tab-list">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{ active: activeTab === tab.id, disabled: tab.disabled?.value }"
            @click="switchTab(tab.id)"
          >
            {{ tab.label }}
          </div>
        </div>
      </div>
      
      <div v-if="activeTab === 'import'" class="card">
        <div class="card-header">
          <h2>数据导入</h2>
          <button class="btn btn-error" @click="clearAllData" v-if="store.testRounds.length > 0">
            清除所有数据
          </button>
        </div>
        
        <div v-if="importErrors.length > 0" class="alert alert-error">
          <strong>导入错误:</strong>
          <ul>
            <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
        
        <div v-if="importWarnings.length > 0" class="alert alert-warning">
          <strong>导入警告:</strong>
          <ul>
            <li v-for="(warning, index) in importWarnings" :key="index">{{ warning }}</li>
          </ul>
        </div>
        
        <DataImport
          :is-dragging="isDragging"
          @file-drop="handleFileDrop"
          @file-select="handleFileSelect"
          @drag-over="handleDragOver"
          @drag-leave="handleDragLeave"
        />
        
        <div v-if="store.testRounds.length > 0" class="alert alert-info" style="margin-top: 1rem;">
          已导入 {{ store.testRounds.length }} 个测试数据，点击"测试列表"查看详情
        </div>
      </div>
      
      <div v-if="activeTab === 'list'" class="card">
        <div class="card-header">
          <h2>测试轮次列表</h2>
          <span class="badge badge-info">共 {{ store.testRounds.length }} 个测试</span>
        </div>
        
        <TestRoundList
          :test-rounds="store.testRoundsWithStatus"
          :selected-id="store.selectedTestRoundId"
          @select="selectTestRound"
          @delete="store.deleteTestRound"
        />
      </div>
      
      <div v-if="activeTab === 'detail' && store.selectedTestRound" class="card">
        <div class="card-header">
          <h2>测试详情 - {{ store.selectedTestRound.testNumber }}</h2>
        </div>
        
        <TestRoundDetail :test-round="store.selectedTestRound" />
        
        <div v-if="store.selectedTestRound.forceData.length > 0" class="card" style="margin-top: 1.5rem;">
          <div class="card-header">
            <h3>六分力数据曲线</h3>
          </div>
          <div class="chart-container">
            <DataChart
              :data="store.selectedTestRound.forceData"
              :chart-type="'line'"
              :title="'六分力传感器数据'"
              :y-axes="['fx', 'fy', 'fz', 'mx', 'my', 'mz']"
            />
          </div>
        </div>
        
        <div v-if="store.selectedTestRound.windSpeedProfile.length > 0" class="card" style="margin-top: 1.5rem;">
          <div class="card-header">
            <h3>风速剖面</h3>
          </div>
          <div class="chart-container">
            <DataChart
              :data="store.selectedTestRound.windSpeedProfile"
              :chart-type="'line'"
              :title="'风速剖面'"
              :y-axes="['speed']"
            />
          </div>
        </div>
      </div>
      
      <div v-if="activeTab === 'analysis' && store.selectedAnalysisResult" class="card">
        <div class="card-header">
          <h2>分析结果</h2>
          <span 
            class="badge"
            :class="{
              'badge-success': store.selectedAnalysisResult.overallStatus === 'normal',
              'badge-warning': store.selectedAnalysisResult.overallStatus === 'warning',
              'badge-error': store.selectedAnalysisResult.overallStatus === 'critical'
            }"
          >
            {{ store.selectedAnalysisResult.overallStatus === 'normal' ? '正常' : 
               store.selectedAnalysisResult.overallStatus === 'warning' ? '警告' : '严重' }}
          </span>
        </div>
        
        <AnalysisPanel
          :analysis-result="store.selectedAnalysisResult"
          :test-round="store.selectedTestRound"
        />
      </div>
      
      <div v-if="activeTab === 'review' && store.selectedTestRound" class="card">
        <div class="card-header">
          <h2>复核与改判</h2>
        </div>
        
        <ReviewPanel
          :test-round="store.selectedTestRound"
          :analysis-result="store.selectedAnalysisResult"
          :existing-review="store.selectedReviewRecord"
          @save="saveReview"
          @update-risk="updateRiskItem"
        />
      </div>
      
      <div v-if="activeTab === 'export'" class="card">
        <div class="card-header">
          <h2>数据导出</h2>
        </div>
        
        <div class="grid grid-2" style="margin-top: 1rem;">
          <div class="card">
            <h3>Markdown 复盘单</h3>
            <p>导出当前选中测试的完整复盘报告，包含测试配置、分析结果、复核记录等。</p>
            <p v-if="!store.selectedTestRound" class="alert alert-warning">
              请先选择一个测试轮次
            </p>
            <button 
              class="btn btn-primary" 
              :disabled="!store.selectedTestRound"
              @click="exportMarkdown"
            >
              导出 Markdown
            </button>
          </div>
          
          <div class="card">
            <h3>CSV 风险清单</h3>
            <p>导出所有风险项列表，包含严重程度、状态、解决人等信息。</p>
            <p v-if="store.riskItems.length === 0" class="alert alert-warning">
              暂无风险数据
            </p>
            <button 
              class="btn btn-secondary" 
              :disabled="store.riskItems.length === 0"
              @click="exportCSV"
            >
              导出 CSV
            </button>
          </div>
          
          <div class="card">
            <h3>JSON 审计包</h3>
            <p>导出完整的审计数据包，包含所有测试数据、分析结果、复核记录和风险项。</p>
            <p v-if="store.testRounds.length === 0" class="alert alert-warning">
              暂无数据
            </p>
            <button 
              class="btn btn-success" 
              :disabled="store.testRounds.length === 0"
              @click="exportJSON"
            >
              导出 JSON
            </button>
          </div>
          
          <div class="card">
            <h3>数据统计</h3>
            <table class="data-table">
              <tr><td>测试轮次数量</td><td>{{ store.testRounds.length }}</td></tr>
              <tr><td>分析结果数量</td><td>{{ store.analysisResults.length }}</td></tr>
              <tr><td>复核记录数量</td><td>{{ store.reviewRecords.length }}</td></tr>
              <tr><td>风险项数量</td><td>{{ store.riskItems.length }}</td></tr>
              <tr><td>待处理风险</td><td>{{ store.riskItems.filter(r => r.status === 'pending').length }}</td></tr>
              <tr><td>已解决风险</td><td>{{ store.riskItems.filter(r => r.status === 'resolved').length }}</td></tr>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
