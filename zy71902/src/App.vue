<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ImportPanel from './components/ImportPanel.vue'
import RecordList from './components/RecordList.vue'
import HistoryModal from './components/HistoryModal.vue'
import StatusModal from './components/StatusModal.vue'
import GuidePanel from './components/GuidePanel.vue'
import { useStore } from './store'
import type { ScoreRecord, RecordStatus } from './types'

const store = useStore()
const activeTab = ref<'records' | 'guide'>('records')
const showHistoryModal = ref(false)
const showStatusModal = ref(false)
const selectedRecord = ref<ScoreRecord | null>(null)
const operator = ref('当前用户')

onMounted(() => {
  store.loadSampleData()
})

function openHistory(record: ScoreRecord) {
  selectedRecord.value = record
  showHistoryModal.value = true
}

function openStatusModal(record: ScoreRecord) {
  selectedRecord.value = record
  showStatusModal.value = true
}

function handleStatusChange(recordId: string, status: RecordStatus, reason: string) {
  store.updateRecordStatus(recordId, status, operator.value, reason)
}

function handleBatchConfirm() {
  if (store.state.selectedIds.length === 0) return
  if (confirm(`确认将选中的 ${store.state.selectedIds.length} 条记录标记为已确认？`)) {
    store.batchUpdateStatus(store.state.selectedIds, 'confirmed', operator.value, '批量确认')
    store.clearSelection()
  }
}

function handleBatchReject() {
  if (store.state.selectedIds.length === 0) return
  const reason = prompt('请输入驳回原因：')
  if (reason) {
    store.batchUpdateStatus(store.state.selectedIds, 'rejected', operator.value, reason)
    store.clearSelection()
  }
}

function handleExport() {
  const recordsToExport = store.state.selectedIds.length > 0
    ? store.exportRecords(store.state.selectedIds)
    : store.filteredRecords.value
  
  if (recordsToExport.length === 0) {
    alert('没有可导出的记录')
    return
  }
  
  const csvContent = [
    ['学生姓名', '乐器', '声部', '曲目', '状态', '来源', '待处理原因', '最后更新'].join(','),
    ...recordsToExport.map(r => [
      r.studentName,
      r.instrument,
      r.part,
      r.songTitle,
      getStatusText(r.status),
      r.sourceName,
      r.pendingReason,
      r.updatedAt
    ].map(v => `"${v}"`).join(','))
  ].join('\n')
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `民乐谱面整理_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function handleExportSummary() {
  const confirmed = store.state.records.filter(r => r.status === 'confirmed')
  const pending = store.state.records.filter(r => r.status === 'pending')
  const duplicate = store.state.records.filter(r => r.status === 'duplicate')
  
  let summary = '排练小结\n'
  summary += '='.repeat(40) + '\n\n'
  summary += `统计时间: ${new Date().toLocaleString()}\n`
  summary += `总记录数: ${store.stats.value.total}\n`
  summary += `已确认: ${confirmed.length}\n`
  summary += `待处理: ${pending.length}\n`
  summary += `重复记录: ${duplicate.length}\n\n`
  
  if (pending.length > 0) {
    summary += '【待处理事项】\n'
    pending.forEach(r => {
      summary += `- ${r.studentName} - ${r.songTitle}: ${r.pendingReason}\n`
    })
    summary += '\n'
  }
  
  if (duplicate.length > 0) {
    summary += '【重复记录需核对】\n'
    const dupGroups = new Map<string, string[]>()
    duplicate.forEach(r => {
      const key = `${r.studentName}-${r.songTitle}`
      if (!dupGroups.has(key)) dupGroups.set(key, [])
      dupGroups.get(key)!.push(r.sourceName)
    })
    dupGroups.forEach((sources, key) => {
      const [name, song] = key.split('-')
      summary += `- ${name} - ${song}: 来自 ${sources.join('、')}\n`
    })
    summary += '\n'
  }
  
  summary += '【确认清单】\n'
  confirmed.forEach(r => {
    summary += `- ${r.studentName} | ${r.instrument} | ${r.songTitle} | ${r.part}\n`
  })
  
  const blob = new Blob([summary], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `排练小结_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function getStatusText(status: RecordStatus): string {
  const map: Record<RecordStatus, string> = {
    pending: '待处理',
    confirmed: '已确认',
    duplicate: '重复',
    rejected: '已驳回'
  }
  return map[status]
}
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>🎵 民乐谱面整理</h1>
      <p>统一口径处理重复导入、撤回修正、筛选导出，让汇报演出前的材料整理更清晰</p>
    </div>

    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">总记录</div>
        <div class="stat-value">{{ store.stats.value.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">待处理</div>
        <div class="stat-value pending">{{ store.stats.value.pending }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已确认</div>
        <div class="stat-value confirmed">{{ store.stats.value.confirmed }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">重复</div>
        <div class="stat-value duplicate">{{ store.stats.value.duplicate }}</div>
      </div>
    </div>

    <div class="tabs">
      <div 
        class="tab" 
        :class="{ active: activeTab === 'records' }"
        @click="activeTab = 'records'"
      >
        📋 记录管理
      </div>
      <div 
        class="tab" 
        :class="{ active: activeTab === 'guide' }"
        @click="activeTab = 'guide'"
      >
        📖 使用指南
      </div>
    </div>

    <div v-if="activeTab === 'records'">
      <ImportPanel />

      <div class="card">
        <div class="card-title">
          <span>🔧 批量操作</span>
          <span style="font-size: 12px; color: #888; font-weight: normal;">
            已选择 {{ store.state.selectedIds.length }} 条
          </span>
        </div>
        <div class="btn-group">
          <button class="btn btn-success btn-sm" @click="handleBatchConfirm" :disabled="store.state.selectedIds.length === 0">
            ✓ 批量确认
          </button>
          <button class="btn btn-danger btn-sm" @click="handleBatchReject" :disabled="store.state.selectedIds.length === 0">
            ✗ 批量驳回
          </button>
          <button class="btn btn-secondary btn-sm" @click="store.clearSelection">
            取消选择
          </button>
          <button class="btn btn-primary btn-sm" @click="handleExport">
            📤 导出选中/筛选
          </button>
          <button class="btn btn-warning btn-sm" @click="handleExportSummary">
            📝 导出排练小结
          </button>
        </div>
      </div>

      <RecordList 
        @open-history="openHistory"
        @open-status="openStatusModal"
      />
    </div>

    <div v-if="activeTab === 'guide'">
      <GuidePanel />
    </div>

    <HistoryModal 
      v-if="showHistoryModal && selectedRecord"
      :record="selectedRecord"
      @close="showHistoryModal = false"
    />

    <StatusModal
      v-if="showStatusModal && selectedRecord"
      :record="selectedRecord"
      @close="showStatusModal = false"
      @confirm="handleStatusChange"
    />
  </div>
</template>
