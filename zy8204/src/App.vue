<template>
  <div class="app-container">
    <header class="header">
      <h1>🔬 钻孔岩芯编录质量复核工具</h1>
      <p>智能检测深度断档、箱号重复、RQD超范围、层位命名不一致等问题</p>
    </header>
    
    <main class="main-content">
      <div class="toolbar">
        <label class="file-upload">
          <input 
            type="file" 
            accept=".csv"
            @change="handleBoreholesUpload"
          />
          📁 导入 boreholes.csv
        </label>
        
        <label class="file-upload">
          <input 
            type="file" 
            accept=".json"
            @change="handleCoreBoxesUpload"
          />
          📁 导入 core_boxes.json
        </label>
        
        <label class="file-upload">
          <input 
            type="file" 
            accept=".yaml,.yml"
            @change="handleRulesUpload"
          />
          📁 导入 rules.yaml
        </label>
        
        <button class="btn btn-secondary" @click="loadSampleData">
          📊 加载示例数据
        </button>
        
        <button 
          class="btn btn-secondary" 
          @click="clearAllData"
          :disabled="!hasData"
        >
          🗑️ 清空数据
        </button>
        
        <div class="spacer"></div>
        
        <select 
          v-model="selectedBoreholeId" 
          class="select-input"
          :disabled="boreholes.length === 0"
          @change="handleBoreholeChange"
        >
          <option value="" disabled>请选择钻孔</option>
          <option 
            v-for="borehole in boreholeList" 
            :key="borehole.borehole_id"
            :value="borehole.borehole_id"
          >
            {{ borehole.borehole_id }} ({{ borehole.box_count }}箱, {{ borehole.issue_count }}个问题)
          </option>
        </select>
        
        <button 
          class="btn btn-success" 
          @click="exportIssuesCSV"
          :disabled="issues.length === 0"
        >
          📥 导出 issues.csv
        </button>
        
        <button 
          class="btn btn-success" 
          @click="exportReportMD"
          :disabled="issues.length === 0"
        >
          📄 导出 review_report.md
        </button>
      </div>
      
      <div v-if="parseErrors.length > 0" class="panel" style="margin-bottom: 1.5rem;">
        <div class="panel-header">
          <h3>⚠️ 解析错误</h3>
        </div>
        <div class="panel-body">
          <div v-for="(error, index) in parseErrors" :key="index" class="issue-item error">
            <div class="issue-title">{{ error.message }}</div>
          </div>
        </div>
      </div>
      
      <div v-if="!hasData" class="panel">
        <div class="panel-body">
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">欢迎使用钻孔岩芯编录质量复核工具</div>
            <div style="color: #666; margin-bottom: 1.5rem;">
              请导入数据文件或点击"加载示例数据"开始使用
            </div>
            <div style="text-align: left; background: #f8f9fa; padding: 1.5rem; border-radius: 8px; max-width: 600px;">
              <div style="font-weight: 600; margin-bottom: 0.75rem; color: #2c3e50;">📁 支持的数据格式：</div>
              <ul style="margin: 0; padding-left: 1.5rem; color: #555;">
                <li style="margin-bottom: 0.5rem;"><strong>boreholes.csv</strong> - 钻孔信息表（包含 borehole_id, total_depth 等字段）</li>
                <li style="margin-bottom: 0.5rem;"><strong>core_boxes.json</strong> - 岩芯箱数据（包含 borehole_id, box_number, start_depth, end_depth, lithology, rqd, recovery_rate 等字段）</li>
                <li style="margin-bottom: 0.5rem;"><strong>rules.yaml</strong> - 校验规则配置（可选，用于自定义校验参数）</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="content-grid">
        <div class="panel" style="grid-column: 1 / -1; margin-bottom: 0;">
          <div class="panel-header">
            <h3>📊 项目概览</h3>
          </div>
          <div class="panel-body">
            <div class="stats-summary" style="margin-bottom: 0;">
              <div class="stat-item">
                <div class="stat-value">{{ boreholes.length }}</div>
                <div class="stat-label">钻孔数</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ coreBoxes.length }}</div>
                <div class="stat-label">岩芯箱数</div>
              </div>
              <div class="stat-item">
                <div class="stat-value error">{{ stats.errors }}</div>
                <div class="stat-label">错误</div>
              </div>
              <div class="stat-item">
                <div class="stat-value warning">{{ stats.warnings }}</div>
                <div class="stat-label">警告</div>
              </div>
              <div class="stat-item">
                <div class="stat-value info">{{ stats.infos }}</div>
                <div class="stat-label">提示</div>
              </div>
              <div class="stat-item" v-if="selectedBorehole">
                <div class="stat-value">{{ selectedBorehole.box_count || 0 }}</div>
                <div class="stat-label">当前钻孔箱数</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="panel">
          <div class="panel-header">
            <h3>📍 岩芯编录可视化</h3>
          </div>
          <div class="panel-body">
            <div v-if="!selectedBoreholeId" class="empty-state">
              <div class="empty-state-icon">📍</div>
              <div>请选择一个钻孔查看详细信息</div>
            </div>
            
            <div v-else-if="selectedBoreholeBoxes.length === 0" class="empty-state">
              <div class="empty-state-icon">📦</div>
              <div>该钻孔暂无岩芯箱数据</div>
            </div>
            
            <div v-else class="visualization-container">
              <DepthStrip
                :minDepth="depthInfo.minDepth || 0"
                :maxDepth="depthInfo.maxDepth || 0"
                :highlightedRange="highlightedRange"
              />
              
              <LithologyLog
                :boxes="selectedBoreholeBoxes"
                :minDepth="depthInfo.minDepth || 0"
                :maxDepth="depthInfo.maxDepth || 0"
                :selectedBoxNumber="selectedBoxNumber"
                :highlightedRange="highlightedRange"
                @box-click="handleBoxClick"
              />
              
              <CurvesChart
                :rqdData="rqdRecoveryData?.rqdData || []"
                :recoveryData="rqdRecoveryData?.recoveryData || []"
                :selectedBoxNumber="selectedBoxNumber"
              />
            </div>
          </div>
        </div>
        
        <div class="panel">
          <div class="panel-header">
            <h3>⚠️ 问题列表</h3>
            <span class="status-badge" :class="stats.errors > 0 ? 'error' : 'success'">
              {{ stats.total }} 个问题
            </span>
          </div>
          <div class="panel-body">
            <IssuesList
              :issues="selectedBoreholeIssues"
              :stats="selectedBoreholeIssueStats"
              :selectedIssueId="selectedIssueId"
              @issue-click="handleIssueClick"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import DepthStrip from './components/DepthStrip.vue'
