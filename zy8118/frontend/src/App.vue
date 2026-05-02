<template>
  <div class="container">
    <header class="header">
      <h1>🔍 OpenAPI 合约漂移回放台</h1>
      <p>导入 OpenAPI 合约、接口调用日志和 Mock 响应，检测合约漂移问题</p>
    </header>

    <section v-if="!analysisResult" class="card">
      <div class="card-header">
        <h2>📁 上传文件</h2>
      </div>

      <div class="upload-section">
        <div 
          class="upload-box"
          :class="{ 'has-file': openapiFile, 'dragover': dragoverOpenapi }"
          @dragover.prevent="dragoverOpenapi = true"
          @dragleave="dragoverOpenapi = false"
          @drop.prevent="handleDrop($event, 'openapi')"
          @click="$refs.openapiInput.click()"
        >
          <div class="upload-icon">{{ openapiFile ? '✅' : '📄' }}</div>
          <h3>OpenAPI 合约</h3>
          <p>支持 .yaml、.yml、.json 格式</p>
          <div v-if="openapiFile" class="file-info">
            <div class="filename">{{ openapiFile.name }}</div>
            <div class="filesize">{{ formatFileSize(openapiFile.size) }}</div>
          </div>
          <input 
            ref="openapiInput" 
            type="file" 
            accept=".yaml,.yml,.json"
            @change="handleFileChange($event, 'openapi')"
          />
        </div>

        <div 
          class="upload-box"
          :class="{ 'has-file': jsonlFile, 'dragover': dragoverJsonl }"
          @dragover.prevent="dragoverJsonl = true"
          @dragleave="dragoverJsonl = false"
          @drop.prevent="handleDrop($event, 'jsonl')"
          @click="$refs.jsonlInput.click()"
        >
          <div class="upload-icon">{{ jsonlFile ? '✅' : '📊' }}</div>
          <h3>接口调用日志</h3>
          <p>JSONL 格式，每行一个请求/响应对</p>
          <div v-if="jsonlFile" class="file-info">
            <div class="filename">{{ jsonlFile.name }}</div>
            <div class="filesize">{{ formatFileSize(jsonlFile.size) }}</div>
          </div>
          <input 
            ref="jsonlInput" 
            type="file" 
            accept=".jsonl,.json,.txt"
            @change="handleFileChange($event, 'jsonl')"
          />
        </div>

        <div 
          class="upload-box"
          :class="{ 'has-file': mockFile, 'dragover': dragoverMock }"
          @dragover.prevent="dragoverMock = true"
          @dragleave="dragoverMock = false"
          @drop.prevent="handleDrop($event, 'mock')"
          @click="$refs.mockInput.click()"
        >
          <div class="upload-icon">{{ mockFile ? '✅' : '🎭' }}</div>
          <h3>Mock 响应（可选）</h3>
          <p>JSON 格式的 Mock 数据</p>
          <div v-if="mockFile" class="file-info">
            <div class="filename">{{ mockFile.name }}</div>
            <div class="filesize">{{ formatFileSize(mockFile.size) }}</div>
          </div>
          <input 
            ref="mockInput" 
            type="file" 
            accept=".json"
            @change="handleFileChange($event, 'mock')"
          />
        </div>
      </div>

      <div class="analyze-section">
        <button 
          class="btn btn-primary analyze-btn"
          :disabled="!canAnalyze || isAnalyzing"
          @click="analyze"
        >
          <span v-if="isAnalyzing" class="loading">
            <span class="spinner"></span>
            分析中...
          </span>
          <span v-else>🚀 开始分析</span>
        </button>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>
    </section>

    <section v-if="analysisResult" class="card">
      <div class="card-header">
        <h2>📊 分析结果</h2>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" @click="exportJSON">
            📥 导出 JSON
          </button>
          <button class="btn btn-secondary btn-sm" @click="exportMarkdown">
            📥 导出 Markdown
          </button>
          <button class="btn btn-secondary btn-sm" @click="reset">
            🔄 重新上传
          </button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ analysisResult.summary.totalRequests }}</div>
          <div class="stat-label">总请求数</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{ analysisResult.summary.matchedRequests }}</div>
          <div class="stat-label">匹配成功</div>
        </div>
        <div class="stat-card" :class="analysisResult.summary.unmatchedRequests > 0 ? 'warning' : 'success'">
          <div class="stat-value">{{ analysisResult.summary.unmatchedRequests }}</div>
          <div class="stat-label">未匹配</div>
        </div>
        <div class="stat-card error">
          <div class="stat-value">{{ analysisResult.summary.errorCount }}</div>
          <div class="stat-label">错误</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">{{ analysisResult.summary.warningCount }}</div>
          <div class="stat-label">警告</div>
        </div>
        <div class="stat-card info">
          <div class="stat-value">{{ analysisResult.summary.infoCount }}</div>
          <div class="stat-label">信息</div>
        </div>
      </div>

      <div class="tabs">
        <button 
          class="tab-btn"
          :class="{ active: activeTab === 'issues', error: errorIssues.length > 0 }"
          @click="activeTab = 'issues'"
        >
          问题列表
          <span v-if="totalIssues > 0" class="badge">{{ totalIssues }}</span>
        </button>
        <button 
          class="tab-btn"
          :class="{ active: activeTab === 'versions', warning: analysisResult.versionConflicts?.length > 0 }"
          @click="activeTab = 'versions'"
        >
          版本冲突
          <span v-if="analysisResult.versionConflicts?.length > 0" class="badge">{{ analysisResult.versionConflicts.length }}</span>
        </button>
        <button 
          class="tab-btn"
          :class="{ active: activeTab === 'operationIds', info: analysisResult.missingOperationIds?.length > 0 }"
          @click="activeTab = 'operationIds'"
        >
          缺失 operationId
          <span v-if="analysisResult.missingOperationIds?.length > 0" class="badge">{{ analysisResult.missingOperationIds.length }}</span>
        </button>
        <button 
          class="tab-btn"
          :class="{ active: activeTab === 'unmatched', warning: analysisResult.unmatchedRequests?.length > 0 }"
          @click="activeTab = 'unmatched'"
        >
          未匹配请求
          <span v-if="analysisResult.unmatchedRequests?.length > 0" class="badge">{{ analysisResult.unmatchedRequests.length }}</span>
        </button>
        <button 
          class="tab-btn"
          :class="{ active: activeTab === 'report' }"
          @click="activeTab = 'report'"
        >
          完整报告
        </button>
      </div>

      <div v-if="activeTab === 'issues'">
        <div v-if="totalIssues > 0" class="issue-list">
          <div 
            v-for="(issue, index) in filteredIssues" 
            :key="index"
            class="issue-item"
            :class="issue.severity"
          >
            <div class="issue-header">
              <div class="issue-title">
                <span class="issue-severity" :class="issue.severity">
                  {{ getSeverityIcon(issue.severity) }} {{ issue.severity.toUpperCase() }}
                </span>
                <span class="issue-rule">{{ issue.ruleName }}</span>
              </div>
              <div class="operation-info">
                <span v-if="issue.operation" class="operation-method" :class="'method-' + issue.operation.method">
                  {{ issue.operation.method }}
                </span>
                <span v-if="issue.operation" class="operation-path">{{ issue.operation.path }}</span>
              </div>
            </div>
            <div class="issue-path">📍 {{ issue.path }}</div>
            <div class="issue-message">{{ issue.message }}</div>
            <div class="issue-details">
              <div v-if="issue.expected !== null && issue.expected !== undefined" class="issue-detail-item">
                <h4>期望</h4>
                <div class="value">{{ formatValue(issue.expected) }}</div>
              </div>
              <div v-if="issue.actual !== null && issue.actual !== undefined" class="issue-detail-item">
                <h4>实际</h4>
                <div class="value">{{ formatValue(issue.actual) }}</div>
              </div>
              <div v-if="issue.pairId !== undefined" class="issue-detail-item">
                <h4>请求 ID</h4>
                <div class="value">#{{ issue.pairId }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <h3>没有发现问题</h3>
          <p>所有响应都符合 OpenAPI 合约定义</p>
        </div>
      </div>

      <div v-if="activeTab === 'versions'">
        <div v-if="analysisResult.versionConflicts?.length > 0">
          <div class="alert alert-info">
            检测到同一路径存在多个版本。请确认是否使用了正确的版本路径。
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>基础路径</th>
                  <th>方法</th>
                  <th>当前版本</th>
                  <th>新版本</th>
                  <th>最新版本</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(conflict, index) in analysisResult.versionConflicts" :key="index">
                  <td><code>{{ conflict.basePath }}</code></td>
                  <td><span class="operation-method" :class="'method-' + conflict.method">{{ conflict.method }}</span></td>
                  <td>
                    <code>{{ conflict.currentPath }}</code>
                    <span v-if="conflict.currentVersion" class="badge badge-info">{{ conflict.currentVersion }}</span>
                  </td>
                  <td>
                    <code>{{ conflict.newerPath }}</code>
                    <span class="badge badge-warning">{{ conflict.newerVersion }}</span>
                  </td>
                  <td>
                    <code>{{ conflict.latestPath }}</code>
                    <span class="badge badge-success">{{ conflict.latestVersion }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>没有版本冲突</h3>
          <p>所有路径都只有一个版本</p>
        </div>
      </div>

      <div v-if="activeTab === 'operationIds'">
        <div v-if="analysisResult.missingOperationIds?.length > 0">
          <div class="alert alert-warning">
            以下操作没有显式定义 operationId，已自动生成。建议添加明确的 operationId 以提高可读性。
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>路径</th>
                  <th>方法</th>
                  <th>自动生成的 ID</th>
                  <th>建议命名</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in analysisResult.missingOperationIds" :key="index">
                  <td><code>{{ item.path }}</code></td>
                  <td><span class="operation-method" :class="'method-' + item.method">{{ item.method }}</span></td>
                  <td><code>{{ item.operationId }}</code></td>
                  <td><code class="badge badge-info">{{ item.recommendedId }}</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>所有操作都有 operationId</h3>
          <p>所有 API 操作都已定义了明确的 operationId</p>
        </div>
      </div>

      <div v-if="activeTab === 'unmatched'">
        <div v-if="analysisResult.unmatchedRequests?.length > 0">
          <div class="alert alert-warning">
            以下请求无法与 OpenAPI 合约中的任何操作匹配。请检查路径和方法是否正确。
          </div>
          <div class="issue-list">
            <div 
              v-for="(item, index) in analysisResult.unmatchedRequests" 
              :key="index"
              class="issue-item warning"
            >
              <div class="issue-header">
                <div class="issue-title">
                  <span class="operation-method" :class="'method-' + item.request.method">{{ item.request.method }}</span>
                  <span class="operation-path">{{ item.request.url }}</span>
                </div>
              </div>
              <div v-if="item.suggestions?.length > 0" class="issue-details">
                <div class="issue-detail-item">
                  <h4>可能匹配的操作</h4>
                  <div v-for="(sug, sIndex) in item.suggestions" :key="sIndex" class="value" style="margin-bottom: 8px;">
                    <span class="operation-method" :class="'method-' + sug.operation.method">{{ sug.operation.method }}</span>
                    <code>{{ sug.operation.path }}</code>
                    <span class="badge badge-info">{{ (sug.similarity * 100).toFixed(0) }}% 匹配</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>所有请求都已匹配</h3>
          <p>所有请求都能与 OpenAPI 合约中的操作对应</p>
        </div>
      </div>

      <div v-if="activeTab === 'report'">
        <div class="alert alert-info">
          以下是完整的分析报告，可以导出为 Markdown 或 JSON 格式保存。
        </div>
        <div class="json-preview">{{ analysisResult.reports?.markdown || '报告生成中...' }}</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const openapiFile = ref(null)
const jsonlFile = ref(null)
const mockFile = ref(null)
const dragoverOpenapi = ref(false)
const dragoverJsonl = ref(false)
const dragoverMock = ref(false)
const isAnalyzing = ref(false)
const analysisResult = ref(null)
const error = ref(null)
const activeTab = ref('issues')

const canAnalyze = computed(() => {
  return openapiFile.value && jsonlFile.value
})

const totalIssues = computed(() => {
  return analysisResult.value?.issues?.length || 0
})

const errorIssues = computed(() => {
  return analysisResult.value?.issues?.filter(i => i.severity === 'error') || []
})

const warningIssues = computed(() => {
  return analysisResult.value?.issues?.filter(i => i.severity === 'warning') || []
})

const infoIssues = computed(() => {
  return analysisResult.value?.issues?.filter(i => i.severity === 'info') || []
})

const filteredIssues = computed(() => {
  return analysisResult.value?.issues || []
})

function handleFileChange(event, type) {
  const file = event.target.files?.[0]
  if (!file) return
  
  if (type === 'openapi') {
    openapiFile.value = file
  } else if (type === 'jsonl') {
    jsonlFile.value = file
  } else if (type === 'mock') {
    mockFile.value = file
  }
  error.value = null
}

function handleDrop(event, type) {
  const file = event.dataTransfer.files?.[0]
  if (!file) return
  
  if (type === 'openapi') {
    openapiFile.value = file
  } else if (type === 'jsonl') {
    jsonlFile.value = file
  } else if (type === 'mock') {
    mockFile.value = file
  }
  dragoverOpenapi.value = false
  dragoverJsonl.value = false
  dragoverMock.value = false
  error.value = null
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getSeverityIcon(severity) {
  switch (severity) {
    case 'error': return '❌'
    case 'warning': return '⚠️'
    case 'info': return 'ℹ️'
    default: return '📝'
  }
}

function formatValue(value) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(e)
    reader.readAsText(file)
  })
}

async function analyze() {
  if (!canAnalyze.value) return
  
  isAnalyzing.value = true
  error.value = null
  
  try {
    const openapiContent = await readFileAsText(openapiFile.value)
    const jsonlContent = await readFileAsText(jsonlFile.value)
    const mockContent = mockFile.value ? await readFileAsText(mockFile.value) : null

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        openapiContent,
        jsonlContent,
        mockContent
      })
    })

    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || '分析失败')
    }

    analysisResult.value = result
  } catch (err) {
    error.value = err.message || '分析过程中发生错误'
    console.error('Analysis error:', err)
  } finally {
    isAnalyzing.value = false
  }
}

function exportJSON() {
  if (!analysisResult.value?.reports?.json) return
  
  const dataStr = JSON.stringify(analysisResult.value.reports.json, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = 'drift_report.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportMarkdown() {
  if (!analysisResult.value?.reports?.markdown) return
  
  const blob = new Blob([analysisResult.value.reports.markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = 'drift_report.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function reset() {
  openapiFile.value = null
  jsonlFile.value = null
  mockFile.value = null
  analysisResult.value = null
  error.value = null
  activeTab.value = 'issues'
}
</script>
