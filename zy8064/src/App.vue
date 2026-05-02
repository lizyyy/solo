<template>
  <div class="app">
    <header class="app-header">
      <h1>📖 EPUB 无障碍巡检工具</h1>
      <p class="subtitle">检查 EPUB 文件的无障碍问题</p>
    </header>

    <main class="app-main">
      <div v-if="!store.state.epubData" class="welcome-section">
        <FileDropZone
          :loading="store.state.loading"
          :has-file="!!store.state.epubData"
          :file-name="store.state.fileName"
          @file-selected="handleFileSelect"
        />

        <div v-if="store.state.error" class="error-box">
          <div class="error-icon">⚠️</div>
          <div class="error-title">解析错误</div>
          <div class="error-message">{{ store.state.error.message }}</div>
          <div v-if="store.state.error.type === 'encrypted'" class="error-hint">
            该 EPUB 文件已加密，需要先解密
          </div>
          <div v-if="store.state.error.type === 'corrupt'" class="error-hint">
            文件可能已损坏，请检查后重试
          </div>
        </div>
      </div>

      <div v-else class="inspector-section">
        <div class="inspector-header">
          <div class="file-badge">
            <span class="file-icon">📖</span>
            <span class="file-name">{{ store.state.fileName }}</span>
          </div>
          <button class="new-file-btn" @click="handleNewFile">导入新文件</button>
        </div>

        <div class="stats-bar">
          <div class="stat-item critical">
            <span class="stat-num">{{ store.issuesBySeverity.value.critical }}</span>
            <span class="stat-label">严重</span>
          </div>
          <div class="stat-item warning">
            <span class="stat-num">{{ store.issuesBySeverity.value.warning }}</span>
            <span class="stat-label">警告</span>
          </div>
          <div class="stat-item total">
            <span class="stat-num">{{ store.state.issues.length }}</span>
            <span class="stat-label">总计</span>
          </div>
        </div>

        <FilterBar
          :filters="store.state.filters"
          @filter="handleFilter"
          @clear="store.clearFilters"
        />

        <div class="content-grid">
          <div class="left-panel">
            <ChapterList
              :chapters="store.state.parsedData?.chapters || []"
              :selected-id="store.state.selectedChapterId"
              @select="handleChapterSelect"
            />

            <IssuePanel
              :issues="store.filteredIssues.value"
              :selected-id="store.state.selectedIssueId"
              @select="handleIssueSelect"
            />
          </div>

          <div class="right-panel">
            <IssueDetail :issue="store.selectedIssue.value" />
          </div>
        </div>

        <ExportBar
          :has-issues="store.state.issues.length > 0"
          @export-csv="handleExportCSV"
          @export-md="handleExportMD"
          @export-summary-csv="handleExportSummaryCSV"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import FileDropZone from './components/FileDropZone.vue'
import ChapterList from './components/ChapterList.vue'
import IssuePanel from './components/IssuePanel.vue'
import IssueDetail from './components/IssueDetail.vue'
import FilterBar from './components/FilterBar.vue'
import ExportBar from './components/ExportBar.vue'

import { useInspectorStore } from './store/inspector.js'
import { exportIssuesToCSV, exportSummaryToCSV } from './exporters/csvExporter.js'
import { exportIssuesToMarkdown, exportSummaryToMarkdown } from './exporters/mdExporter.js'

const store = useInspectorStore()

async function handleFileSelect(file) {
  try {
    await store.setEpubData(file)
  } catch (err) {
    console.error('Failed to parse EPUB:', err)
  }
}

function handleNewFile() {
  store.clearAll()
}

function handleChapterSelect(chapterId) {
  store.setSelectedChapter(chapterId)
}

function handleIssueSelect(issueId) {
  store.setSelectedIssue(issueId)
}

function handleFilter(key, value) {
  store.setFilter(key, value)
}

function handleExportCSV() {
  exportIssuesToCSV(store.state.issues, 'issues.csv')
}

function handleExportMD() {
  const metadata = store.state.parsedData?.metadata
  exportIssuesToMarkdown(
    store.state.issues,
    metadata,
    store.issuesBySeverity.value
  )
}

function handleExportSummaryCSV() {
  const metadata = store.state.parsedData?.metadata
  exportSummaryToCSV(
    metadata,
    store.issuesBySeverity.value,
    store.issuesByChapter.value
  )
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #333;
  line-height: 1.5;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #4a90d9 0%, #3a7bc8 100%);
  color: white;
  padding: 24px 32px;
  text-align: center;
}

.app-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.app-main {
  flex: 1;
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.welcome-section {
  max-width: 600px;
  margin: 40px auto;
}

.error-box {
  margin-top: 20px;
  padding: 20px;
  background: #fff5f5;
  border: 1px solid #ffcdd2;
  border-radius: 8px;
  text-align: center;
}

.error-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.error-title {
  font-size: 16px;
  font-weight: 600;
  color: #c62828;
  margin-bottom: 4px;
}

.error-message {
  font-size: 14px;
  color: #d32f2f;
}

.error-hint {
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}

.inspector-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid #e0e0e0;
}

.file-icon {
  font-size: 18px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
}

.new-file-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  color: #666;
}

.new-file-btn:hover {
  background: #eee;
}

.stats-bar {
  display: flex;
  gap: 16px;
}

.stat-item {
  flex: 1;
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 28px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.stat-item.critical {
  border-left: 4px solid #c62828;
}

.stat-item.critical .stat-num {
  color: #c62828;
}

.stat-item.warning {
  border-left: 4px solid #ef6c00;
}

.stat-item.warning .stat-num {
  color: #ef6c00;
}

.stat-item.total {
  border-left: 4px solid #4a90d9;
}

.stat-item.total .stat-num {
  color: #4a90d9;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.right-panel {
  position: sticky;
  top: 0;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .right-panel {
    position: static;
  }
}
</style>