import LithologyLog from './components/LithologyLog.vue'
import CurvesChart from './components/CurvesChart.vue'
import IssuesList from './components/IssuesList.vue'
import {
  appState,
  computedState,
  loadSampleData as loadSampleDataFn,
  loadBoreholesFromFile,
  loadCoreBoxesFromFile,
  loadRulesFromFile,
  clearAllData as clearAllDataFn,
  selectBorehole,
  selectIssue,
  selectBoxNumber,
  clearSelection
} from './stores/appStore.js'
import { sampleData } from './data/sampleData.js'
import { 
  exportIssuesCSV as generateIssuesCSV, 
  exportReviewReportMD as generateReviewReportMD, 
  downloadCSV, 
  downloadMarkdown 
} from './utils/exporter.js'

const selectedBoreholeId = computed({
  get: () => appState.selectedBoreholeId,
  set: (val) => selectBorehole(val)
})

const selectedIssueId = computed(() => appState.selectedIssueId)
const selectedBoxNumber = computed(() => appState.selectedBoxNumber)

const boreholes = computed(() => appState.boreholes)
const coreBoxes = computed(() => appState.coreBoxes)
const issues = computed(() => appState.issues)
const stats = computed(() => appState.stats)
const parseErrors = computed(() => appState.parseErrors)
const hasData = computed(() => computedState.hasData.value)
const boreholeList = computed(() => computedState.boreholeList.value)
const selectedBorehole = computed(() => computedState.selectedBorehole.value)
const selectedBoreholeBoxes = computed(() => computedState.selectedBoreholeBoxes.value)
const selectedBoreholeIssues = computed(() => computedState.selectedBoreholeIssues.value)
const depthInfo = computed(() => computedState.selectedBoreholeDepthInfo.value)
const lithologyLayers = computed(() => computedState.selectedBoreholeLithologyLayers.value)
const rqdRecoveryData = computed(() => computedState.selectedBoreholeRQDRecovery.value)

const highlightedRange = computed(() => {
  if (appState.selectedIssueId) {
    const issue = appState.issues.find(i => i.id === appState.selectedIssueId)
    if (issue && issue.start_depth !== undefined && issue.end_depth !== undefined) {
      return {
        start_depth: issue.start_depth,
        end_depth: issue.end_depth
      }
    }
    if (issue && issue.box_numbers && issue.box_numbers.length > 0) {
      const box = selectedBoreholeBoxes.value.find(b => b.box_number === issue.box_numbers[0])
      if (box) {
        return {
          start_depth: box.start_depth,
          end_depth: box.end_depth
        }
      }
    }
  }
  
  if (appState.selectedBoxNumber !== null) {
    const box = selectedBoreholeBoxes.value.find(b => b.box_number === appState.selectedBoxNumber)
    if (box) {
      return {
        start_depth: box.start_depth,
        end_depth: box.end_depth
      }
    }
  }
  
  return null
})

const selectedBoreholeIssueStats = computed(() => {
  const issues = selectedBoreholeIssues.value
  return {
    total: issues.length,
    errors: issues.filter(i => i.type === 'error').length,
    warnings: issues.filter(i => i.type === 'warning').length,
    infos: issues.filter(i => i.type === 'info').length
  }
})

function handleBoreholesUpload(event) {
  const file = event.target.files[0]
  if (file) {
    loadBoreholesFromFile(file)
    event.target.value = ''
  }
}

function handleCoreBoxesUpload(event) {
  const file = event.target.files[0]
  if (file) {
    loadCoreBoxesFromFile(file)
    event.target.value = ''
  }
}

function handleRulesUpload(event) {
  const file = event.target.files[0]
  if (file) {
    loadRulesFromFile(file)
    event.target.value = ''
  }
}

function loadSampleData() {
  loadSampleDataFn(sampleData)
}

function clearAllData() {
  clearAllDataFn()
}

function handleBoreholeChange() {
  clearSelection()
}

function handleIssueClick(issue) {
  selectIssue(issue.id)
}

function handleBoxClick(box) {
  selectBoxNumber(box.box_number)
}

function exportIssuesCSV() {
  const csvContent = generateIssuesCSV(appState.issues, appState.boreholes)
  const timestamp = new Date().toISOString().slice(0, 10)
  downloadCSV(csvContent, `issues_${timestamp}.csv`)
}

function exportReportMD() {
  const mdContent = generateReviewReportMD(
    appState.issues,
    appState.boreholes,
    appState.coreBoxes,
    appState.stats
  )
  const timestamp = new Date().toISOString().slice(0, 10)
  downloadMarkdown(mdContent, `review_report_${timestamp}.md`)
}
</script>

<style>
.spacer {
  flex: 1;
}
</style>
